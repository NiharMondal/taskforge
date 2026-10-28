import { IsHexadecimal, Length } from "class-validator";

/** The token from the link in a verification email (`generateToken()`: 64 hex characters). */
export class VerifyEmailDto {
  @IsHexadecimal()
  @Length(64, 64)
  token: string;
}
