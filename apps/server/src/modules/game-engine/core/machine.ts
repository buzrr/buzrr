import {
  finalRevealMs,
  isScoredType,
  isUnlimitedTime,
  revealHasPoint,
} from "@buzrr/contract";
import { ANSWER_GRACE_MS } from "../../../common/utils/answer-timing";
import { planBotAnswer } from "../../../common/utils/duel-bot";
import {
  acceptsMoreAnswers,
  hasPreload,
  preloadImageUrls,
  preloadUrls,
  toPublicQuestion,
} from "../../question-types";
import type { ModerationSettings } from "@buzrr/contract";
import type { LiveQuestion } from "../game-engine.types";
import {
  leaderboardWithReveal,
  moderationOf,
  scoresStepPending,
} from "./moderation";
import { pacingFor, type PacingStrategy } from "./pacing";
import {
  HOST,
  ROOM,
  withMeta,
  type Effect,
  type GameState,
  type StatePart,
  type Transition,
} from "./state";
import { buildAnswerResult, buildLeaderboard, buildReveal } from "./views";

/** Countdown shown on clients between "start game" and the first question. */
export const START_COUNTDOWN_MS = 5_000;

/**
 * Inputs to the phase machine. Clients never produce these directly: the
 * shell turns intents (start-game, host-next), timers and stored answers into
 * events.
 */
export type EngineEvent =
  /** The host started a classic lobby; questions come from Postgres. */
  | {
      type: "start";
      questions: LiveQuestion[];
      quizTitle: string;
      /** Moderated mode settings from the quiz; null/absent = unmoderated. */
      moderation?: ModerationSettings | null;
      /** The quiz's sound skin final-song key, if it has one. */
      finalSoundKey?: string | null;
    }
  /** The host's single pacing intent — the machine decides what it means. */
  | { type: "host-next" }
  /** The game's scheduled deadline came due (local timer or sweeper). */
  | { type: "deadline" }
  /**
   * An answer to question `qIndex` was stored. `answered` is everyone who has
   * answered it, read atomically with the write — so the per-answer path
   * needs no read of the answers after it.
   */
  | { type: "answer-recorded"; qIndex: number; answered: readonly string[] }
  /** Close the open question now (everyone connected has answered). */
  | { type: "close-question"; qIndex: number }
  /** The roster shrank or a player dropped (kick, ban, leave, disconnect). */
  | { type: "roster-changed" }
  /** The host, while the countdown waits for downloads: keep waiting or go. */
  | { type: "downloads-decision"; wait: boolean };

/**
 * What the shell must load for each event. `answer-recorded` runs once per
 * answer — the hot path — so it needs only the roster and questions (the
 * answers come with the event), which the shell already read to judge the
 * answer; the close itself is a follow-up `close-question` event with a full
 * load.
 */
export const PARTS_FOR: Record<EngineEvent["type"], readonly StatePart[]> = {
  start: [],
  "host-next": ["questions", "roster", "answers", "scores"],
  // Preloads: a countdown into a question with sound waits for downloads.
  deadline: ["questions", "roster", "answers", "scores", "preloads"],
  "answer-recorded": ["questions", "roster"],
  "close-question": ["questions", "roster", "answers", "scores"],
  // Questions too: whether the open one may close early depends on its type.
  "roster-changed": ["questions", "roster", "answers", "scores"],
  "downloads-decision": [
    "questions",
    "roster",
    "answers",
    "scores",
    "preloads",
  ],
};

export interface StepContext {
  /** Randomness for bot plans; injectable so tests are deterministic. */
  random: () => number;
}

const defaultContext: StepContext = { random: Math.random };

const noop = (state: GameState, ...effects: Effect[]): Transition => ({
  state,
  effects,
});

/**
 * The game engine's phase machine:
 *
 *   lobby → starting → question ⇄ reveal → final → ended
 *
 * A pure function of `(state, event, now)` → `(newState, effects)`. It never
 * touches Redis, sockets or timers; `GameEngineService` loads the state, runs
 * the effects in order, and owns everything that needs atomicity (first-write
 * answers, the end-of-game claim, pause/resume claims). That split is what
 * lets the rules of the game be unit-tested without infrastructure.
 */
export function step(
  state: GameState,
  event: EngineEvent,
  now: number,
  ctx: StepContext = defaultContext,
): Transition {
  if (state.meta.phase === "ended") {
    // A stale schedule entry for a finished game just goes away.
    return event.type === "deadline"
      ? noop(state, { kind: "clear-deadline" })
      : noop(state);
  }
  const pacing = pacingFor(state.meta);

  switch (event.type) {
    case "start":
      return start(state, event, now);
    case "host-next":
      return hostNext(state, now, pacing, ctx);
    case "deadline":
      return onDeadline(state, now, pacing, ctx);
    case "answer-recorded":
      return onAnswerRecorded(state, event.qIndex, event.answered);
    case "downloads-decision":
      return downloadsDecision(state, event.wait, now, ctx);
    case "close-question":
      // Only the question that met the early-close condition: if another
      // path already revealed it and opened the next, this is stale.
      return event.qIndex === state.meta.qIndex
        ? closeQuestion(state, now, pacing)
        : noop(state);
    case "roster-changed":
      return onRosterChanged(state);
  }
}

function start(
  state: GameState,
  event: {
    questions: LiveQuestion[];
    quizTitle: string;
    moderation?: ModerationSettings | null;
    finalSoundKey?: string | null;
  },
  now: number,
): Transition {
  const keyPatch = event.finalSoundKey
    ? { finalSoundKey: event.finalSoundKey }
    : {};
  if (state.meta.phase !== "lobby") return noop(state);
  if (event.questions.length === 0) {
    return noop(state, {
      kind: "log",
      level: "error",
      message: "Cannot start: the quiz has no playable questions",
    });
  }
  const mod = event.moderation?.enabled ? event.moderation : null;
  if (mod?.confirmNextQuestion) {
    // Moderated: the room opens on question 1's get-ready slide and waits.
    const patch = {
      phase: "ready" as const,
      quizTitle: event.quizTitle,
      qCount: event.questions.length,
      startedAt: now,
      qIndex: 0,
      qDeadline: 0,
      moderation: JSON.stringify(mod),
      ...keyPatch,
    };
    return {
      state: { ...withMeta(state, patch), questions: event.questions },
      effects: [
        { kind: "set-questions", questions: event.questions },
        { kind: "patch-meta", patch },
        { kind: "park-deadline" },
        { kind: "claim-owner" },
        { kind: "mark-playing" },
        {
          kind: "emit",
          to: ROOM,
          message: { event: "game-started", deadline: now, moderation: mod },
        },
        {
          kind: "emit",
          to: ROOM,
          message: {
            event: "phase-change",
            payload: { phase: "ready", qIndex: 0 },
          },
        },
        ...preloadEffects({ ...state, questions: event.questions }, 0),
      ],
    };
  }
  const firstQuestionAt = now + START_COUNTDOWN_MS;
  const patch = {
    phase: "starting" as const,
    quizTitle: event.quizTitle,
    qCount: event.questions.length,
    startedAt: now,
    qDeadline: firstQuestionAt,
    ...(mod ? { moderation: JSON.stringify(mod) } : {}),
    ...keyPatch,
  };
  return {
    state: { ...withMeta(state, patch), questions: event.questions },
    effects: [
      { kind: "set-questions", questions: event.questions },
      { kind: "patch-meta", patch },
      { kind: "set-deadline", at: firstQuestionAt },
      { kind: "claim-owner" },
      { kind: "mark-playing" },
      {
        kind: "emit",
        to: ROOM,
        message: {
          event: "game-started",
          deadline: firstQuestionAt,
          ...(mod ? { moderation: mod } : {}),
        },
      },
      ...preloadEffects({ ...state, questions: event.questions }, 0),
      { kind: "arm-timer", at: firstQuestionAt },
    ],
  };
}

/** Whether the open question awards points. */
function currentScored(state: GameState): boolean {
  const q = state.questions[state.meta.qIndex];
  return q ? isScoredType(q.type) : true;
}

function hostNext(
  state: GameState,
  now: number,
  pacing: PacingStrategy,
  ctx: StepContext,
): Transition {
  if (!pacing.hostControlled) return noop(state);
  const mod = moderationOf(state.meta);
  switch (state.meta.phase) {
    case "ready":
      return startCountdown(state, state.meta.qIndex, now, ctx);
    case "starting":
      // Skip the countdown (and any wait for downloads): e.g. a host running
      // the quiz with nobody playing.
      return openQuestion(state, state.meta.qIndex, now, ctx);
    case "question":
      return closeQuestion(state, now, pacing);
    case "closed": {
      // Nothing to reveal (a poll, a word cloud, … without a reveal cue):
      // straight on — it scored nothing, so no answer-result is owed.
      const q = state.questions[state.meta.qIndex];
      if (q && !revealHasPoint(q)) return advance(state, now, pacing, ctx);
      // "Show answer": the answer is always revealed (no longer optional),
      // and the reveal sends every player their answer-result — so no path
      // reaches the scores or the final board without one.
      return reveal(state, now, pacing);
    }
    case "reveal":
      // An unscored question (poll, word cloud, …) changes no score: no
      // standings step after it. Nor after the last question: the final
      // standings come next anyway (and show this question's points).
      if (
        scoresStepPending(mod) &&
        currentScored(state) &&
        state.meta.qIndex + 1 < state.meta.qCount
      ) {
        return showScores(state, false);
      }
      return advance(state, now, pacing, ctx);
    case "scores":
      return advance(state, now, pacing, ctx);
    case "final":
      return noop(state, { kind: "end-game" });
    default:
      return noop(state);
  }
}

function onDeadline(
  state: GameState,
  now: number,
  pacing: PacingStrategy,
  ctx: StepContext,
): Transition {
  const { meta } = state;
  // A paused duel advances for nobody; resuming re-arms what is due.
  if (meta.pausedAt) return noop(state);
  switch (meta.phase) {
    case "starting":
      // Question 1 after "start game", or a moderated game's next question —
      // unless devices are still downloading its sound.
      return (
        waitForDownloads(state, now) ??
        openQuestion(state, meta.qIndex, now, ctx)
      );
    case "question":
      if (!meta.qStartAt) {
        // Legacy meta only — the window and the phase are one write now.
        return openQuestion(state, meta.qIndex, now, ctx);
      }
      if (now >= meta.qDeadline + ANSWER_GRACE_MS) {
        return closeQuestion(state, now, pacing);
      }
      return noop(state);
    case "ready":
    case "closed":
    case "scores":
      // Moderated steps wait on the host; keep the room visible to the sweep.
      return noop(state, { kind: "park-deadline" });
    case "reveal":
      // Only a reveal that ends by itself carries a real deadline. A
      // host-paced one that comes due (its parked entry reached the TTL
      // horizon while the room lived on) is parked again, not advanced.
      if (pacing.revealEndsAt(now) === null) {
        return noop(state, { kind: "park-deadline" });
      }
      return advance(state, now, pacing, ctx);
    default:
      return noop(state, { kind: "clear-deadline" });
  }
}

/** Out of a reveal: the next question, or the final leaderboard. */
function advance(
  state: GameState,
  now: number,
  pacing: PacingStrategy,
  ctx: StepContext,
): Transition {
  const { meta } = state;
  if (meta.qIndex + 1 < meta.qCount) {
    const mod = moderationOf(meta);
    // The get-ready slide opens the round only (before question 1): after a
    // host click on "Next question" another click would add nothing.
    // A question with sound always gets a countdown, so downloads can finish.
    // … unless it has no time limit: those open straight away.
    const nextQ = state.questions[meta.qIndex + 1];
    if (!isUnlimitedTime(nextQ?.timeOut) && (mod || hasPreload(nextQ))) {
      return startCountdown(state, meta.qIndex + 1, now, ctx);
    }
    return openQuestion(state, meta.qIndex + 1, now, ctx);
  }
  return enterFinal(state, pacing);
}

/** Moderated: the get-ready slide before question `index`, until the host starts it. */
function enterReady(state: GameState, index: number): Transition {
  const patch = { phase: "ready" as const, qIndex: index, qDeadline: 0 };
  return {
    state: { ...withMeta(state, patch), answers: {} },
    effects: [
      { kind: "clear-timer" },
      { kind: "park-deadline" },
      { kind: "patch-meta", patch },
      {
        kind: "emit",
        to: ROOM,
        message: {
          event: "phase-change",
          payload: { phase: "ready", qIndex: index },
        },
      },
      ...preloadEffects(state, index),
    ],
  };
}

/** Moderated: the countdown into question `index` (it opens on the deadline). */
function startCountdown(
  state: GameState,
  index: number,
  now: number,
  ctx: StepContext,
): Transition {
  const question = state.questions[index];
  if (!question) return noop(state);
  // No time limit: no countdown either, the question just opens.
  if (isUnlimitedTime(question.timeOut)) {
    return openQuestion(state, index, now, ctx);
  }
  const at = now + START_COUNTDOWN_MS;
  const patch = { phase: "starting" as const, qIndex: index, qDeadline: at };
  return {
    state: { ...withMeta(state, patch), answers: {} },
    effects: [
      { kind: "set-deadline", at },
      { kind: "patch-meta", patch },
      {
        kind: "emit",
        to: ROOM,
        message: {
          event: "phase-change",
          payload: {
            phase: "starting",
            qIndex: index,
          },
          deadline: at,
        },
      },
      { kind: "arm-timer", at },
    ],
  };
}

/**
 * The open question's answer window is over. Unmoderated (and moderated with
 * the answer shown right away) this is the reveal; a moderated game whose
 * host confirms the answer — or that hides answers — waits in "closed".
 */
function closeQuestion(
  state: GameState,
  now: number,
  pacing: PacingStrategy,
): Transition {
  const mod = moderationOf(state.meta);
  if (!mod || !mod.confirmShowAnswer) {
    return reveal(state, now, pacing);
  }
  if (state.meta.phase !== "question") return noop(state);
  const patch = { phase: "closed" as const, qDeadline: 0 };
  return {
    state: withMeta(state, patch),
    effects: [
      { kind: "clear-timer" },
      { kind: "cancel-bot" },
      { kind: "park-deadline" },
      { kind: "patch-meta", patch },
      {
        kind: "emit",
        to: ROOM,
        message: {
          event: "phase-change",
          payload: { phase: "closed", qIndex: state.meta.qIndex },
        },
      },
      // The host screen shows how the room answered before the answer.
      ...closedSummaryEffects(state),
      ...preloadEffects(state, state.meta.qIndex + 1),
    ],
  };
}

/**
 * Moderated: the standings after a question. `sendResults` when the players
 * never got their personal outcome (answers hidden, so no reveal ran);
 * `fromQuestion` when the question closes straight into the scores.
 */
function showScores(
  state: GameState,
  sendResults: boolean,
  fromQuestion = false,
): Transition {
  const { meta, roster, scores, answers } = state;
  const allowed = fromQuestion
    ? meta.phase === "question"
    : meta.phase === "closed" || meta.phase === "reveal";
  if (!allowed) return noop(state);
  const patch = { phase: "scores" as const, qDeadline: 0 };
  const effects: Effect[] = [
    { kind: "clear-timer" },
    { kind: "cancel-bot" },
    { kind: "park-deadline" },
    { kind: "patch-meta", patch },
  ];
  if (sendResults) {
    for (const player of roster) {
      effects.push({
        kind: "emit",
        to: { player: player.id },
        message: {
          event: "answer-result",
          payload: buildAnswerResult(scores, answers, player.id),
        },
      });
    }
  }
  effects.push(
    {
      kind: "emit",
      to: ROOM,
      message: {
        event: "leaderboard",
        payload: {
          entries: buildLeaderboard(scores, roster, answers),
          isFinal: false,
        },
      },
    },
    {
      kind: "emit",
      to: ROOM,
      message: {
        event: "phase-change",
        payload: { phase: "scores", qIndex: meta.qIndex },
      },
    },
    ...preloadEffects(state, meta.qIndex + 1),
  );
  return { state: withMeta(state, patch), effects };
}

function openQuestion(
  state: GameState,
  index: number,
  now: number,
  ctx: StepContext,
): Transition {
  const { meta } = state;
  const question = state.questions[index];
  if (!question) {
    return noop(state, {
      kind: "log",
      level: "error",
      message: `Question ${index} is missing`,
    });
  }
  const deadline = now + question.timeOut * 1000;
  // Answers are taken until the grace runs out; the reveal waits for it.
  const closeAt = deadline + ANSWER_GRACE_MS;

  // Planned into the same meta write as the window: the answer has to be
  // durable for recovery to re-arm it after a restart.
  const plan =
    meta.botId && meta.botTier
      ? planBotAnswer(question, meta.botTier, ctx.random)
      : null;
  const botAnswerAt = plan ? now + plan.delayMs : 0;

  const patch = {
    phase: "question" as const,
    qIndex: index,
    qId: question.id,
    qStartAt: now,
    qDeadline: deadline,
    preloadWaitSince: 0,
    preloadWaitAll: 0,
    ...(plan ? { botAnswer: JSON.stringify(plan.answer), botAnswerAt } : {}),
  };

  // The whole window is durable *before* the broadcast: submitAnswer reads
  // it back from Redis, so a player answering the instant `question-start`
  // lands would otherwise race the write and be turned away as "not
  // started". The schedule entry goes first so the sweeper never reads the
  // previous phase's (already due) entry as this question's.
  const effects: Effect[] = [
    { kind: "set-deadline", at: closeAt },
    { kind: "patch-meta", patch },
    {
      kind: "emit",
      to: ROOM,
      message: {
        event: "question-start",
        payload: {
          index,
          qCount: state.questions.length,
          question: toPublicQuestion(question),
          remainingMs: deadline - now,
        },
        deadline,
      },
    },
    { kind: "arm-timer", at: closeAt },
  ];
  // Armed here rather than at duel start so the bot's timer lives on
  // whichever instance currently owns the game's deadlines.
  if (meta.botId && plan) {
    effects.push({
      kind: "arm-bot",
      botId: meta.botId,
      qIndex: index,
      answer: plan.answer,
      at: botAnswerAt,
    });
  }
  return {
    state: { ...withMeta(state, patch), answers: {} },
    effects,
  };
}

function reveal(
  state: GameState,
  now: number,
  pacing: PacingStrategy,
): Transition {
  const { meta, answers, roster, scores } = state;
  if (meta.phase !== "question" && meta.phase !== "closed") return noop(state);
  const question = state.questions[meta.qIndex];
  if (!question) return noop(state);
  const mod = moderationOf(meta);

  const revealUntil = pacing.revealEndsAt(now);
  const patch = { phase: "reveal" as const, qDeadline: revealUntil ?? 0 };
  const effects: Effect[] = [
    { kind: "clear-timer" },
    { kind: "cancel-bot" },
    { kind: "patch-meta", patch },
    ...(revealUntil !== null
      ? ([
          { kind: "set-deadline", at: revealUntil },
          { kind: "arm-timer", at: revealUntil },
        ] as const)
      : // Waits on the host, but stays visible to the abandon sweep.
        ([{ kind: "park-deadline" }] as const)),
  ];

  // Personal outcomes go to per-player rooms *before* the room broadcast that
  // flips clients into the reveal: arriving after it, a player's own verdict
  // lands on a screen already rendering "no answer" — a flash of the timeout
  // state.
  for (const player of roster) {
    effects.push({
      kind: "emit",
      to: { player: player.id },
      message: {
        event: "answer-result",
        payload: buildAnswerResult(scores, answers, player.id),
      },
    });
  }
  effects.push({
    kind: "emit",
    to: ROOM,
    message: {
      event: "question-end",
      payload: buildReveal(question, meta.qIndex, answers, roster),
    },
  });
  // Running leaderboard so the host screen needs no REST round trip — unless
  // a moderated game shows the standings as a step of its own (or not at all).
  if (leaderboardWithReveal(mod, meta.qIndex + 1 >= meta.qCount)) {
    effects.push({
      kind: "emit",
      to: ROOM,
      message: {
        event: "leaderboard",
        payload: {
          entries: buildLeaderboard(scores, roster, answers),
          isFinal: false,
        },
      },
    });
  }
  // While the room looks at this answer, devices fetch the next sound.
  effects.push(...preloadEffects(state, meta.qIndex + 1));
  return { state: withMeta(state, patch), effects };
}

function enterFinal(state: GameState, pacing: PacingStrategy): Transition {
  // Moderated games may leave the last question from "closed" or "scores".
  if (!["reveal", "closed", "scores"].includes(state.meta.phase)) {
    return noop(state);
  }
  const patch = { phase: "final" as const, qDeadline: 0 };
  const finalEntries = buildLeaderboard(
    state.scores,
    state.roster,
    state.answers,
  );
  const effects: Effect[] = [
    { kind: "clear-timer" },
    // Waits on the host until the game ends; parked so the abandon sweep
    // still sees it (a game that ends here clears the entry straight away).
    { kind: "park-deadline" },
    { kind: "patch-meta", patch },
    {
      kind: "emit",
      to: ROOM,
      message: {
        event: "leaderboard",
        payload: {
          // With the last question's points (`delta`): the host's board
          // re-sorts once more and shows them.
          entries: finalEntries,
          isFinal: true,
          revealInMs: finalRevealMs(finalEntries),
          // The preloaded final song becomes playable now.
          ...(state.meta.finalSoundKey
            ? { finalSoundKey: state.meta.finalSoundKey }
            : {}),
        },
      },
    },
  ];
  if (pacing.endsOnFinal) effects.push({ kind: "end-game" });
  return { state: withMeta(state, patch), effects };
}

/**
 * The host's "answers in" meter, and the early close: a question ends as
 * soon as every *connected* rostered player has answered — unless it takes
 * more than one answer each, when it runs to its deadline (or the host).
 * Needs `questions` loaded for that check.
 */
function onAnswerRecorded(
  state: GameState,
  qIndex: number,
  answered: readonly string[],
): Transition {
  const { meta, roster } = state;
  // An answer that lost a race with the question closing has nothing left
  // to count toward.
  if (meta.phase !== "question" || qIndex !== meta.qIndex) return noop(state);
  const connected = roster.filter((p) => p.connected);
  if (connected.length === 0) return noop(state);

  const effects: Effect[] = [
    {
      kind: "emit",
      to: ROOM,
      message: {
        event: "answer-count",
        payload: { index: qIndex, answered: answered.length },
      },
    },
  ];
  const done = new Set(answered);
  const question = state.questions[qIndex];
  const holdsOpen = question ? acceptsMoreAnswers(question) : false;
  if (!holdsOpen && connected.every((p) => done.has(p.id))) {
    // Closing needs the full state (questions, scores), which the per-answer
    // path doesn't load — so it is a follow-up event with a fresh read.
    effects.push({ kind: "dispatch", event: "close-question", qIndex });
  }
  return { state, effects };
}

/**
 * Keeps the room consistent after a removal or a drop: mid-question the
 * reveal may now be due (the player who left was the last one everyone was
 * waiting on); on a leaderboard screen the row has to disappear.
 */
function onRosterChanged(state: GameState): Transition {
  const { meta } = state;
  if (meta.phase === "question") {
    return onAnswerRecorded(state, meta.qIndex, Object.keys(state.answers));
  }
  if (
    meta.phase === "reveal" ||
    meta.phase === "scores" ||
    meta.phase === "final"
  ) {
    const inReveal = meta.phase !== "final";
    if (
      meta.phase === "reveal" &&
      !leaderboardWithReveal(moderationOf(meta), meta.qIndex + 1 >= meta.qCount)
    ) {
      return noop(state);
    }
    return noop(state, {
      kind: "emit",
      to: ROOM,
      message: {
        event: "leaderboard",
        payload: {
          entries: buildLeaderboard(
            state.scores,
            state.roster,
            inReveal ? state.answers : undefined,
          ),
          isFinal: !inReveal,
        },
      },
    });
  }
  return noop(state);
}

/** Tell the room to download question `index`'s sound clips and picture now (if any). */
function preloadEffects(state: GameState, index: number): Effect[] {
  const urls = preloadUrls(state.questions[index]);
  const images = preloadImageUrls(state.questions[index]);
  return urls.length > 0 || images.length > 0
    ? [
        {
          kind: "emit",
          to: ROOM,
          message: {
            event: "preload",
            payload: {
              qIndex: index,
              urls,
              ...(images.length > 0 ? { images } : {}),
              playOn: state.questions[index]?.audio?.playOn ?? "quiz",
            },
          },
        },
      ]
    : [];
}

/** A device is ignored once its download stops moving this long. */
export const DOWNLOAD_STALL_MS = 4_000;
/** The countdown never waits longer than this for downloads. */
export const DOWNLOAD_MAX_WAIT_MS = 30_000;
const DOWNLOAD_RECHECK_MS = 1_000;

/**
 * The countdown is over, but devices that report downloading the question's
 * sound aren't done: keep counting (re-checking every second) — except for
 * devices that went quiet (no progress for `DOWNLOAD_STALL_MS`), left, or
 * once `DOWNLOAD_MAX_WAIT_MS` have passed, so no one can block the game.
 * Null = go ahead and open the question.
 */
function waitForDownloads(state: GameState, now: number): Transition | null {
  const { meta } = state;
  if (!hasPreload(state.questions[meta.qIndex])) return null;
  const connected = new Set(
    state.roster.filter((p) => p.connected).map((p) => p.id),
  );
  if (meta.hostConnected) connected.add("host");
  const here = Object.entries(state.preloads).filter(([id]) =>
    connected.has(id),
  );
  const pending = here.filter(
    ([, s]) => !s.done && now - s.at < DOWNLOAD_STALL_MS,
  ).length;
  const since = meta.preloadWaitSince || now;
  // The host may lift the time limit ("wait until all are done"); stalled
  // devices are still ignored, so no single phone can hold the room.
  const capped = !meta.preloadWaitAll && now - since >= DOWNLOAD_MAX_WAIT_MS;
  if (pending === 0 || capped) return null;
  const at = now + DOWNLOAD_RECHECK_MS;
  const patch = { preloadWaitSince: since, qDeadline: at };
  return {
    state: withMeta(state, patch),
    effects: [
      { kind: "set-deadline", at },
      { kind: "patch-meta", patch },
      {
        kind: "emit",
        to: ROOM,
        message: {
          event: "phase-change",
          payload: {
            phase: "starting",
            qIndex: meta.qIndex,
            waitingFor: pending,
            downloadDevices: here.length,
            downloadsDone: here.filter(([, s]) => s.done).length,
            ...(meta.preloadWaitAll ? { waitAll: true } : {}),
          },
          deadline: at,
        },
      },
      { kind: "arm-timer", at },
    ],
  };
}

/**
 * The host's answer while the countdown waits for downloads: open the
 * question now, or wait for every device (no `DOWNLOAD_MAX_WAIT_MS`). Only
 * while actually waiting — a late click after the question opened is stale.
 */
function downloadsDecision(
  state: GameState,
  wait: boolean,
  now: number,
  ctx: StepContext,
): Transition {
  const { meta } = state;
  if (meta.phase !== "starting" || !meta.preloadWaitSince) return noop(state);
  if (!wait) return openQuestion(state, meta.qIndex, now, ctx);
  const patch = { preloadWaitAll: 1 };
  return {
    state: withMeta(state, patch),
    effects: [{ kind: "patch-meta", patch }],
  };
}

/** Host only: the tally of the question that just closed (no reveal key). */
function closedSummaryEffects(state: GameState): Effect[] {
  const question = state.questions[state.meta.qIndex];
  if (!question) return [];
  const {
    audioRevealKey: _key,
    fastest: _fastest,
    ...tally
  } = buildReveal(question, state.meta.qIndex, state.answers, state.roster);
  void _key;
  return [
    {
      kind: "emit",
      to: HOST,
      message: { event: "closed-summary", payload: tally },
    },
  ];
}
