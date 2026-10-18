import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  MAX_CUSTOM_AVATARS,
  avatarSkinSchema,
  type UserPreferences,
} from "@buzrr/contract";
import { PrismaService } from "../../prisma/prisma.service";
import {
  MediaStorage,
  MediaUnavailableError,
  UnsupportedMediaError,
} from "../../common/storage/media-storage";
import { toAvatarPng } from "../../common/storage/image-resize";
import {
  loadSharedAvatars,
  preferencesOf,
} from "../../common/game-look/game-look";

/** A user's defaults (Settings) and own avatar pictures ("Your skin"). */
@Injectable()
export class PreferencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: MediaStorage,
  ) {}

  /** The superadmin's shared avatar skin (empty if not shared). */
  sharedAvatars(): Promise<string[]> {
    return loadSharedAvatars(this.prisma.db);
  }

  async get(userId: string): Promise<UserPreferences> {
    const user = await this.prisma.db.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });
    return preferencesOf(user?.preferences);
  }

  private async save(userId: string, prefs: UserPreferences) {
    await this.prisma.db.user.update({
      where: { id: userId },
      data: { preferences: prefs },
    });
    return prefs;
  }

  async update(
    userId: string,
    patch: {
      defaultSoundSkin?: string;
      defaultAvatarSkin?: string;
      shareCustomAvatars?: boolean;
    },
  ): Promise<UserPreferences> {
    const prefs = await this.get(userId);
    if (patch.shareCustomAvatars !== undefined) {
      const u = await this.prisma.db.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      if (u?.role !== "superadmin") {
        throw new ForbiddenException(
          "Only the superadmin can share an avatar skin with everyone",
        );
      }
      prefs.shareCustomAvatars = patch.shareCustomAvatars;
    }
    if (patch.defaultSoundSkin !== undefined) {
      const s = patch.defaultSoundSkin.trim();
      if (!s || s.length > 64 || s === "default") {
        throw new BadRequestException("Invalid audio skin");
      }
      prefs.defaultSoundSkin = s;
    }
    if (patch.defaultAvatarSkin !== undefined) {
      const parsed = avatarSkinSchema.safeParse(patch.defaultAvatarSkin);
      if (!parsed.success) throw new BadRequestException("Invalid avatar skin");
      prefs.defaultAvatarSkin = parsed.data;
    }
    return this.save(userId, prefs);
  }

  private async store(
    buffer: Buffer,
    mime: string,
    name: string,
    kind: "image" | "avatar",
  ) {
    try {
      return (
        await this.storage.upload(buffer, {
          contentType: mime,
          filename: name,
          kind,
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
  }

  /** Sets (file) or clears (null) the default logo. */
  async setLogo(
    userId: string,
    file: Express.Multer.File | null,
  ): Promise<UserPreferences> {
    const prefs = await this.get(userId);
    const old = prefs.defaultLogo;
    if (file && !file.mimetype.startsWith("image/")) {
      throw new BadRequestException("The logo must be an image");
    }
    prefs.defaultLogo = file
      ? await this.store(file.buffer, file.mimetype, file.originalname, "image")
      : null;
    await this.save(userId, prefs);
    if (old && old !== prefs.defaultLogo) {
      const inUse = await this.prisma.db.quiz.count({ where: { logo: old } });
      if (inUse === 0) await this.storage.remove(old);
    }
    return prefs;
  }

  /** Adds a picture to "Your skin": resized to a square PNG first. */
  async addAvatar(
    userId: string,
    file: Express.Multer.File | undefined,
  ): Promise<UserPreferences> {
    if (!file) throw new BadRequestException("No picture uploaded");
    const prefs = await this.get(userId);
    if (prefs.customAvatars.length >= MAX_CUSTOM_AVATARS) {
      throw new BadRequestException(
        `Your skin holds up to ${MAX_CUSTOM_AVATARS} pictures`,
      );
    }
    let png: Buffer;
    try {
      png = await toAvatarPng(file.buffer);
    } catch {
      throw new BadRequestException(
        "Could not read this picture — try a PNG, JPEG or WebP",
      );
    }
    const url = await this.store(png, "image/png", "avatar.png", "avatar");
    prefs.customAvatars = [...prefs.customAvatars, url];
    return this.save(userId, prefs);
  }

  async removeAvatar(userId: string, url: string): Promise<UserPreferences> {
    const prefs = await this.get(userId);
    if (!prefs.customAvatars.includes(url)) return prefs;
    prefs.customAvatars = prefs.customAvatars.filter((u) => u !== url);
    await this.save(userId, prefs);
    await this.storage.remove(url);
    return prefs;
  }
}
