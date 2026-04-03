import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthUser } from "../../common/decorators/current-user.decorator";
import { CreateAiQuizDto } from "./dto/create-ai-quiz.dto";
import { CreateQuizDto } from "./dto/create-quiz.dto";

interface ParsedQuestion {
  question: string;
  options: { title: string; isCorrect: boolean }[];
}

function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j]!, array[i]!];
  }
}

function parseQuestions(content: string): ParsedQuestion[] {
  const questions: ParsedQuestion[] = [];
  const questionBlocks = content
    .split("\n\n")
    .filter((block) => block.trim() !== "");

  questionBlocks.forEach((block) => {
    const lines = block.split("\n").filter((line) => line.trim() !== "");
    let question = "";
    const options: { title: string; isCorrect: boolean }[] = [];

    lines.forEach((line) => {
      if (line.startsWith("Question:")) {
        question = line.replace("Question: ", "").trim();
      } else if (line.startsWith("Option")) {
        const option = line.split(": ").slice(1).join(": ").trim();
        options.push({ title: option, isCorrect: false });
      }
    });

    if (question && options.length === 4) {
      options[0]!.isCorrect = true;
      shuffleArray(options);
      questions.push({ question, options });
    }
  });

  return questions;
}

@Injectable()
export class QuizzesService {
  private readonly logger = new Logger(QuizzesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async create(user: AuthUser, dto: CreateQuizDto): Promise<{ quizId: string }> {
    const quiz = await this.prisma.db.quiz.create({
      data: {
        title: dto.title,
        description: dto.description ?? null,
        userId: user.userId,
      },
    });
    return { quizId: quiz.id };
  }

  async delete(user: AuthUser, quizId: string): Promise<void> {
    const result = await this.prisma.db.quiz.deleteMany({
      where: { id: quizId, userId: user.userId },
    });
    if (result.count === 0) {
      throw new NotFoundException("Unauthorized or quiz not found");
    }
  }

  async findAllForUser(user: AuthUser) {
    return this.prisma.db.quiz.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOneForUser(user: AuthUser, quizId: string) {
    const quiz = await this.prisma.db.quiz.findFirst({
      where: { id: quizId, userId: user.userId },
      include: {
        gameSessions: {
          orderBy: { createdAt: "desc" },
        },
        _count: { select: { questions: true } },
      },
    });
    if (!quiz) {
      throw new NotFoundException("Unauthorized or quiz not found");
    }
    return quiz;
  }

  async createWithAi(
    user: AuthUser,
    dto: CreateAiQuizDto,
  ): Promise<{ msg: string; quizId: string }> {
    const apiKey = this.config.get<string>("GEMINI_API_KEY");
    if (!apiKey) {
      throw new BadRequestException("GEMINI_API_KEY is not configured");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `Create a multiple choice question for the following description: ${dto.description}.
        The question should have 4 options and the correct answer should be the first option.
        Give the response in the following format:
        Question: question-text?
        Option 1: option1-text
        Option 2: option2-text
        Option 3: option3-text
        Option 4: option4-text
        don't add any extra text other than the question and options.
        Generate a total of ${dto.questions} questions only`;

    let result: Awaited<ReturnType<typeof model.generateContent>>;
    try {
      result = await model.generateContent(prompt);
    } catch (err) {
      this.logger.debug(
        `Gemini generateContent failed: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
      const msg = err instanceof Error ? err.message : String(err);
      const lower = msg.toLowerCase();
      const isTimeout =
        lower.includes("timeout") || lower.includes("timed out");
      if (isTimeout) {
        throw new ServiceUnavailableException(
          "The AI service took too long to respond. Please try again.",
        );
      }
      throw new BadGatewayException(
        "The AI service failed to generate questions. Please try again later.",
      );
    }

    const response = result.response.text();
    const questionsArray = parseQuestions(response);

    if (questionsArray.length < dto.questions) {
      throw new BadRequestException(
        "Couldn't generate enough questions. Try again with different parameters.",
      );
    }

    const quiz = await this.prisma.db.$transaction(async (tx) => {
      return tx.quiz.create({
        data: {
          title: dto.title,
          description: dto.description,
          userId: user.userId,
          questions: {
            create: questionsArray
              .slice(0, dto.questions)
              .map((q: ParsedQuestion, index: number) => ({
                title: q.question,
                options: { create: q.options },
                timeOut: dto.time,
                order: index + 1,
              })),
          },
        },
      });
    });

    return { msg: "Quiz created successfully", quizId: quiz.id };
  }
}
