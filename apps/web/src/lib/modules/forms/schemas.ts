import {
  RATING_LABEL_MAX,
  questionTypeSchema,
  ratingScaleSchema,
} from "@buzrr/contract";
import { z } from "zod";

export const createQuizSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
});

export const createAiQuizSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  questions: z.coerce.number().int().min(1).max(15),
  time: z.coerce
    .number()
    .int("Use whole seconds")
    .min(5, "At least 5 seconds")
    .max(600, "At most 600 seconds"),
  difficulty: z.coerce.number().int().min(1).max(5),
  /** How many of each scored type: 0 none, 1 few, 2 medium, 3 many. */
  multipleChoice: z.number().int().min(0).max(3),
  trueFalse: z.number().int().min(0).max(3),
  typeAnswer: z.number().int().min(0).max(3),
});

export const createPlayerSchema = z.object({
  username: z
    .string()
    .min(1, "Name is required")
    .max(30)
    .regex(/^[a-zA-Z0-9_]*$/, "Only letters, numbers, and underscore"),
  profile: z.string().min(1),
});

export const updatePlayerNameSchema = z.object({
  username: z
    .string()
    .min(1)
    .max(30)
    .regex(/^[a-zA-Z0-9_]*$/),
});

const authoredOption = z.object({
  title: z.string(),
  isCorrect: z.boolean(),
});

/**
 * The question editor's values. One shape for every type — the editor keeps
 * each type's settings while the author flips between types — checked per
 * type on submit.
 */
export const addQuestionSchema = z
  .object({
    type: questionTypeSchema,
    title: z.string().trim().min(1, "Write the question"),
    time: z.coerce.number().min(1).optional(),
    options: z.array(authoredOption),
    mcqMulti: z.boolean(),
    pollMulti: z.boolean(),
    cloudMaxAnswers: z.number().int().min(1).max(3),
    cloudMaxLength: z.union([z.literal(20), z.literal(40)]),
    ratingScale: ratingScaleSchema,
    lowLabel: z.string().max(RATING_LABEL_MAX),
    highLabel: z.string().max(RATING_LABEL_MAX),
    textMaxLength: z.union([z.literal(100), z.literal(200), z.literal(500)]),
    allowAnonymous: z.boolean(),
    multipleSubmissions: z.boolean(),
    ignoreTypos: z.boolean(),
    fixedLength: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (
      v.type === "type_answer" &&
      !v.options.some((o) => o.title.trim() !== "")
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: "Add at least one accepted answer",
      });
    }
    if (!["multiple_choice", "true_false", "poll"].includes(v.type)) return;
    v.options.forEach((o, i) => {
      if (o.title.trim() === "") {
        ctx.addIssue({
          code: "custom",
          path: ["options", i, "title"],
          message: "Options can't be empty",
        });
      }
    });
    const correct = v.options.filter((o) => o.isCorrect).length;
    if (
      v.type === "multiple_choice" &&
      (v.mcqMulti ? correct === 0 : correct !== 1)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: v.mcqMulti
          ? "Mark at least one option correct"
          : "Mark the correct option",
      });
    }
    if (v.type === "true_false" && correct !== 1) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: "Mark True or False as the correct answer",
      });
    }
  });

export const createSpaceSchema = z.object({
  name: z.string().min(1, "Give your space a name").max(200),
  description: z.string().max(2000).optional(),
});

export const generateQuestionsSchema = z.object({
  prompt: z.string().min(3, "Describe what you want generated").max(2000),
  count: z.coerce.number().int().min(1).max(30),
});
