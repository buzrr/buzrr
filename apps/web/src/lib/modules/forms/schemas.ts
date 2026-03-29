import { z } from "zod";

export const createQuizSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
});

export const createAiQuizSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  questions: z.coerce.number().int().min(1).max(15),
  time: z.coerce.number().int().min(1),
});

export const createPlayerSchema = z.object({
  username: z
    .string()
    .min(1, "Name is required")
    .max(30)
    .regex(/^[a-zA-Z0-9_]*$/, "Only letters, numbers, and underscore"),
  profile: z.string().min(1),
});

export const joinRoomSchema = z.object({
  gameCode: z.string().min(1, "Room code is required"),
});

export const updatePlayerNameSchema = z.object({
  username: z
    .string()
    .min(1)
    .max(30)
    .regex(/^[a-zA-Z0-9_]*$/),
});

export const hostQuizSchema = z.object({
  quizId: z.string().min(1),
});

const optionLetter = z.enum(["a", "b", "c", "d"]);

export const addQuestionSchema = z.object({
  title: z.string().min(1),
  option1: z.string().min(1),
  option2: z.string().min(1),
  option3: z.string().min(1),
  option4: z.string().min(1),
  choose_option: optionLetter,
  time: z.coerce.number().min(1).optional(),
});
