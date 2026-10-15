/**
 * Seeds the "Duel Starter Pack" — a public quiz owned by a system user so the
 * duel question pool is never empty — and the starter duel categories, with
 * the pack tagged "General Knowledge". Idempotent: re-running only heals
 * drift (approval, tags, missing categories).
 *
 * Run from packages/prisma:  yarn seed:duel
 */
import { prisma, connectDatabase } from "../dist/index.js";

const SYSTEM_EMAIL = "system@buzrr.local";
const PACK_TITLE = "Duel Starter Pack";

/** Starter duel categories: [slug, name, OKLCH hue]. Empty ones stay hidden
 * from players until they hold a full duel's worth of approved questions. */
const CATEGORIES = [
  ["general-knowledge", "General Knowledge", 200],
  ["science", "Science", 175],
  ["history", "History", 45],
  ["geography", "Geography", 110],
  ["sports", "Sports", 140],
  ["movies-and-tv", "Movies & TV", 350],
  ["music", "Music", 290],
  ["tech-trivia", "Tech Trivia", 230],
  ["programming", "Programming", 215],
  ["math-and-logic", "Math & Logic", 60],
  ["literature", "Literature", 80],
  ["art-and-design", "Art & Design", 340],
  ["food-and-drink", "Food & Drink", 35],
  ["space", "Space", 250],
  ["mythology", "Mythology", 300],
  ["video-games", "Video Games", 260],
  ["anime", "Anime", 320],
  ["cricket", "Cricket", 130],
  ["football", "Football", 150],
  ["bollywood", "Bollywood", 10],
];
const PACK_CATEGORY = "general-knowledge";

const QUESTIONS = [
  {
    title: "What is the largest planet in our solar system?",
    options: ["Jupiter*", "Saturn", "Earth", "Neptune"],
  },
  {
    title: "Which language runs natively in web browsers?",
    options: ["JavaScript*", "Python", "C++", "Java"],
  },
  {
    title: "What is the chemical symbol for gold?",
    options: ["Au*", "Ag", "Go", "Gd"],
  },
  {
    title: "How many continents are there on Earth?",
    options: ["7*", "5", "6", "8"],
  },
  {
    title: "Which ocean is the largest?",
    options: ["Pacific*", "Atlantic", "Indian", "Arctic"],
  },
  {
    title: "What year did the World Wide Web become publicly available?",
    options: ["1991*", "1985", "1995", "2000"],
  },
  {
    title: "Which animal is known as the King of the Jungle?",
    options: ["Lion*", "Tiger", "Elephant", "Gorilla"],
  },
  {
    title: "What is the smallest prime number?",
    options: ["2*", "1", "3", "0"],
  },
  {
    title: "Which country hosts the city of Kyoto?",
    options: ["Japan*", "China", "South Korea", "Thailand"],
  },
  {
    title: "What does CPU stand for?",
    options: [
      "Central Processing Unit*",
      "Computer Power Unit",
      "Central Program Utility",
      "Core Processing Unit",
    ],
  },
];

async function main() {
  await connectDatabase();

  const systemUser = await prisma.user.upsert({
    where: { email: SYSTEM_EMAIL },
    update: {},
    create: {
      email: SYSTEM_EMAIL,
      name: "Buzrr",
      emailVerified: true,
    },
  });

  const existing = await prisma.quiz.findFirst({
    where: { userId: systemUser.id, title: PACK_TITLE },
  });
  if (existing) {
    await prisma.quiz.update({
      where: { id: existing.id },
      data: { isPublic: true },
    });
    // Heals starter-pack rows that drifted (e.g. got reported/unapproved) --
    // this content is trusted/pre-vetted, so it should always be approved with
    // its report tally cleared.
    await prisma.question.updateMany({
      where: { quizId: existing.id },
      data: { moderationStatus: "approved", reportCount: 0 },
    });
    await prisma.questionReport.deleteMany({
      where: { question: { quizId: existing.id } },
    });
    await seedCategories(existing.id, systemUser.id);
    console.log(
      `"${PACK_TITLE}" already seeded (${existing.id}); ensured public.`,
    );
    return;
  }

  const quiz = await prisma.quiz.create({
    data: {
      title: PACK_TITLE,
      description: "General knowledge questions that power 1v1 duels.",
      userId: systemUser.id,
      isPublic: true,
      questions: {
        create: QUESTIONS.map((q, i) => ({
          title: q.title,
          createdById: systemUser.id,
          order: i + 1,
          timeOut: 15,
          moderationStatus: "approved",
          options: {
            create: q.options.map((raw) => ({
              title: raw.replace(/\*$/, ""),
              isCorrect: raw.endsWith("*"),
            })),
          },
        })),
      },
    },
  });
  await seedCategories(quiz.id, systemUser.id);
  console.log(
    `Seeded "${PACK_TITLE}" (${quiz.id}) with ${QUESTIONS.length} questions.`,
  );
}

/** Upserts the starter categories and tags the pack with its category. */
async function seedCategories(quizId, systemUserId) {
  for (const [slug, name, hue] of CATEGORIES) {
    await prisma.category.upsert({
      where: { slug },
      update: {},
      create: { slug, name, hue },
    });
  }
  const category = await prisma.category.findUniqueOrThrow({
    where: { slug: PACK_CATEGORY },
  });
  const questions = await prisma.question.findMany({
    where: { quizId },
    select: { id: true },
  });
  await prisma.questionCategory.createMany({
    data: questions.map((q) => ({ questionId: q.id, categoryId: category.id })),
    skipDuplicates: true,
  });
  await prisma.question.updateMany({
    where: { quizId, createdById: null },
    data: { createdById: systemUserId },
  });
  console.log(`Ensured ${CATEGORIES.length} duel categories.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
