import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { v2 as cloudinary } from "cloudinary";

function getPublicIdFromUrl(url: string): string {
  const parts = url.split("/");
  const publicIdWithExtension = parts[parts.length - 1] ?? "";
  const [publicId] = publicIdWithExtension.split(".");
  return publicId ?? "";
}

@Injectable()
export class CloudinaryService {
  constructor(config: ConfigService) {
    cloudinary.config({
      cloud_name: config.get<string>("CLOUDINARY_CLOUD_NAME"),
      api_key: config.get<string>("CLOUDINARY_API_KEY"),
      api_secret: config.get<string>("CLOUDINARY_API_SECRET"),
      secure: true,
    });
  }

  async destroyIfPresent(url: string): Promise<void> {
    if (!url) return;
    const publicId = getPublicIdFromUrl(url);
    if (!publicId) return;
    await new Promise<void>((resolve) => {
      cloudinary.uploader.destroy(publicId, () => resolve());
    });
  }

  async uploadBuffer(buffer: Buffer): Promise<{ url: string; mediaType: string }> {
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
