/**
 * How long past the question's real deadline the server keeps accepting
 * answers. It is a flat, server-side allowance — identical for every player —
 * that covers the trip the answer spent on the wire. Answers landing inside it
 * score as if they arrived exactly on the deadline, so the grace buys arrival
 * time, never points.
 */
export const ANSWER_GRACE_MS = 300;

export type AnswerTiming =
  | { accepted: true; timeTakenMs: number }
  | { accepted: false };

/**
 * Decides whether an answer landed inside the question window and how long the
 * player took, using server clocks only. `receivedAt` is when the server got
 * the answer. Nothing the client reports or controls — its clock, its ack
 * speed — takes part: a per-socket round-trip correction would be a number the
 * client can inflate to buy time and score, so the fixed grace above stands in
 * for it.
 */
export function resolveAnswerTiming(input: {
  receivedAt: number;
  qStartAt: number;
  qDeadline: number;
}): AnswerTiming {
  const { receivedAt, qStartAt, qDeadline } = input;
  if (receivedAt > qDeadline + ANSWER_GRACE_MS) return { accepted: false };

  // Clamped to the deadline: an answer that used the grace is scored at the
  // end of the real window, the least credit the question can give.
  const answeredAt = Math.min(receivedAt, qDeadline);
  return { accepted: true, timeTakenMs: Math.max(0, answeredAt - qStartAt) };
}
