import type { AuthoredOption, QuestionAnswer } from "@buzrr/contract";
import type { z } from "zod";
import { QuestionDefinitionError } from "../question-type";

/** Trims option titles and checks the count and that none is empty. */
export function checkOptions(
  options: AuthoredOption[],
  { min, max, label }: { min: number; max: number; label: string },
): AuthoredOption[] {
  const trimmed = options.map((o) => ({
    title: o.title.trim(),
    isCorrect: o.isCorrect,
  }));
  if (trimmed.length < min || trimmed.length > max) {
    throw new QuestionDefinitionError(
      min === max
        ? `A ${label} question needs exactly ${min} options`
        : `A ${label} question needs ${min}–${max} options`,
    );
  }
  if (trimmed.some((o) => o.title === "")) {
    throw new QuestionDefinitionError("Options can't be empty");
  }
  return trimmed;
}

/** Types without options take none — a stray one is an authoring mistake. */
export function checkNoOptions(
  options: AuthoredOption[],
  label: string,
): AuthoredOption[] {
  if (options.length > 0) {
    throw new QuestionDefinitionError(`A ${label} question has no options`);
  }
  return [];
}

export function parseConfig<S extends z.ZodType>(
  schema: S,
  config: unknown,
  label: string,
): z.infer<S> {
  const parsed = schema.safeParse(config ?? {});
  if (!parsed.success) {
    throw new QuestionDefinitionError(`Invalid ${label} settings`);
  }
  return parsed.data;
}

/** The option ids an answer picked; none for answers that aren't options. */
export function pickedOptionIds(answer: QuestionAnswer): string[] {
  if ("optionId" in answer) return [answer.optionId];
  if ("optionIds" in answer) return answer.optionIds;
  return [];
}

/** How many answers picked each option, in option order. */
export function countOptions(
  options: { id: string }[],
  answers: QuestionAnswer[],
): number[] {
  const counts = new Map<string, number>();
  for (const answer of answers) {
    for (const id of new Set(pickedOptionIds(answer))) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return options.map((o) => counts.get(o.id) ?? 0);
}

export function pickOne<T>(items: readonly T[], random: () => number): T {
  return items[Math.floor(random() * items.length)] ?? items[0]!;
}
