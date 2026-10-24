/** The scored types the AI generator writes, and how much of each. */
export const AI_TYPES = ["multipleChoice", "trueFalse", "typeAnswer"] as const;
export type AiType = (typeof AI_TYPES)[number];

/** 0 = none, 1 = few, 2 = some, 3 = many. */
export type AiAmount = 0 | 1 | 2 | 3;
export type AiMix = Record<AiType, AiAmount>;

export const DEFAULT_AI_MIX: AiMix = {
  multipleChoice: 3,
  trueFalse: 1,
  typeAnswer: 1,
};

const WEIGHT: Record<AiAmount, number> = { 0: 0, 1: 1, 2: 2, 3: 4 };

/**
 * How many questions of each type: `total` split by weight (largest
 * remainder), every chosen type at least one while there are enough
 * questions. Nothing chosen counts as multiple choice only.
 */
export function allocateTypes(
  total: number,
  mix: AiMix,
): Record<AiType, number> {
  const chosen = AI_TYPES.filter((t) => mix[t] > 0);
  const types = chosen.length > 0 ? chosen : (["multipleChoice"] as AiType[]);
  const weights = types.map((t) => WEIGHT[mix[t]] || 1);
  const sum = weights.reduce((s, w) => s + w, 0);
  const exact = weights.map((w) => (total * w) / sum);
  const counts = exact.map(Math.floor);
  let left = total - counts.reduce((s, c) => s + c, 0);
  // The largest remainders first; ties go to the heavier type.
  const order = exact
    .map((x, i) => ({ i, r: x - Math.floor(x), w: weights[i]! }))
    .sort((a, b) => b.r - a.r || b.w - a.w);
  for (const { i } of order) {
    if (left === 0) break;
    counts[i]!++;
    left--;
  }
  // Every chosen type gets one, taken from the largest.
  if (total >= types.length) {
    for (let i = 0; i < counts.length; i++) {
      if (counts[i] === 0) {
        const max = counts.indexOf(Math.max(...counts));
        counts[max]!--;
        counts[i] = 1;
      }
    }
  }
  const out: Record<AiType, number> = {
    multipleChoice: 0,
    trueFalse: 0,
    typeAnswer: 0,
  };
  types.forEach((t, i) => (out[t] = counts[i]!));
  return out;
}
