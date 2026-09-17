/**
 * How long past the question's real deadline the server keeps accepting
 * answers. Only answers whose latency-corrected time still falls inside the
 * real window are scored; the grace just gives them time to arrive.
 */
export const ANSWER_GRACE_MS = 300;

/**
 * Upper bound on the round trip credited to a player. A client controls how
 * quickly it acks latency probes, so an uncapped RTT would let it buy time.
 * Half of this is the most an answer can be moved back, which is exactly the
 * grace — nothing arriving after the grace could be credited back in anyway.
 */
export const MAX_CREDITED_RTT_MS = ANSWER_GRACE_MS * 2;

export type AnswerTiming =
  | { accepted: true; timeTakenMs: number }
  | { accepted: false };

/**
 * Decides whether an answer landed inside the question window and how long
 * the player took, using server clocks only. `receivedAt` is when the server
 * got the answer; half the socket's round trip is subtracted to approximate
 * when the player actually answered.
 */
export function resolveAnswerTiming(input: {
  receivedAt: number;
  qStartAt: number;
  qDeadline: number;
  rttMs: number;
}): AnswerTiming {
  const { receivedAt, qStartAt, qDeadline } = input;
  if (receivedAt > qDeadline + ANSWER_GRACE_MS) return { accepted: false };

  const rtt = Math.min(Math.max(input.rttMs, 0), MAX_CREDITED_RTT_MS);
  const answeredAt = receivedAt - rtt / 2;
  if (answeredAt > qDeadline) return { accepted: false };

  return { accepted: true, timeTakenMs: Math.max(0, answeredAt - qStartAt) };
}

/** Median of a non-empty sample set; 0 when there are no samples yet. */
export function median(samples: readonly number[]): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}
