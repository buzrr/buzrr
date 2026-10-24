import { randomUUID } from "node:crypto";
import type Redis from "ioredis";
import {
  Logger,
  type OnApplicationBootstrap,
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  DEFAULT_QUESTION_TYPE,
  DEFAULT_TIME_OUT,
  authoredOptionSchema,
  type AuthoredOption,
  type CreateStandaloneQuestions,
} from "@buzrr/contract";
import {
  MediaStorage,
  MediaUnavailableError,
  UnsupportedMediaError,
} from "../../common/storage/media-storage";
import { cutClip, toMp3 } from "../../common/storage/audio-transcode";
import { encryptClip } from "../../common/storage/clip-crypto";
import {
  QUESTION_IMAGE_MAX,
  imageType,
  shrinkImage,
} from "../../common/storage/image-resize";
import { stripAssetSignature } from "../../common/storage/asset-signing";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthUser } from "../../common/decorators/current-user.decorator";
import {
  isDuelEligible,
  QuestionDefinitionError,
  validateDefinition,
} from "../question-types";
import { CategoriesService } from "../categories/categories.service";
import { ReorderQuestionsDto } from "./dto/reorder-questions.dto";
import { REDIS } from "../../redis/redis.constants";
import { inAuthoredOrder, OPTION_ORDER } from "../../common/utils/option-order";

type MultipartBody = Record<string, string | undefined>;

/** How long the reveal clip plays (from the reveal cue). */
const REVEAL_CLIP_MS = 15_000;

function parseJsonField(raw: string | undefined, field: string): unknown {
  if (raw === undefined || raw.trim() === "") return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    throw new BadRequestException(`${field} must be valid JSON`);
  }
}

/**
 * Options from a multipart body: either `options` (a JSON array of
 * `{ title, isCorrect }`, any type) or the original four-option form fields
 * (`option1`–`option4` + `choose_option` a–d) the multiple-choice editor
 * still sends.
 */
function optionsFromMultipart(body: MultipartBody): AuthoredOption[] {
  const json = parseJsonField(body.options, "options");
  if (json !== undefined) {
    const parsed = authoredOptionSchema.array().safeParse(json);
    if (!parsed.success) {
      throw new BadRequestException("options must be [{ title, isCorrect }]");
    }
    return parsed.data;
  }

  const titles = [body.option1, body.option2, body.option3, body.option4];
  const correctKey = body.choose_option?.trim().toLowerCase();
  if (titles.some((t) => !t) || !correctKey) {
    throw new BadRequestException("Missing required fields");
  }
  const keys = ["a", "b", "c", "d"];
  if (!keys.includes(correctKey)) {
    throw new BadRequestException("choose_option must be a, b, c, or d");
  }
  return titles.map((title, i) => ({
    title: title ?? "",
    isCorrect: keys[i] === correctKey,
  }));
}

/**
 * Who may edit or delete a question: its author, or the owner of the quiz it
 * belongs to.
 */
function ownsQuestion(
  question: { createdById: string | null; quiz: { userId: string } | null },
  userId: string,
): boolean {
  return question.createdById === userId || question.quiz?.userId === userId;
}

@Injectable()
export class QuestionsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(QuestionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: MediaStorage,
    private readonly categories: CategoriesService,
    @Optional() @Inject(REDIS) private readonly redis?: Redis,
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
      include: { options: { orderBy: OPTION_ORDER } },
      orderBy: { order: "asc" },
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
      !dragQues.quiz ||
      dragQues.quizId !== dropQues.quizId ||
      dragQues.quiz.userId !== user.userId
    ) {
      // Standalone questions have no order to change.
      throw new ForbiddenException("Unauthorized");
    }

    const dragOrder = dragQues.order;
    const dropOrder = dropQues.order;
    if (dragOrder === dropOrder) {
      return { status: 200, message: "Success" };
    }

    // Insert-at-position semantics: the dragged question takes the drop
    // slot and everything between shifts by one.
    const quizId = dragQues.quizId;
    await this.prisma.db.$transaction([
      dragOrder < dropOrder
        ? this.prisma.db.question.updateMany({
            where: { quizId, order: { gt: dragOrder, lte: dropOrder } },
            data: { order: { decrement: 1 } },
          })
        : this.prisma.db.question.updateMany({
            where: { quizId, order: { gte: dropOrder, lt: dragOrder } },
            data: { order: { increment: 1 } },
          }),
      this.prisma.db.question.update({
        where: { id: dto.dragQuesId },
        data: { order: dropOrder },
      }),
    ]);

    return { status: 200, message: "Success" };
  }

  /** Disables (skipped in games and counts) or re-enables a question. */
  async setDisabled(
    user: AuthUser,
    quesId: string,
    disabled: boolean,
  ): Promise<{ id: string; disabled: boolean }> {
    const question = await this.prisma.db.question.findUnique({
      where: { id: quesId },
      include: { quiz: true },
    });
    if (!question) {
      throw new NotFoundException("Question not found");
    }
    if (!ownsQuestion(question, user.userId)) {
      throw new ForbiddenException("Unauthorized");
    }
    await this.prisma.db.question.update({
      where: { id: quesId },
      data: { disabled },
    });
    await this.touchQuiz(question.quizId);
    return { id: quesId, disabled };
  }

  async delete(user: AuthUser, quesId: string): Promise<void> {
    const question = await this.prisma.db.question.findUnique({
      where: { id: quesId },
      include: { quiz: true },
    });
    if (!question) {
      throw new NotFoundException("Question not found");
    }
    if (!ownsQuestion(question, user.userId)) {
      throw new ForbiddenException("Unauthorized");
    }
    const deletedOrder = question.order;
    const quizId = question.quizId;
    if (!quizId) {
      await this.prisma.db.question.delete({ where: { id: quesId } });
      return;
    }
    await this.prisma.db.$transaction([
      this.prisma.db.question.delete({ where: { id: quesId } }),
      this.prisma.db.question.updateMany({
        where: { quizId, order: { gt: deletedOrder } },
        data: { order: { decrement: 1 } },
      }),
    ]);
    await this.touchQuiz(quizId);
  }

  /** A question changed: the quiz counts as updated (quiz list order). */
  async touchQuiz(quizId: string | null | undefined): Promise<void> {
    if (!quizId) return;
    await this.prisma.db.quiz
      .update({ where: { id: quizId }, data: { updatedAt: new Date() } })
      .catch(() => undefined);
  }

  async upsertFromMultipart(
    user: AuthUser,
    quizId: string,
    body: MultipartBody,
    file: Express.Multer.File | undefined,
    audioFile?: Express.Multer.File,
  ): Promise<void> {
    const quiz = await this.assertQuizOwned(quizId, user.userId);

    const title = body.title?.trim();
    const time = body.time;
    const quesId = body.ques_id?.trim() || undefined;
    // Links sent back by the editor are signed; the database keeps them bare.
    const file_link = body.file_link
      ? stripAssetSignature(body.file_link)
      : body.file_link;
    const file_type = body.media_type;
    const type = body.type?.trim() || DEFAULT_QUESTION_TYPE;

    if (!title) {
      throw new BadRequestException("Missing required fields");
    }

    // The question's type owns what valid content looks like.
    let definition;
    try {
      definition = validateDefinition(type, {
        options: optionsFromMultipart(body),
        config: parseJsonField(body.config, "config") ?? {},
      });
    } catch (err) {
      if (err instanceof QuestionDefinitionError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }
    // Categories are admin-only (Duel Portal); an edit keeps whatever
    // categories an admin set, and a `categoryIds` field here is ignored.
    const { options, config } = definition;

    // Ownership first: the old media we may delete below is the edited
    // question's own, read from the database.
    let existing: {
      media: string | null;
      audio: string | null;
      audioStartMs: number | null;
      audioRevealMs: number | null;
      timeOut: number;
      audioClip: string | null;
      audioClipKey: string | null;
      audioRevealClip: string | null;
      audioRevealKey: string | null;
      mediaClip: string | null;
      mediaKey: string | null;
    } | null = null;
    if (quesId) {
      const question = await this.prisma.db.question.findUnique({
        where: { id: quesId },
        include: { quiz: true },
      });
      // Edits stay in the quiz named by the URL: no moving a question to
      // another quiz, or pulling a standalone one into a quiz.
      if (
        !question ||
        question.quizId !== quizId ||
        !ownsQuestion(question, user.userId)
      ) {
        throw new ForbiddenException("Unauthorized");
      }
      existing = question;
    }

    let fileLink = "";
    let mediaType = "";

    const store = async (
      upload: Express.Multer.File,
      kind: "image" | "audio",
    ) => {
      try {
        return await this.storage.upload(upload.buffer, {
          contentType: upload.mimetype,
          filename: upload.originalname,
          kind,
        });
      } catch (err) {
        if (err instanceof UnsupportedMediaError) {
          throw new BadRequestException(err.message);
        }
        if (err instanceof MediaUnavailableError) {
          throw new ServiceUnavailableException(err.message);
        }
        throw err;
      }
    };

    // Sound: a new upload replaces it, `audio_link` keeps a URL (normally the
    // stored one), neither means the question has none.
    let audio: string | null = null;
    let audioMp3: Buffer | null = null;
    if (audioFile && audioFile.size > 0) {
      audioMp3 = await toMp3(audioFile.buffer);
      audio = (await store({ ...audioFile, buffer: audioMp3 }, "audio")).url;
    } else if (body.audio_link && /^https?:\/\//.test(body.audio_link)) {
      audio = stripAssetSignature(body.audio_link);
    }
    const cueMs = (raw: string | undefined) => {
      const n = parseInt(raw ?? "", 10);
      return Number.isFinite(n) && n >= 0 ? Math.min(n, 86_400_000) : null;
    };
    const audioFields = {
      audio,
      audioStartMs: audio ? (cueMs(body.audio_start_ms) ?? 0) : null,
      audioRevealMs: audio ? cueMs(body.audio_reveal_ms) : null,
      // null = like the quiz's sound setting
      audioPlayOn:
        audio &&
        ["host", "players", "both", "off"].includes(body.audio_play_on ?? "")
          ? body.audio_play_on!
          : null,
    };

    // A new picture is stored scaled down: every device in a room loads it.
    let picture: Buffer | null = null;
    if (file && file.size > 0) {
      picture = await shrinkImage(file.buffer, QUESTION_IMAGE_MAX);
      const uploaded = await store(
        {
          ...file,
          buffer: picture,
          mimetype:
            picture === file.buffer ? file.mimetype : imageType(picture),
        },
        "image",
      );
      fileLink = uploaded.url;
      mediaType = uploaded.mediaType;
    } else if (file_link) {
      fileLink = file_link;
      mediaType = file_type ?? "";
    }

    const pictureClip = await this.mediaClip(
      fileLink || null,
      mediaType,
      picture,
      existing,
    );
    const timeOut = parseInt(time ?? "", 10) || DEFAULT_TIME_OUT;
    const clips = await this.audioClips(
      audio,
      audioMp3,
      audioFields.audioStartMs,
      audioFields.audioRevealMs,
      timeOut,
      existing,
    );
    // Any create/edit re-enters the moderation queue if the quiz is public --
    // approved content doesn't stay approved across an edit, since the
    // reviewed text may have changed. Moderation only feeds the duel pool, so
    // content duels can't play (polls, multi-answer questions, …) skips the
    // queue and stays out of it.
    const moderationStatus = !quiz.isPublic
      ? "draft"
      : isDuelEligible(type, definition)
        ? "pending"
        : "unapproved";

    if (quesId) {
      await this.prisma.db.$transaction(async (tx) => {
        await tx.question.update({
          where: { id: quesId },
          data: {
            title,
            type,
            config,
            quizId,
            timeOut,
            media: fileLink || null,
            mediaType: mediaType || null,
            ...pictureClip.fields,
            ...audioFields,
            ...clips.fields,
            moderationStatus,
            reportCount: 0,
          },
        });
        await tx.option.deleteMany({ where: { questionId: quesId } });
        await tx.option.createMany({
          data: inAuthoredOrder(
            options.map((o) => ({
              title: o.title,
              isCorrect: o.isCorrect,
              questionId: quesId,
            })),
          ),
        });
        await tx.questionReport.deleteMany({ where: { questionId: quesId } });
      });
      // Only now, and only the question's own stored media — never a URL
      // the client sent (`file_link`), which could name anyone's upload.
      if (existing?.media && existing.media !== fileLink) {
        await this.removeUnused(existing.media);
      }
      if (existing?.audio && existing.audio !== audio) {
        await this.removeUnused(existing.audio);
      }
      for (const old of [...clips.replaced, ...pictureClip.replaced]) {
        await this.removeUnused(old);
      }
    } else {
      await this.prisma.db.$transaction(async (tx) => {
        const count = await tx.question.count({ where: { quizId } });
        await tx.question.create({
          data: {
            title,
            type,
            config,
            options: { create: inAuthoredOrder(options) },
            quizId,
            timeOut,
            media: fileLink || null,
            mediaType: mediaType || null,
            ...pictureClip.fields,
            ...audioFields,
            ...clips.fields,
            order: count + 1,
            moderationStatus,
            createdById: user.userId,
          },
        });
      });
    }
  }

  /**
   * The picture as devices load it ahead of time: an encrypted copy of the
   * image (the key only goes out with `question-start`). Kept when the
   * picture didn't change; `replaced` lists the old copy to delete.
   */
  private async mediaClip(
    media: string | null,
    mediaType: string,
    freshImage: Buffer | null,
    existing: {
      media: string | null;
      mediaClip: string | null;
      mediaKey: string | null;
    } | null,
  ) {
    const old = existing?.mediaClip ? [existing.mediaClip] : [];
    const none = { mediaClip: null, mediaKey: null };
    if (!media || mediaType !== "image") return { fields: none, replaced: old };
    if (
      !freshImage &&
      existing?.media === media &&
      existing.mediaClip &&
      existing.mediaKey
    ) {
      return {
        fields: { mediaClip: existing.mediaClip, mediaKey: existing.mediaKey },
        replaced: [],
      };
    }
    // A fresh upload is scaled down already; a stored picture is here.
    const source =
      freshImage ??
      (await this.storage
        .read(media)
        .then((b) => (b ? shrinkImage(b, QUESTION_IMAGE_MAX) : null)));
    // A picture we can't read (an external link) shows as before.
    if (!source) return { fields: none, replaced: old };
    const { blob, key } = encryptClip(source);
    const { url } = await this.storage.upload(blob, {
      contentType: "application/octet-stream",
      kind: "encrypted",
    });
    return { fields: { mediaClip: url, mediaKey: key }, replaced: old };
  }

  /**
   * Pictures stored before they were encrypted for preloading: their copy,
   * once, in the background after start.
   */
  async backfillMediaClips(log: (msg: string) => void): Promise<void> {
    const rows = await this.prisma.db.question.findMany({
      where: { mediaType: "image", media: { not: null }, mediaClip: null },
      select: { id: true, media: true },
    });
    let made = 0;
    for (const row of rows) {
      const source = await this.storage.read(row.media!).catch(() => null);
      if (!source) continue;
      const { blob, key } = encryptClip(
        await shrinkImage(source, QUESTION_IMAGE_MAX),
      );
      const { url } = await this.storage.upload(blob, {
        contentType: "application/octet-stream",
        kind: "encrypted",
      });
      await this.prisma.db.question.update({
        where: { id: row.id },
        data: { mediaClip: url, mediaKey: key },
      });
      made++;
    }
    if (made > 0) log(`Encrypted ${made} question pictures for preloading`);
  }

  /**
   * Preload copies made before pictures were scaled down (or scaled down to
   * WebP): remade once per installation from a scaled-down JPEG / PNG (the
   * stored picture stays).
   * The old copies are left in place — a game running across a restart
   * may still load them.
   */
  async shrinkMediaClips(log: (msg: string) => void): Promise<void> {
    if (!this.redis) return;
    const done = "media-clips:shrunk:v2";
    if (await this.redis.get(done)) return;
    // One instance does it.
    const lock = await this.redis.set(`${done}:lock`, "1", "EX", 3600, "NX");
    if (lock !== "OK") return;
    const rows = await this.prisma.db.question.findMany({
      where: {
        mediaType: "image",
        media: { not: null },
        mediaClip: { not: null },
      },
      select: { id: true, media: true },
    });
    let made = 0;
    for (const row of rows) {
      const source = await this.storage.read(row.media!).catch(() => null);
      if (!source) continue;
      // Always remade: the first run's copies were WebP, which older Safari
      // can't show.
      const small = await shrinkImage(source, QUESTION_IMAGE_MAX);
      const { blob, key } = encryptClip(small);
      const { url } = await this.storage.upload(blob, {
        contentType: "application/octet-stream",
        kind: "encrypted",
      });
      await this.prisma.db.question.update({
        where: { id: row.id },
        data: { mediaClip: url, mediaKey: key },
      });
      made++;
    }
    await this.redis.set(done, new Date().toISOString());
    if (made > 0) log(`Scaled down ${made} question pictures for preloading`);
  }

  onApplicationBootstrap(): void {
    setTimeout(() => {
      this.backfillMediaClips((m) => this.logger.log(m))
        .then(() => this.shrinkMediaClips((m) => this.logger.log(m)))
        .catch((err) =>
          this.logger.error("Encrypting question pictures failed", err),
        );
    }, 15_000).unref();
  }

  /**
   * The encrypted clips devices load for a question's sound: the window that
   * plays while it is open (start cue, the question's time) and the reveal
   * window (reveal cue, 15 s). Re-cut only when the sound, a cue or the time
   * changed (or clips are missing); `replaced` lists the old files to delete
   * once the question row points at the new ones.
   */
  private async audioClips(
    audio: string | null,
    freshMp3: Buffer | null,
    startMs: number | null,
    revealMs: number | null,
    timeOut: number,
    existing: {
      media: string | null;
      audio: string | null;
      audioStartMs: number | null;
      audioRevealMs: number | null;
      timeOut: number;
      audioClip: string | null;
      audioClipKey: string | null;
      audioRevealClip: string | null;
      audioRevealKey: string | null;
    } | null,
  ) {
    const old = [existing?.audioClip, existing?.audioRevealClip].filter(
      (u): u is string => Boolean(u),
    );
    const none = {
      audioClip: null,
      audioClipKey: null,
      audioRevealClip: null,
      audioRevealKey: null,
    };
    if (!audio) return { fields: none, replaced: old };
    const unchanged =
      !freshMp3 &&
      existing?.audio === audio &&
      existing.audioClip &&
      existing.audioStartMs === startMs &&
      existing.audioRevealMs === revealMs &&
      existing.timeOut === timeOut &&
      (revealMs === null || existing.audioRevealClip);
    if (unchanged && existing) {
      return {
        fields: {
          audioClip: existing.audioClip,
          audioClipKey: existing.audioClipKey,
          audioRevealClip: existing.audioRevealClip,
          audioRevealKey: existing.audioRevealKey,
        },
        replaced: [],
      };
    }
    const source = freshMp3 ?? (await this.storage.read(audio));
    // An external link we can't read plays as before: the whole file.
    if (!source) return { fields: none, replaced: old };
    const put = async (clip: Buffer) => {
      const { blob, key } = encryptClip(clip);
      const { url } = await this.storage.upload(blob, {
        contentType: "application/octet-stream",
        kind: "encrypted",
      });
      return { url, key };
    };
    const q = await put(await cutClip(source, startMs ?? 0, timeOut * 1000));
    const r =
      revealMs === null
        ? null
        : await put(await cutClip(source, revealMs, REVEAL_CLIP_MS));
    return {
      fields: {
        audioClip: q.url,
        audioClipKey: q.key,
        audioRevealClip: r?.url ?? null,
        audioRevealKey: r?.key ?? null,
      },
      replaced: old,
    };
  }

  /**
   * Standalone questions (no quiz) — duel-pool content, e.g. a bulk upload.
   * They skip the quiz-only `draft` state and go straight to moderation;
   * content duels can't play is parked as `unapproved`.
   */
  async createStandalone(
    user: AuthUser,
    body: CreateStandaloneQuestions,
  ): Promise<{ created: number; ids: string[] }> {
    const questions = body.questions.map((question, index) => {
      try {
        const definition = validateDefinition(question.type, {
          options: question.options,
          config: question.config,
        });
        return { ...question, ...definition };
      } catch (err) {
        if (err instanceof QuestionDefinitionError) {
          throw new BadRequestException(
            `Question ${index + 1}: ${err.message}`,
          );
        }
        throw err;
      }
    });
    await this.categories.assertExist(
      questions.flatMap((q) => q.categoryIds ?? []),
    );

    // Three bulk inserts in one batch transaction rather than a nested create
    // per question: up to 500 sequential nested creates over a remote link
    // outlived the interactive-transaction timeout, whose mid-write rollback
    // surfaced as a foreign key error on the children.
    const rows = questions.map((question) => ({
      ...question,
      id: randomUUID(),
    }));
    // Options are read back ordered by createdAt; distinct timestamps keep
    // the authored order.
    const base = Date.now();
    await this.prisma.db.$transaction([
      this.prisma.db.question.createMany({
        data: rows.map((question) => ({
          id: question.id,
          type: question.type,
          title: question.title,
          config: question.config,
          timeOut: question.timeOut ?? DEFAULT_TIME_OUT,
          createdById: user.userId,
          moderationStatus: isDuelEligible(question.type, question)
            ? "pending"
            : "unapproved",
        })),
      }),
      this.prisma.db.option.createMany({
        data: rows.flatMap((question) =>
          question.options.map((option, index) => ({
            questionId: question.id,
            title: option.title,
            isCorrect: option.isCorrect,
            createdAt: new Date(base + index),
          })),
        ),
      }),
      this.prisma.db.questionCategory.createMany({
        data: rows.flatMap((question) =>
          [...new Set(question.categoryIds ?? [])].map((categoryId) => ({
            questionId: question.id,
            categoryId,
          })),
        ),
      }),
    ]);
    const ids = rows.map((question) => question.id);
    return { created: ids.length, ids };
  }

  /**
   * Removes an upload unless another question still uses it — duplicated
   * quizzes share their files with the original.
   */
  private async removeUnused(url: string): Promise<void> {
    const questions = await this.prisma.db.question.count({
      where: {
        OR: [
          { media: url },
          { audio: url },
          { audioClip: url },
          { mediaClip: url },
          { audioRevealClip: url },
        ],
      },
    });
    if (questions === 0) await this.storage.remove(url);
  }
}
