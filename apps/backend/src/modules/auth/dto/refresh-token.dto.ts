import { IsHexadecimal, Length } from "class-validator";

/** A refresh token as issued at sign-in (`generateToken()`: 64 hex characters). */
export class RefreshTokenDto {
  @IsHexadecimal()
  @Length(64, 64)
  refreshToken: string;
}
