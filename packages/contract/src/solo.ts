import type { PublicQuestion } from "./question-types";
import type { QuestionStats } from "./report";
import type {
  AnswerResultPayload,
  QuestionEndPayload,
  SoundSettings,
} from "./socket";

// ---------------------------------------------------------------------------
// "Play alone" (tests): a quiz played by each player on their own, at their
// own pace, over REST — see ADR-016. The question and result payloads are
// the live game's, so the player screens render them unchanged.
// ---------------------------------------------------------------------------

/** What the link shows before starting (public). */
export interface SoloTestInfo {
  code: string;
  title: string;
  questionCount: number;
  hostName: string | null;
  hostImage: string | null;
  /** ISO time; null = open until the host closes it. */
  closesAt: string | null;
  closed: boolean;
  /**
   * The quiz's sounds (skin resolved). Played on the player's device unless
   * they are off altogether ("host" / "players" mean nothing here).
   */
  sound: SoundSettings;
}

/** One player's run through a test, as their screen shows it. */
export interface SoloView {
  attemptId: string;
  /** intro: not started · question: one open · reveal: answered · done. */
  phase: "intro" | "question" | "reveal" | "done";
  qIndex: number;
  qCount: number;
  /** The open (question) or just answered (reveal) question. */
  question?: PublicQuestion;
  /** Time left on the open question. */
  remainingMs?: number;
  /** The player's result for the question (reveal) or their standing. */
  you?: AnswerResultPayload;
  /** The question's solution (reveal). */
  reveal?: QuestionEndPayload;
  totalScore: number;
  correctCount: number;
  /** Once done: the place among everyone who finished so far. */
  final?: { rank: number; of: number };
}

/** A test in the host's list. */
export interface SoloTestItem {
  id: string;
  code: string;
  quizId: string | null;
  title: string;
  questionCount: number;
  closesAt: string | null;
  closed: boolean;
  createdAt: string;
  /** Players who started / finished. */
  started: number;
  finished: number;
}

/** The host's report on a test: standings (finished first) and questions. */
export interface SoloTestReport {
  test: SoloTestItem;
  entries: {
    rank: number;
    name: string;
    profilePic: string | null;
    score: number;
    correctCount: number;
    finished: boolean;
    /** Questions answered (or timed out) so far. */
    progress: number;
  }[];
  questions: QuestionStats[];
}
