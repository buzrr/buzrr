/**
 * Seeds the "Duel Starter Pack" — a public quiz owned by a system user so the
 * duel question pool is never empty. Idempotent: re-running updates nothing
 * if the pack already exists.
 *
 * Run from packages/prisma:  yarn seed:duel
 */
import { prisma, connectDatabase } from "../dist/index.js";

const SYSTEM_EMAIL = "system@buzrr.local";
const PACK_TITLE = "Duel Starter Pack";

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
    console.log(`"${PACK_TITLE}" already seeded (${existing.id}); ensured public.`);
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
          order: i + 1,
          timeOut: 15,
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
  console.log(`Seeded "${PACK_TITLE}" (${quiz.id}) with ${QUESTIONS.length} questions.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
