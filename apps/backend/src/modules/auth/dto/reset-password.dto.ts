import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "@taskforge/shared";
import {
  IsHexadecimal,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from "class-validator";

export class ResetPasswordDto {
  /** The token from the link in a reset email (`generateToken()`: 64 hex characters). */
  @IsHexadecimal()
  @Length(64, 64)
  token: string;

  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH)
  @MaxLength(MAX_PASSWORD_LENGTH) // bcrypt only reads the first 72 bytes
  password: string;
}
