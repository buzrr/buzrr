import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  soundSlotSchema,
  type SoundSkin,
  type SoundSlot,
} from "@buzrr/contract";
import { PrismaService } from "../../prisma/prisma.service";
import {
  MediaStorage,
  MediaUnavailableError,
  UnsupportedMediaError,
} from "../../common/storage/media-storage";
import { toMp3 } from "../../common/storage/audio-transcode";
import {
  isPlayerAuthUser,
  type AuthUser,
  type JwtRequestUser,
} from "../../common/decorators/current-user.decorator";
import { quizSettingsSchema } from "@buzrr/contract";

type SkinRow = {
  id: string;
  name: string;
  userId: string | null;
  isGlobal: boolean;
  slots: unknown;
};

function slotsOf(raw: unknown): SoundSkin["slots"] {
  const out: SoundSkin["slots"] = {};
  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw)) {
      const slot = soundSlotSchema.safeParse(k);
      if (slot.success && typeof v === "string") out[slot.data] = v;
    }
  }
  return out;
}

const toSkin = (row: SkinRow): SoundSkin => ({
  id: row.id,
  name: row.name,
  isGlobal: row.isGlobal,
  ownerId: row.userId,
  slots: slotsOf(row.slots),
});

/**
 * User sound skins: an uploaded MP3 per game moment. Owners edit their own;
 * admins can offer a skin to everyone (`isGlobal`) and edit global ones.
 */
@Injectable()
export class SoundSkinsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: MediaStorage,
  ) {}

  private async isAdmin(userId: string): Promise<boolean> {
    const u = await this.prisma.db.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    return u?.role === "admin" || u?.role === "superadmin";
  }

  /** The skin, if this user may change it (owner, or admin for global ones). */
  private async editable(user: AuthUser, id: string): Promise<SkinRow> {
    const row = await this.prisma.db.soundSkin.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Sound skin not found");
    if (
      row.userId !== user.userId &&
      !(row.isGlobal && (await this.isAdmin(user.userId)))
    ) {
      throw new ForbiddenException("Not your sound skin");
    }
    return row;
  }

  /** The user's own skins plus every global one. */
  async list(user: AuthUser): Promise<SoundSkin[]> {
    const rows = await this.prisma.db.soundSkin.findMany({
      where: { OR: [{ userId: user.userId }, { isGlobal: true }] },
      orderBy: [{ isGlobal: "desc" }, { createdAt: "asc" }],
    });
    return rows.map(toSkin);
  }

  /**
   * A skin for a game: its owner, anyone signed in for a global one, admins,
   * and players whose current game's quiz plays it. Nobody else learns its
   * files.
   */
  async get(user: JwtRequestUser, id: string): Promise<SoundSkin> {
    const row = await this.prisma.db.soundSkin.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Sound skin not found");
    if (isPlayerAuthUser(user)) {
      const player = await this.prisma.db.player.findUnique({
        where: { id: user.playerId },
        select: { game: { select: { quiz: { select: { settings: true } } } } },
      });
      const settings = quizSettingsSchema.safeParse(
        player?.game?.quiz.settings ?? {},
      );
      if (!settings.success || settings.data.sound.skin !== id) {
        throw new NotFoundException("Sound skin not found");
      }
    } else if (
      row.userId !== user.userId &&
      !row.isGlobal &&
      !(await this.isAdmin(user.userId))
    ) {
      throw new NotFoundException("Sound skin not found");
    }
    return toSkin(row);
  }

  async create(user: AuthUser, name: string): Promise<SoundSkin> {
    const row = await this.prisma.db.soundSkin.create({
      data: {
        name: name.trim().slice(0, 60) || "My sounds",
        userId: user.userId,
      },
    });
    return toSkin(row);
  }

  async update(
    user: AuthUser,
    id: string,
    patch: { name?: string; isGlobal?: boolean },
  ): Promise<SoundSkin> {
    await this.editable(user, id);
    if (patch.isGlobal !== undefined && !(await this.isAdmin(user.userId))) {
      throw new ForbiddenException(
        "Only admins can share a skin with everyone",
      );
    }
    const row = await this.prisma.db.soundSkin.update({
      where: { id },
      data: {
        ...(patch.name !== undefined
          ? { name: patch.name.trim().slice(0, 60) || "My sounds" }
          : {}),
        ...(patch.isGlobal !== undefined ? { isGlobal: patch.isGlobal } : {}),
      },
    });
    return toSkin(row);
  }

  async setSlot(
    user: AuthUser,
    id: string,
    slotRaw: string,
    file: Express.Multer.File | undefined,
  ): Promise<SoundSkin> {
    const slot = this.slot(slotRaw);
    const row = await this.editable(user, id);
    if (!file || file.size === 0) throw new BadRequestException("Missing file");
    let url: string;
    try {
      url = (
        await this.storage.upload(await toMp3(file.buffer), {
          contentType: file.mimetype,
          filename: file.originalname,
          kind: "audio",
        })
      ).url;
    } catch (err) {
      if (err instanceof UnsupportedMediaError) {
        throw new BadRequestException(err.message);
      }
      if (err instanceof MediaUnavailableError) {
        throw new ServiceUnavailableException(err.message);
      }
      throw err;
    }
    const slots = slotsOf(row.slots);
    const old = slots[slot];
    slots[slot] = url;
    const updated = await this.prisma.db.soundSkin.update({
      where: { id },
      data: { slots },
    });
    if (old) await this.storage.remove(old);
    return toSkin(updated);
  }

  async clearSlot(
    user: AuthUser,
    id: string,
    slotRaw: string,
  ): Promise<SoundSkin> {
    const slot = this.slot(slotRaw);
    const row = await this.editable(user, id);
    const slots = slotsOf(row.slots);
    const old = slots[slot];
    delete slots[slot];
    const updated = await this.prisma.db.soundSkin.update({
      where: { id },
      data: { slots },
    });
    if (old) await this.storage.remove(old);
    return toSkin(updated);
  }

  async remove(user: AuthUser, id: string): Promise<void> {
    const row = await this.editable(user, id);
    await this.prisma.db.soundSkin.delete({ where: { id } });
    for (const url of Object.values(slotsOf(row.slots))) {
      await this.storage.remove(url);
    }
  }

  private slot(raw: string): SoundSlot {
    const parsed = soundSlotSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException("Unknown sound slot");
    return parsed.data;
  }
}
