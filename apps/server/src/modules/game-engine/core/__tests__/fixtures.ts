import type {
  GameMeta,
  LiveQuestion,
  RosterEntry,
  StoredAnswer,
} from "../../game-engine.types";
import type { Effect, GameState } from "../state";

export const T0 = 1_000_000;

export function question(
  id: string,
  opts: { timeOut?: number; correct?: number } = {},
): LiveQuestion {
  const correct = opts.correct ?? 0;
  return {
    id,
    type: "multiple_choice",
    title: `Question ${id}`,
    media: null,
    mediaType: null,
    timeOut: opts.timeOut ?? 10,
    options: ["a", "b", "c", "d"].map((o, i) => ({
      id: `${id}-${o}`,
      title: o.toUpperCase(),
      isCorrect: i === correct,
    })),
    config: {},
  };
}

export function player(
  id: string,
  opts: Partial<RosterEntry> = {},
): RosterEntry {
  return {
    id,
    name: id.toUpperCase(),
    profilePic: null,
    connected: true,
    lastSeenAt: T0,
    ...opts,
  };
}

export function answer(
  optionId: string,
  opts: Partial<StoredAnswer> = {},
): StoredAnswer {
  return {
    answer: { optionId },
    answeredAt: T0,
    timeTakenMs: 1000,
    isCorrect: false,
    score: 0,
    ...opts,
  };
}

export function meta(overrides: Partial<GameMeta> = {}): GameMeta {
  return {
    sessionId: "session",
    quizId: "quiz",
    quizTitle: "Quiz",
    hostId: "host",
    mode: "classic",
    pacing: "host",
    phase: "lobby",
    rated: false,
    qIndex: 0,
    qId: "",
    qStartAt: 0,
    qDeadline: 0,
    qCount: 0,
    startedAt: 0,
    hostConnected: true,
    hostLastSeenAt: T0,
    ...overrides,
  };
}

/** A duel's meta: hostless and auto-paced. */
export function duelMeta(overrides: Partial<GameMeta> = {}): GameMeta {
  return meta({
    sessionId: "",
    quizId: "",
    hostId: "",
    mode: "duel",
    pacing: "auto",
    rated: true,
    ...overrides,
  });
}

export function state(overrides: Partial<GameState> = {}): GameState {
  return {
    meta: meta(),
    questions: [question("q1"), question("q2")],
    roster: [player("p1"), player("p2")],
    answers: {},
    scores: [],
    ...overrides,
  };
}

/** A game with question `qIndex` open since T0. */
export function questionOpen(
  overrides: Partial<GameState> = {},
  metaOverrides: Partial<GameMeta> = {},
  qIndex = 0,
): GameState {
  const base = state(overrides);
  const q = base.questions[qIndex]!;
  return {
    ...base,
    meta: {
      ...base.meta,
      phase: "question",
      qIndex,
      qId: q.id,
      qCount: base.questions.length,
      qStartAt: T0,
      qDeadline: T0 + q.timeOut * 1000,
      startedAt: T0 - 5000,
      ...metaOverrides,
    },
  };
}

export const kinds = (effects: Effect[]) => effects.map((e) => e.kind);

export function emitted(effects: Effect[]) {
  return effects.flatMap((e) =>
    e.kind === "emit"
      ? [{ to: e.to, event: e.message.event, message: e.message }]
      : [],
  );
}

/** Deterministic randomness for bot plans. */
export const fixedRandom = (value: number) => () => value;
