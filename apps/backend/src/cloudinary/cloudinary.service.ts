import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
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
 *    of the temp folder into a permanent folder the *server* picks (e.g.
 *    `taskforge/user-avatar/<userId>`), under a fresh random name.
 *  - If the record is never saved (or the save fails) we `delete()` the temp
 *    asset so nothing is left orphaned in Cloudinary.
 */
@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  /**
   * Where every not-yet-saved upload lives. A prefix, not a substring match:
   * `includes("/temp/")` would also accept e.g. `taskforge/user-avatar/x/temp/y`.
   */
  private readonly tempPrefix = "taskforge/temp/";

  constructor(private readonly config: ConfigService) {
    cloudinary.config({
      cloud_name: this.config.getOrThrow<string>("CLOUDINARY_CLOUD_NAME"),
      api_key: this.config.getOrThrow<string>("CLOUDINARY_API_KEY"),
      api_secret: this.config.getOrThrow<string>("CLOUDINARY_API_SECRET"),
    });
  }

  /** True when the publicId still lives in a temp folder. */
  isTemp(publicId: string): boolean {
    return publicId.startsWith(this.tempPrefix);
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
   * Move a temp upload into `permanentFolder` under a fresh random name, e.g.
   *   taskforge/temp/user-avatar/abc  ->  taskforge/user-avatar/<userId>/<uuid>
   *
   * The destination is never derived from the client-chosen temp id: unsigned
   * uploads let the caller pick `public_id`, so a stripped-`/temp/` destination
   * could be aimed at another user's existing asset. `overwrite: false` is a
   * second guard — a rename can never replace an asset that already exists.
   */
  async promoteToPermanent(
    tempPublicId: string,
    permanentFolder: string,
  ): Promise<UploadedAsset> {
    if (!this.isTemp(tempPublicId)) {
      throw new Error(`Not a temp asset: "${tempPublicId}"`);
    }

    const result = (await cloudinary.uploader.rename(
      tempPublicId,
      `${permanentFolder}/${randomUUID()}`,
      { overwrite: false, invalidate: true },
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
