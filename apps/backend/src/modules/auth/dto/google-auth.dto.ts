import { IsEmail, IsNotEmpty, IsString } from "class-validator";

export class GoogleAuthDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  image?: string;

  @IsString()
  @IsNotEmpty()
  googleId: string;
}
