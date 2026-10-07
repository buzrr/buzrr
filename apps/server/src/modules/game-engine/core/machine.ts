import { ANSWER_GRACE_MS } from "../../../common/utils/answer-timing";
import { planBotAnswer } from "../../../common/utils/duel-bot";
import { toPublicQuestion } from "../../question-types";
import type { LiveQuestion } from "../game-engine.types";
import { pacingFor, type PacingStrategy } from "./pacing";
import {
  ROOM,
  withMeta,
  type Effect,
  type GameState,
  type StatePart,
  type Transition,
} from "./state";
import { buildAnswerResult, buildLeaderboard, buildReveal } from "./views";

/** Countdown shown on clients between "start game" and the first question. */
export const START_COUNTDOWN_MS = 3_200;

/**
 * Inputs to the phase machine. Clients never produce these directly: the
 * shell turns intents (start-game, host-next), timers and stored answers into
 * events.
 */
export type EngineEvent =
  /** The host started a classic lobby; questions come from Postgres. */
  | { type: "start"; questions: LiveQuestion[]; quizTitle: string }
  /** The host's single pacing intent — the machine decides what it means. */
  | { type: "host-next" }
  /** The game's scheduled deadline came due (local timer or sweeper). */
  | { type: "deadline" }
  /** An answer to question `qIndex` was stored. */
  | { type: "answer-recorded"; qIndex: number }
  /** Close the open question now (everyone connected has answered). */
  | { type: "close-question"; qIndex: number }
  /** The roster shrank or a player dropped (kick, ban, leave, disconnect). */
  | { type: "roster-changed" };

/**
 * What the shell must load for each event. `answer-recorded` runs once per
 * answer — the hot path — so it reads only what deciding an early close
 * needs; the close itself is a follow-up `close-question` event with a full
 * load.
 */
export const PARTS_FOR: Record<EngineEvent["type"], readonly StatePart[]> = {
  start: [],
  "host-next": ["questions", "roster", "answers", "scores"],
  deadline: ["questions", "roster", "answers", "scores"],
  "answer-recorded": ["roster", "answers"],
  "close-question": ["questions", "roster", "answers", "scores"],
  "roster-changed": ["roster", "answers", "scores"],
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
      return onAnswerRecorded(state, event.qIndex);
    case "close-question":
      // Only the question that met the early-close condition: if another
      // path already revealed it and opened the next, this is stale.
      return event.qIndex === state.meta.qIndex
        ? reveal(state, now, pacing)
        : noop(state);
    case "roster-changed":
      return onRosterChanged(state);
  }
}

function start(
  state: GameState,
  event: { questions: LiveQuestion[]; quizTitle: string },
  now: number,
): Transition {
  if (state.meta.phase !== "lobby") return noop(state);
  if (event.questions.length === 0) {
    return noop(state, {
      kind: "log",
      level: "error",
      message: "Cannot start: the quiz has no playable questions",
    });
  }
  const firstQuestionAt = now + START_COUNTDOWN_MS;
  const patch = {
    phase: "starting" as const,
    quizTitle: event.quizTitle,
    qCount: event.questions.length,
    startedAt: now,
    qDeadline: firstQuestionAt,
  };
  return {
    state: { ...withMeta(state, patch), questions: event.questions },
    effects: [
      { kind: "set-questions", questions: event.questions },
      { kind: "patch-meta", patch },
      { kind: "set-deadline", at: firstQuestionAt },
      { kind: "claim-owner" },
      { kind: "mark-playing" },
      { kind: "emit", to: ROOM, message: { event: "game-started" } },
      { kind: "arm-timer", at: firstQuestionAt },
    ],
  };
}

function hostNext(
  state: GameState,
  now: number,
  pacing: PacingStrategy,
  ctx: StepContext,
): Transition {
  if (!pacing.hostControlled) return noop(state);
  switch (state.meta.phase) {
    case "question":
      return reveal(state, now, pacing);
    case "reveal":
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
      return openQuestion(state, 0, now, ctx);
    case "question":
      if (!meta.qStartAt) {
        // Legacy meta only — the window and the phase are one write now.
        return openQuestion(state, meta.qIndex, now, ctx);
      }
      if (now >= meta.qDeadline + ANSWER_GRACE_MS) {
        return reveal(state, now, pacing);
      }
      return noop(state);
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
    return openQuestion(state, meta.qIndex + 1, now, ctx);
  }
  return enterFinal(state, pacing);
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
  if (meta.phase !== "question") return noop(state);
  const question = state.questions[meta.qIndex];
  if (!question) return noop(state);

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
      payload: buildReveal(question, meta.qIndex, answers),
    },
  });
  // Running leaderboard so the host screen needs no REST round trip.
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
  return { state: withMeta(state, patch), effects };
}

function enterFinal(state: GameState, pacing: PacingStrategy): Transition {
  if (state.meta.phase !== "reveal") return noop(state);
  const patch = { phase: "final" as const, qDeadline: 0 };
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
          entries: buildLeaderboard(state.scores, state.roster),
          isFinal: true,
        },
      },
    },
  ];
  if (pacing.endsOnFinal) effects.push({ kind: "end-game" });
  return { state: withMeta(state, patch), effects };
}

/**
 * The host's "answers in" meter, and the early close: a question ends as
 * soon as every *connected* rostered player has answered.
 */
function onAnswerRecorded(state: GameState, qIndex: number): Transition {
  const { meta, roster, answers } = state;
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
        payload: { index: qIndex, answered: Object.keys(answers).length },
      },
    },
  ];
  if (connected.every((p) => answers[p.id])) {
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
    return onAnswerRecorded(state, meta.qIndex);
  }
  if (meta.phase === "reveal" || meta.phase === "final") {
    const inReveal = meta.phase === "reveal";
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
