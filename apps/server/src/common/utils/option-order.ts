/**
 * Options are read in `createdAt` order. Rows written in one statement
 * would all share a timestamp, so each option is stamped one millisecond
 * after the one before it: the authored order (the editor's drag, its
 * shuffle, the AI's shuffle) is the order players see.
 */
export function inAuthoredOrder<T extends object>(
  options: readonly T[],
  base = Date.now(),
): (T & { createdAt: Date })[] {
  return options.map((option, index) => ({
    ...option,
    createdAt: new Date(base + index),
  }));
}

/** How option rows are read back in their authored order. */
export const OPTION_ORDER = { createdAt: "asc" } as const;
