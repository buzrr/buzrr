import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  BUILTIN_DEFAULT_OPTIONS,
  BUILTIN_SOUND_SKINS,
  CUE_SLOTS,
  soundSkinOptionsSchema,
  soundSlotSchema,
  type BuiltinSoundOptions,
  type SoundSkin,
  type SoundSkinOptions,
  type SoundSlot,
} from "@buzrr/contract";
import { Prisma } from "@buzrr/prisma";
import { PrismaService } from "../../prisma/prisma.service";
import {
  MediaStorage,
  MediaUnavailableError,
  UnsupportedMediaError,
} from "../../common/storage/media-storage";
import {
  cutClip,
  toMp3,
  toPlayerMp3,
} from "../../common/storage/audio-transcode";
import { encryptClip } from "../../common/storage/clip-crypto";
import { finalClipOf } from "./final-clip";
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
  playerSlots?: unknown;
  options?: unknown;
  finalClip?: unknown;
};

/** Longest final song kept for devices (re-encoded small). */
const FINAL_CLIP_MS = 5 * 60 * 1000;

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

/** Stored options, cleaned (a bad entry is dropped, not fatal). */
function optionsOf(raw: unknown): SoundSkinOptions {
  const out: SoundSkinOptions = {};
  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw)) {
      const parsed = soundSkinOptionsSchema.safeParse({ [k]: v });
      if (parsed.success) Object.assign(out, parsed.data);
    }
  }
  return out;
}

/** Players' devices get the small copies (where made); the host the originals. */
function playerView(
  slots: SoundSkin["slots"],
  small: unknown,
): SoundSkin["slots"] {
  const smallSlots = slotsOf(small);
  const out: SoundSkin["slots"] = {};
  for (const [k, url] of Object.entries(slots) as [SoundSlot, string][]) {
    out[k] = smallSlots[k] ?? url;
  }
  return out;
}

const toSkin = (row: SkinRow, forPlayer = false): SoundSkin => ({
  id: row.id,
  name: row.name,
  isGlobal: row.isGlobal,
  ownerId: row.userId,
  slots: forPlayer
    ? playerView(slotsOf(row.slots), row.playerSlots)
    : slotsOf(row.slots),
  options: optionsOf(row.options),
  // The URL only — the key never leaves with the skin.
  finalClipUrl: finalClipOf(row.finalClip)?.url ?? null,
});

/**
 * User sound skins: an uploaded MP3 per game moment. Owners edit their own;
 * admins can offer a skin to everyone (`isGlobal`) and edit global ones.
 */
@Injectable()
export class SoundSkinsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SoundSkinsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: MediaStorage,
  ) {}

  /** Small player copies for files that have none yet (once, in the background). */
  onApplicationBootstrap(): void {
    setTimeout(() => {
      this.backfillPlayerSlots((m) => this.logger.log(m)).catch((err) =>
        this.logger.error("Making small sound files failed", err),
      );
    }, 10_000).unref();
  }

  /** Only the superadmin shares skins with everyone (and edits shared ones). */
  private async isSuperadmin(userId: string): Promise<boolean> {
    const u = await this.prisma.db.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    return u?.role === "superadmin";
  }

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
      !(row.isGlobal && (await this.isSuperadmin(user.userId)))
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
    return rows.map((r) => toSkin(r));
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
    const skin = toSkin(row, isPlayerAuthUser(user));
    // Players get the final song only as the encrypted clip.
    if (isPlayerAuthUser(user) && skin.finalClipUrl) delete skin.slots.final;
    return skin;
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
    patch: { name?: string; isGlobal?: boolean; options?: SoundSkinOptions },
  ): Promise<SoundSkin> {
    await this.editable(user, id);
    if (
      patch.isGlobal !== undefined &&
      !(await this.isSuperadmin(user.userId))
    ) {
      throw new ForbiddenException(
        "Only the superadmin can share a skin with everyone",
      );
    }
    const row = await this.prisma.db.soundSkin.update({
      where: { id },
      data: {
        ...(patch.name !== undefined
          ? { name: patch.name.trim().slice(0, 60) || "My sounds" }
          : {}),
        ...(patch.isGlobal !== undefined ? { isGlobal: patch.isGlobal } : {}),
        ...(patch.options !== undefined
          ? { options: patch.options as Prisma.InputJsonValue }
          : {}),
      },
    });
    return toSkin(row);
  }

  /**
   * Every built-in skin's options and files (anyone signed in or playing):
   * the superadmin's, else the defaults from the code.
   */
  async builtinOptions(forPlayer = false): Promise<BuiltinSoundOptions> {
    const rows = await this.prisma.db.builtinSoundOptions.findMany();
    const byId = new Map(rows.map((r) => [r.skinId, r]));
    const out: BuiltinSoundOptions = {};
    for (const id of BUILTIN_SOUND_SKINS) {
      const r = byId.get(id);
      const defaults = BUILTIN_DEFAULT_OPTIONS[id] ?? {};
      out[id] = {
        options: r ? optionsOf(r.options) : defaults,
        defaults,
        slots: forPlayer
          ? playerView(slotsOf(r?.slots), r?.playerSlots)
          : slotsOf(r?.slots),
      };
    }
    return out;
  }

  private async assertSuperadmin(user: AuthUser, skinId: string) {
    const u = await this.prisma.db.user.findUnique({
      where: { id: user.userId },
      select: { role: true },
    });
    if (u?.role !== "superadmin") {
      throw new ForbiddenException(
        "Only the superadmin can change the built-in skins",
      );
    }
    if (!(BUILTIN_SOUND_SKINS as readonly string[]).includes(skinId)) {
      throw new NotFoundException("Sound skin not found");
    }
  }

  /** Superadmin: a built-in skin's options back to its defaults. */
  async resetBuiltinOptions(
    user: AuthUser,
    skinId: string,
  ): Promise<BuiltinSoundOptions> {
    await this.assertSuperadmin(user, skinId);
    const defaults = (BUILTIN_DEFAULT_OPTIONS[
      skinId as keyof typeof BUILTIN_DEFAULT_OPTIONS
    ] ?? {}) as Prisma.InputJsonValue;
    await this.prisma.db.builtinSoundOptions.upsert({
      where: { skinId },
      create: { skinId, options: defaults },
      update: { options: defaults },
    });
    return this.builtinOptions();
  }

  /**
   * A copy of a built-in skin as the user's own: its files copied (so either
   * can change or delete its own), its current options, `name`. Slots the
   * built-in plays synthesized stay empty; cues keep the built-in's sound.
   */
  async cloneBuiltin(
    user: AuthUser,
    skinId: string,
    name: string,
  ): Promise<SoundSkin> {
    if (!(BUILTIN_SOUND_SKINS as readonly string[]).includes(skinId)) {
      throw new NotFoundException("Sound skin not found");
    }
    const row = await this.prisma.db.builtinSoundOptions.findUnique({
      where: { skinId },
    });
    const files = slotsOf(row?.slots);
    const slots: SoundSkin["slots"] = {};
    const smallSlots: SoundSkin["slots"] = {};
    let finalClip: { url: string; key: string } | null = null;
    try {
      for (const [slot, url] of Object.entries(files) as [
        SoundSlot,
        string,
      ][]) {
        const buf = await this.storage.read(url);
        if (!buf) continue;
        slots[slot] = (
          await this.storage.upload(buf, {
            contentType: "audio/mpeg",
            kind: "audio",
          })
        ).url;
        smallSlots[slot] = (
          await this.storage.upload(await toPlayerMp3(buf), {
            contentType: "audio/mpeg",
            kind: "audio",
          })
        ).url;
        if (slot === "final") {
          const { blob, key } = encryptClip(
            await cutClip(buf, 0, FINAL_CLIP_MS),
          );
          const stored = await this.storage.upload(blob, {
            contentType: "application/octet-stream",
            kind: "encrypted",
          });
          finalClip = { url: stored.url, key };
        }
      }
    } catch (err) {
      if (err instanceof MediaUnavailableError) {
        throw new ServiceUnavailableException(err.message);
      }
      throw err;
    }
    // The built-in's lobby cues, explicitly (a clone has no cue files).
    const options: SoundSkinOptions = {
      ...(row
        ? optionsOf(row.options)
        : BUILTIN_DEFAULT_OPTIONS[
            skinId as keyof typeof BUILTIN_DEFAULT_OPTIONS
          ]),
    };
    for (const cue of CUE_SLOTS) {
      if (!slots[cue]) {
        options[cue] = {
          ...options[cue],
          source: skinId as "builtin:show" | "builtin:arcade" | "builtin:chill",
        };
      }
    }
    const created = await this.prisma.db.soundSkin.create({
      data: {
        name: name.trim().slice(0, 60) || "My sounds",
        userId: user.userId,
        slots,
        playerSlots: smallSlots,
        options: options as Prisma.InputJsonValue,
        ...(finalClip ? { finalClip } : {}),
      },
    });
    return toSkin(created);
  }

  /** Superadmin only: one built-in skin's options, for everyone. */
  async setBuiltinOptions(
    user: AuthUser,
    skinId: string,
    options: SoundSkinOptions,
  ): Promise<BuiltinSoundOptions> {
    await this.assertSuperadmin(user, skinId);
    const json = options as Prisma.InputJsonValue;
    await this.prisma.db.builtinSoundOptions.upsert({
      where: { skinId },
      create: { skinId, options: json },
      update: { options: json },
    });
    return this.builtinOptions();
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
    let playerUrl: string;
    let finalClip: { url: string; key: string } | null = null;
    try {
      const mp3 = await toMp3(file.buffer);
      url = (
        await this.storage.upload(mp3, {
          contentType: file.mimetype,
          filename: file.originalname,
          kind: "audio",
        })
      ).url;
      // Players' devices load a small copy; the host plays this one.
      playerUrl = (
        await this.storage.upload(await toPlayerMp3(mp3), {
          contentType: "audio/mpeg",
          kind: "audio",
        })
      ).url;
      if (slot === "final") {
        // Devices download the final song during the game, encrypted.
        const { blob, key } = encryptClip(await cutClip(mp3, 0, FINAL_CLIP_MS));
        const stored = await this.storage.upload(blob, {
          contentType: "application/octet-stream",
          kind: "encrypted",
        });
        finalClip = { url: stored.url, key };
      }
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
    const small = slotsOf(row.playerSlots);
    const old = slots[slot];
    const oldSmall = small[slot];
    slots[slot] = url;
    small[slot] = playerUrl;
    const oldFinal = slot === "final" ? finalClipOf(row.finalClip) : null;
    const updated = await this.prisma.db.soundSkin.update({
      where: { id },
      data: {
        slots,
        playerSlots: small,
        ...(slot === "final" ? { finalClip: finalClip ?? Prisma.DbNull } : {}),
      },
    });
    if (old) await this.storage.remove(old);
    if (oldSmall) await this.storage.remove(oldSmall);
    if (oldFinal) await this.storage.remove(oldFinal.url);
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
    const small = slotsOf(row.playerSlots);
    const old = slots[slot];
    const oldSmall = small[slot];
    delete slots[slot];
    delete small[slot];
    const oldFinal = slot === "final" ? finalClipOf(row.finalClip) : null;
    const updated = await this.prisma.db.soundSkin.update({
      where: { id },
      data: {
        slots,
        playerSlots: small,
        ...(slot === "final" ? { finalClip: Prisma.DbNull } : {}),
      },
    });
    if (old) await this.storage.remove(old);
    if (oldSmall) await this.storage.remove(oldSmall);
    if (oldFinal) await this.storage.remove(oldFinal.url);
    return toSkin(updated);
  }

  async remove(user: AuthUser, id: string): Promise<void> {
    const row = await this.editable(user, id);
    await this.prisma.db.soundSkin.delete({ where: { id } });
    const final = finalClipOf(row.finalClip);
    if (final) await this.storage.remove(final.url);
    for (const url of [
      ...Object.values(slotsOf(row.slots)),
      ...Object.values(slotsOf(row.playerSlots)),
    ]) {
      await this.storage.remove(url);
    }
  }

  /**
   * Skin files that have no small copy for players yet (uploaded before
   * there were any, and built-in skins' files): made once, one after the
   * other, in the background after start.
   */
  async backfillPlayerSlots(log: (msg: string) => void): Promise<void> {
    const small = async (url: string): Promise<string | null> => {
      const buf = await this.storage.read(url);
      if (!buf) return null;
      return (
        await this.storage.upload(await toPlayerMp3(buf), {
          contentType: "audio/mpeg",
          kind: "audio",
        })
      ).url;
    };
    let made = 0;
    for (const row of await this.prisma.db.soundSkin.findMany()) {
      const slots = slotsOf(row.slots);
      const have = slotsOf(row.playerSlots);
      const missing = (Object.keys(slots) as SoundSlot[]).filter(
        (k) => !have[k],
      );
      if (missing.length === 0) continue;
      for (const k of missing) {
        const url = await small(slots[k]!).catch(() => null);
        if (url) have[k] = url;
      }
      await this.prisma.db.soundSkin.update({
        where: { id: row.id },
        data: { playerSlots: have },
      });
      made += missing.length;
    }
    for (const row of await this.prisma.db.builtinSoundOptions.findMany()) {
      const slots = slotsOf(row.slots);
      const have = slotsOf(row.playerSlots);
      const missing = (Object.keys(slots) as SoundSlot[]).filter(
        (k) => !have[k],
      );
      if (missing.length === 0) continue;
      for (const k of missing) {
        const url = await small(slots[k]!).catch(() => null);
        if (url) have[k] = url;
      }
      await this.prisma.db.builtinSoundOptions.update({
        where: { skinId: row.skinId },
        data: { playerSlots: have },
      });
      made += missing.length;
    }
    if (made > 0) log(`Made ${made} small sound files for players`);
  }

  private slot(raw: string): SoundSlot {
    const parsed = soundSlotSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException("Unknown sound slot");
    return parsed.data;
  }
}
