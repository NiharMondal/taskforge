import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { v2 as cloudinary, UploadApiResponse } from "cloudinary";

export type UploadedAsset = {
  url: string;
  publicId: string;
};

/**
 * Global helper around the Cloudinary SDK.
 *
 * Upload lifecycle convention shared by every module:
 *  - The frontend uploads directly into a temp folder, e.g.
 *    `taskforge/temp/user-avatar`, and sends us back { avatarUrl, avatarPublicId }.
 *  - On a successful DB save we `promoteToPermanent()` which moves the asset out
 *    of `.../temp/...` into its permanent folder (`taskforge/user-avatar`).
 *  - If the record is never saved (or the save fails) we `delete()` the temp
 *    asset so nothing is left orphaned in Cloudinary.
 */
@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  /** The path segment that marks an asset as not-yet-saved. */
  private readonly tempSegment = "/temp/";

  constructor(private readonly config: ConfigService) {
    cloudinary.config({
      cloud_name: this.config.getOrThrow<string>("CLOUDINARY_CLOUD_NAME"),
      api_key: this.config.getOrThrow<string>("CLOUDINARY_API_KEY"),
      api_secret: this.config.getOrThrow<string>("CLOUDINARY_API_SECRET"),
    });
  }

  /** True when the publicId still lives in a temp folder. */
  isTemp(publicId: string): boolean {
    return publicId.includes(this.tempSegment);
  }

  /**
   * Cleanup for an unsaved upload, exposed over HTTP. Refuses anything that is
   * not in a temp folder so a saved (permanent) asset can never be destroyed
   * through this endpoint, regardless of what publicId the client sends.
   */
  async deleteTemp(publicId: string): Promise<void> {
    if (!this.isTemp(publicId)) return;
    await this.delete(publicId);
  }

  /**
   * Move an asset from its temp folder to the permanent one by stripping the
   * `/temp/` segment from its publicId, e.g.
   *   taskforge/temp/user-avatar/abc  ->  taskforge/user-avatar/abc
   *
   * No-op (returns the asset as-is) if it is already permanent.
   */
  async promoteToPermanent(tempPublicId: string): Promise<UploadedAsset> {
    if (!this.isTemp(tempPublicId)) {
      const existing = (await cloudinary.api.resource(
        tempPublicId,
      )) as UploadApiResponse;
      return { url: existing.secure_url, publicId: existing.public_id };
    }

    const permanentPublicId = tempPublicId.replace(this.tempSegment, "/");

    const result = (await cloudinary.uploader.rename(
      tempPublicId,
      permanentPublicId,
      { overwrite: true, invalidate: true },
    )) as UploadApiResponse;

    return { url: result.secure_url, publicId: result.public_id };
  }

  /**
   * Permanently remove an asset. Safe to call with an empty/undefined id and
   * never throws — cleanup must not break the surrounding business flow.
   */
  async delete(publicId?: string | null): Promise<void> {
    if (!publicId) return;

    try {
      await cloudinary.uploader.destroy(publicId, { invalidate: true });
    } catch (error) {
      this.logger.error(
        `Failed to delete Cloudinary asset "${publicId}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
