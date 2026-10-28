import { IsOptionalNonNull } from "@/common/decorators/is-optional-non-null.decorator";
import { IsOptional, IsString, IsUrl, MaxLength } from "class-validator";

export class UpdateUserDto {
  @IsString()
  @IsOptionalNonNull()
  @MaxLength(100)
  name?: string;

  // Accepted for compatibility but ignored: the server sets avatarUrl from the
  // asset it promotes (see UserService.update).
  @IsUrl()
  @IsOptional()
  avatarUrl?: string;

  // Cloudinary public id returned to the frontend after it uploads the avatar
  // into the temp folder (e.g. "taskforge/temp/user-avatar/abc"). Only a temp
  // asset (or the user's current avatar, unchanged) is accepted — see
  // UserService.update. `null` removes the avatar.
  @IsString()
  @IsOptional()
  avatarPublicId?: string | null;
}
