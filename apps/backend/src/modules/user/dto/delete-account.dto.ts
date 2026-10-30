import { IsOptionalNonNull } from "@/common/decorators/is-optional-non-null.decorator";
import { IsString, MaxLength, MinLength } from "class-validator";

/**
 * `DELETE /users/me`. Which field is required depends on the account, so both
 * are optional here and `UserService.deleteAccount` checks the right one: an
 * account with a password (an EMAIL sign-in method) sends `password`, a
 * Google-only one types its email as `confirmEmail`.
 */
export class DeleteAccountDto {
  @IsString()
  @IsOptionalNonNull()
  @MinLength(1)
  // Looser than a new password's 72, like login: a longer password set before
  // the cap must still be accepted.
  @MaxLength(256)
  password?: string;

  @IsString()
  @IsOptionalNonNull()
  @MinLength(1)
  @MaxLength(320)
  confirmEmail?: string;
}
