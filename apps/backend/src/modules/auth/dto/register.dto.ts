import {
  MAX_NAME_LENGTH,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  MIN_USER_NAME_LENGTH,
} from "@taskforge/shared";
import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH)
  @MaxLength(MAX_PASSWORD_LENGTH) // bcrypt only reads the first 72 bytes
  password: string;

  @IsString()
  @MinLength(MIN_USER_NAME_LENGTH)
  @MaxLength(MAX_NAME_LENGTH)
  name: string;
}
