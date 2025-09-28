"use server";
import { prisma } from "@/utils/prisma";

export default async function submitAnswer({
  gameSessionId,
  playerId,
  optionId,
  timeTaken,
}: {
  gameSessionId: string;
  playerId: string;
  optionId: string;
  timeTaken: number;
}) {
  try {
    const option = await prisma.option.findUnique({
      where: {
        id: optionId,
      },
      include: {
        question: true,
      },
    });

    let score = option?.isCorrect ? 1000 : 0;

    // reduce score based on time taken and question time limit if correct answer
    if (option?.isCorrect) {
      const question = option.question;
      const timeLimit = question?.timeOut as number;

      if (timeTaken < timeLimit) {
        score -= (timeTaken / timeLimit) * 900;
      } else {
        score = 100;
      }
    }

    // Store the answer in the database
    const prevAns = await prisma.playerAnswer.findUnique({
      where: {
        playerId_questionId_gameSessionId: {
          playerId: playerId,
          questionId: option?.questionId as string,
          gameSessionId: gameSessionId,
        },
      },
    });

    if (!prevAns) {
      await prisma.playerAnswer.create({
        data: {
          playerId: playerId,
          questionId: option?.questionId as string,
          gameSessionId: gameSessionId,
          optionId: optionId,
          timeTaken: timeTaken,
          isCorrect: option?.isCorrect as boolean,
          score: score,
        },
      });
    } else {
      await prisma.playerAnswer.update({
        where: {
          playerId_questionId_gameSessionId: {
            playerId: playerId,
            questionId: option?.questionId as string,
            gameSessionId: gameSessionId,
          },
        },
        data: {
          optionId: optionId,
          timeTaken: timeTaken,
          isCorrect: option?.isCorrect as boolean,
          score: score,
        },
      });
    }

    const prevScore = prevAns ? prevAns.score : 0;
    const newScore = score - prevScore;

    // Update player score in leaderboard
    const leaderboard = await prisma.gameLeaderboard.findUnique({
      where: {
        playerId_gameSessionId: {
          playerId: playerId,
          gameSessionId: gameSessionId,
        },
      },
    });

    if (leaderboard) {
      await prisma.gameLeaderboard.update({
        where: {
          playerId_gameSessionId: {
            playerId: playerId,
            gameSessionId: gameSessionId,
          },
        },
        data: {
          score: leaderboard.score + newScore,
        },
      });
    } else {
      await prisma.gameLeaderboard.create({
        data: {
          playerId: playerId,
          gameSessionId: gameSessionId,
          score: newScore,
        },
      });
    }
  } catch (error) {
    throw new Error("Error Submitting Answer");
  }
}
