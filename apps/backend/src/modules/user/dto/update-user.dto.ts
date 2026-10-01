import { IsBoolean, IsOptional, IsString, IsUrl } from "class-validator";

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsUrl()
  @IsOptional()
  avatarUrl?: string;

  // Cloudinary public id returned to the frontend after it uploads the avatar
  // into the temp folder (e.g. "taskforge/temp/user-avatar/abc").
  @IsString()
  @IsOptional()
  avatarPublicId?: string;

  @IsBoolean()
  @IsOptional()
  emailVerified?: boolean;
}
