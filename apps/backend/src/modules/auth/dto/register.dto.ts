import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  @MaxLength(72) // bcrypt only reads the first 72 bytes
  password: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;
}
