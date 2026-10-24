import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { nanoid } from "nanoid";
import { sniffAudio, sniffImage } from "./image-sniff";
import {
  MediaStorage,
  type StoredMedia,
  type UploadMeta,
} from "./media-storage";

/** URL path the API serves local uploads under (see main.ts). */
export const LOCAL_UPLOADS_ROUTE = "/uploads";

/**
 * Uploads on the API server's own disk, served back by the API at
 * `/uploads/*`. Needs nothing external — the "runs offline on a school
 * server" option. Use a persistent volume: on an ephemeral container disk
 * every image disappears on redeploy.
 */
export class LocalStorage extends MediaStorage {
  readonly driver = "local" as const;
  readonly dir: string;
  private readonly publicUrl: string;

  constructor(config: { dir: string; publicUrl: string }) {
    super();
    this.dir = resolve(config.dir);
    this.publicUrl = config.publicUrl.replace(/\/+$/, "");
  }

  async upload(buffer: Buffer, meta?: UploadMeta): Promise<StoredMedia> {
    const audio = meta?.kind === "audio";
    const { ext } =
      meta?.kind === "encrypted"
        ? { ext: "bin" }
        : audio
          ? sniffAudio(buffer)
          : sniffImage(buffer);
    const key = `${nanoid(21)}.${ext}`;
    await mkdir(this.dir, { recursive: true });
    await writeFile(join(this.dir, key), buffer, { flag: "wx" });
    return {
      url: `${this.publicUrl}/${key}`,
      mediaType:
        meta?.kind === "encrypted" ? "encrypted" : audio ? "audio" : "image",
    };
  }

  async read(url: string): Promise<Buffer | null> {
    if (!url.startsWith(`${this.publicUrl}/`)) return null;
    const key = basename(url.slice(this.publicUrl.length + 1).split("?")[0]!);
    if (!/^[\w-]+\.\w+$/.test(key)) return null;
    return readFile(join(this.dir, key)).catch(() => null);
  }

  async remove(url: string): Promise<void> {
    if (!url.startsWith(`${this.publicUrl}/`)) return;
    // basename() keeps a crafted URL from reaching outside the upload dir.
    const key = basename(url.slice(this.publicUrl.length + 1));
    if (!/^[\w-]+\.\w+$/.test(key)) return;
    await unlink(join(this.dir, key)).catch(() => undefined);
  }
}
