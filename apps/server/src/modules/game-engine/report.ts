import type {
  LeaderboardEntry,
  QuestionAnswer,
  ReportPlayer,
  ReportQuestion,
  SessionReport,
} from "@buzrr/contract";
import { isScored } from "../question-types";
import type {
  LiveQuestion,
  RosterEntry,
  StoredAnswer,
} from "./game-engine.types";

// Pure: builds the Pro session report from a game's questions, roster, final
// standings and every stored answer. Used live (final leaderboard, from
// Redis) and at game end (snapshotted onto GameResult.report).

/** Most free-text tallies (words, open text) a question lists. */
const MAX_FREE_TALLIES = 8;

export interface SessionReportInput {
  quizTitle: string;
  gameCode: string;
  startedAt: number;
  endedAt: number | null;
  questions: LiveQuestion[];
  roster: RosterEntry[];
  /** Final standings, rank order. */
  entries: LeaderboardEntry[];
  /** Per question index: stored answers keyed by playerId. */
  answers: Record<string, StoredAnswer>[];
  now?: number;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Answers as display strings, one per thing the player picked or wrote. */
function answerParts(question: LiveQuestion, answer: QuestionAnswer): string[] {
  const titleOf = (id: string) =>
    question.options.find((o) => o.id === id)?.title ?? "?";
  if ("optionId" in answer) return [titleOf(answer.optionId)];
  if ("optionIds" in answer) return answer.optionIds.map(titleOf);
  if ("words" in answer) return answer.words;
  if ("text" in answer) return [answer.text];
  if ("entries" in answer) return answer.entries.map((e) => e.text);
  if (typeof answer.value === "boolean") {
    return [answer.value ? "True" : "False"];
  }
  return [String(answer.value)];
}

function tally(labels: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const label of labels) {
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return counts;
}

function questionBreakdown(
  question: LiveQuestion,
  answers: StoredAnswer[],
): ReportQuestion["breakdown"] {
  const scored = isScored(question.type);
  const picks = answers.flatMap((a) => answerParts(question, a.answer));
  const counts = tally(picks);

  if (question.options.length > 0) {
    // Every option, even the ones nobody picked, in authored order.
    return question.options.map((o) => ({
      label: o.title,
      count: counts.get(o.title) ?? 0,
      ...(scored ? { isCorrect: o.isCorrect } : {}),
    }));
  }
  if (question.type === "true_false") {
    const key = (question.config as { answer?: unknown }).answer;
    return ["True", "False"].map((label) => ({
      label,
      count: counts.get(label) ?? 0,
      ...(typeof key === "boolean"
        ? { isCorrect: key === (label === "True") }
        : {}),
    }));
  }
  // Ratings and free text: most frequent first. Free text compares
  // case-insensitively so "Paris" and "paris" count together.
  const normalised =
    question.type === "rating"
      ? counts
      : tally(picks.map((p) => p.trim().toLowerCase()));
  return [...normalised.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MAX_FREE_TALLIES)
    .map(([label, count]) => ({ label, count }));
}

export function buildSessionReport(input: SessionReportInput): SessionReport {
  const { questions, entries } = input;
  const playerCount = entries.length;
  const rosterById = new Map(input.roster.map((p) => [p.id, p]));
  // Only players on the final board count: a kicked or departed player's
  // answers stay stored, but they are not in `playerCount`.
  const onBoard = new Set(entries.map((e) => e.playerId));
  const kept = input.answers.map((byPlayer) =>
    Object.fromEntries(
      Object.entries(byPlayer).filter(([id]) => onBoard.has(id)),
    ),
  );
  const answersFor = (i: number): Record<string, StoredAnswer> => kept[i] ?? {};
  const scoredIdx = questions
    .map((q, i) => (isScored(q.type) ? i : -1))
    .filter((i) => i >= 0);

  const reportQuestions: ReportQuestion[] = questions.map((question, index) => {
    const answers = Object.values(answersFor(index));
    const scored = isScored(question.type);
    const ratings =
      question.type === "rating"
        ? answers
            .map((a) => ("value" in a.answer ? a.answer.value : null))
            .filter((v): v is number => typeof v === "number")
        : [];
    return {
      index,
      title: question.title,
      type: question.type,
      scored,
      answered: answers.length,
      correct: scored ? answers.filter((a) => a.isCorrect).length : null,
      avgTimeMs: mean(answers.map((a) => a.timeTakenMs)),
      breakdown: questionBreakdown(question, answers),
      average: mean(ratings),
    };
  });

  const players: ReportPlayer[] = entries.map((entry) => {
    const rows = questions.map((question, index) => {
      const a = answersFor(index)[entry.playerId];
      const scored = isScored(question.type);
      return {
        index,
        answer: a ? answerParts(question, a.answer).join(", ") : null,
        isCorrect: a && scored ? a.isCorrect : null,
        timeMs: a ? a.timeTakenMs : null,
        points: a?.score ?? 0,
      };
    });
    const given = rows.filter((r) => r.answer !== null);
    const correctTimes = rows
      .filter((r) => r.isCorrect === true && r.timeMs !== null)
      .map((r) => r.timeMs!);
    const correct = rows.filter((r) => r.isCorrect === true).length;
    return {
      name: entry.name,
      profilePic:
        entry.profilePic ?? rosterById.get(entry.playerId)?.profilePic ?? null,
      rank: entry.rank,
      score: entry.score,
      answered: given.length,
      correct,
      accuracy: scoredIdx.length > 0 ? correct / scoredIdx.length : null,
      avgTimeMs: mean(given.map((r) => r.timeMs!)),
      fastestCorrectMs:
        correctTimes.length > 0 ? Math.min(...correctTimes) : null,
      answers: rows,
    };
  });

  const allAnswers = questions.flatMap((_, i) => Object.values(answersFor(i)));
  const scoredCorrect = scoredIdx.reduce(
    (sum, i) =>
      sum + Object.values(answersFor(i)).filter((a) => a.isCorrect).length,
    0,
  );
  const slots = playerCount * questions.length;

  return {
    quizTitle: input.quizTitle,
    gameCode: input.gameCode,
    startedAt: new Date(input.startedAt).toISOString(),
    endedAt: input.endedAt ? new Date(input.endedAt).toISOString() : null,
    generatedAt: new Date(input.now ?? Date.now()).toISOString(),
    playerCount,
    questionCount: questions.length,
    scoredQuestionCount: scoredIdx.length,
    avgScore: mean(entries.map((e) => e.score)) ?? 0,
    accuracy:
      scoredIdx.length > 0 && playerCount > 0
        ? scoredCorrect / (scoredIdx.length * playerCount)
        : null,
    avgTimeMs: mean(allAnswers.map((a) => a.timeTakenMs)),
    participation: slots > 0 ? Math.min(1, allAnswers.length / slots) : 0,
    questions: reportQuestions,
    players,
  };
}
