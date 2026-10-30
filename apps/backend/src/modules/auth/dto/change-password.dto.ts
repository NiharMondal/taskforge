import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "@taskforge/shared";
import { IsString, MaxLength, MinLength } from "class-validator";

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  // Looser than the new password's 72, like login: a longer password set
  // before the cap must still be accepted as the current one.
  @MaxLength(256)
  currentPassword: string;

  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH)
  @MaxLength(MAX_PASSWORD_LENGTH) // bcrypt only reads the first 72 bytes
  newPassword: string;
}
