import { v2 as cloudinary } from "cloudinary";
import {
  MediaStorage,
  type StoredMedia,
  type UploadMeta,
} from "./media-storage";

function getPublicIdFromUrl(url: string): string {
  const parts = url.split("/");
  const publicIdWithExtension = parts[parts.length - 1] ?? "";
  const [publicId] = publicIdWithExtension.split(".");
  return publicId ?? "";
}

/** Cloudinary (the hosted default). Transcodes, so any image format works. */
export class CloudinaryStorage extends MediaStorage {
  readonly driver = "cloudinary" as const;

  constructor(config: {
    cloudName?: string;
    apiKey?: string;
    apiSecret?: string;
  }) {
    super();
    cloudinary.config({
      cloud_name: config.cloudName,
      api_key: config.apiKey,
      api_secret: config.apiSecret,
      secure: true,
    });
  }

  async remove(url: string): Promise<void> {
    if (!url || !url.includes("res.cloudinary.com")) return;
    const publicId = getPublicIdFromUrl(url);
    if (!publicId) return;
    await new Promise<void>((resolve) => {
      cloudinary.uploader.destroy(publicId, () => resolve());
    });
  }

  async upload(buffer: Buffer, _meta?: UploadMeta): Promise<StoredMedia> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({}, (error, result) => {
          if (error) {
            reject(error);
            return;
          }
          resolve({
            url: result?.secure_url ?? "",
            mediaType: result?.resource_type ?? "",
          });
        })
        .end(buffer);
    });
  }
}
