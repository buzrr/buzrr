import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Express } from "express";
import { CloudinaryService } from "../../common/services/cloudinary.service";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthUser } from "../../common/decorators/current-user.decorator";
import { ReorderQuestionsDto } from "./dto/reorder-questions.dto";

type MultipartBody = Record<string, string | undefined>;

@Injectable()
export class QuestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  private async assertQuizOwned(quizId: string, userId: string) {
    const quiz = await this.prisma.db.quiz.findFirst({
      where: { id: quizId, userId },
    });
    if (!quiz) {
      throw new NotFoundException("Unauthorized or quiz not found");
    }
    return quiz;
  }

  async findAllForQuiz(user: AuthUser, quizId: string) {
    await this.assertQuizOwned(quizId, user.userId);
    const questions = await this.prisma.db.question.findMany({
      where: { quizId },
      include: { options: true },
    });
    return { status: 200, questions };
  }

  async reorder(user: AuthUser, dto: ReorderQuestionsDto) {
    const dragQues = await this.prisma.db.question.findUnique({
      where: { id: dto.dragQuesId },
      include: { quiz: true },
    });
    const dropQues = await this.prisma.db.question.findUnique({
      where: { id: dto.dropQuesId },
      include: { quiz: true },
    });
    if (!dragQues || !dropQues) {
      throw new NotFoundException("Question not found");
    }
    if (
      dragQues.quizId !== dropQues.quizId ||
      dragQues.quiz.userId !== user.userId
    ) {
      throw new ForbiddenException("Unauthorized");
    }

    const dragOrder = dragQues.order;
    const dropOrder = dropQues.order;

    await this.prisma.db.question.update({
      where: { id: dto.dragQuesId },
      data: { order: dropOrder },
    });
    await this.prisma.db.question.update({
      where: { id: dto.dropQuesId },
      data: { order: dragOrder },
    });

    return { status: 200, message: "Success" };
  }

  async delete(user: AuthUser, quesId: string): Promise<void> {
    const question = await this.prisma.db.question.findUnique({
      where: { id: quesId },
      include: { quiz: true },
    });
    if (!question) {
      throw new NotFoundException("Question not found");
    }
    if (question.quiz.userId !== user.userId) {
      throw new ForbiddenException("Unauthorized");
    }
    await this.prisma.db.question.delete({ where: { id: quesId } });
  }

  async upsertFromMultipart(
    user: AuthUser,
    quizId: string,
    body: MultipartBody,
    file: Express.Multer.File | undefined,
  ): Promise<void> {
    await this.assertQuizOwned(quizId, user.userId);

    const title = body.title;
    const option1 = body.option1;
    const option2 = body.option2;
    const option3 = body.option3;
    const option4 = body.option4;
    const time = body.time;
    const quesId = body.ques_id?.trim() || undefined;
    const correct_option = body.choose_option;
    const file_link = body.file_link;
    const file_type = body.media_type;

    if (
      !title ||
      !option1 ||
      !option2 ||
      !option3 ||
      !option4 ||
      !correct_option
    ) {
      throw new BadRequestException("Missing required fields");
    }

    const options = [
      { title: option1, isCorrect: correct_option === "a" },
      { title: option2, isCorrect: correct_option === "b" },
      { title: option3, isCorrect: correct_option === "c" },
      { title: option4, isCorrect: correct_option === "d" },
    ];

    let fileLink = "";
    let mediaType = "";

    if (file && file.size > 0) {
      if (file_link) {
        await this.cloudinary.destroyIfPresent(file_link);
      }
      const uploaded = await this.cloudinary.uploadBuffer(file.buffer);
      fileLink = uploaded.url;
      mediaType = uploaded.mediaType;
    } else if (file_link) {
      fileLink = file_link;
      mediaType = file_type ?? "";
    }

    const timeOut = parseInt(time ?? "15", 10) || 15;

    if (quesId) {
      const question = await this.prisma.db.question.findUnique({
        where: { id: quesId },
        include: { quiz: true },
      });
      if (!question || question.quiz.userId !== user.userId) {
        throw new ForbiddenException("Unauthorized");
      }

      await this.prisma.db.question.update({
        where: { id: quesId },
        data: {
          title,
          quizId,
          timeOut,
          media: fileLink || null,
          mediaType: mediaType || null,
        },
      });
      await this.prisma.db.option.deleteMany({ where: { questionId: quesId } });
      await this.prisma.db.option.createMany({
        data: options.map((o) => ({
          title: o.title,
          isCorrect: o.isCorrect,
          questionId: quesId,
        })),
      });
    } else {
      const total_questions = await this.prisma.db.question.findMany({
        where: { quizId },
      });

      await this.prisma.db.question.create({
        data: {
          title,
          options: { create: options },
          quizId,
          timeOut,
          media: fileLink || null,
          mediaType: mediaType || null,
          order: total_questions.length + 1,
        },
      });
    }
  }
}
