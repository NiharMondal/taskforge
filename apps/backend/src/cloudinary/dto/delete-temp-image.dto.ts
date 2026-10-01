import { IsNotEmpty, IsString } from "class-validator";

export class DeleteTempImageDto {
  // Cloudinary publicId of a not-yet-saved upload, e.g.
  // "taskforge/temp/user-avatar/abc".
  @IsString()
  @IsNotEmpty()
  publicId!: string;
}
