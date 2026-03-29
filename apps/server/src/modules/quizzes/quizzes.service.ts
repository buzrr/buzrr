import {
  BadRequestException,
  Injectable,
  NotFoundException,
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

    if (question && options.length > 0) {
      options[0]!.isCorrect = true;
      shuffleArray(options);
      questions.push({ question, options });
    }
  });

  return questions;
}

@Injectable()
export class QuizzesService {
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
    const quiz = await this.prisma.db.quiz.findFirst({
      where: { id: quizId, userId: user.userId },
    });
    if (!quiz) {
      throw new NotFoundException("Unauthorized or quiz not found");
    }
    await this.prisma.db.quiz.delete({ where: { id: quizId } });
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

    const result = await model.generateContent(prompt);
    const response = result.response.text();
    const questionsArray = parseQuestions(response);

    if (questionsArray.length < dto.questions) {
      throw new BadRequestException(
        "Couldn't generate enough questions. Try again with different parameters.",
      );
    }

    const quiz = await this.prisma.db.quiz.create({
      data: {
        title: dto.title,
        description: dto.description,
        userId: user.userId,
      },
    });

    const questionsData = questionsArray.map(
      (q: ParsedQuestion, index: number) => ({
        title: q.question,
        options: { create: q.options },
        quizId: quiz.id,
        timeOut: dto.time,
        order: index + 1,
      }),
    );

    await this.prisma.db.$transaction(
      questionsData.map((data) =>
        this.prisma.db.question.create({ data }),
      ),
    );

    return { msg: "Quiz created successfully", quizId: quiz.id };
  }
}
