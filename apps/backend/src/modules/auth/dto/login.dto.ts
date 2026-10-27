import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  // Looser than register's 72: bcrypt ignores bytes past 72 anyway, and a
  // longer password set before the cap must still sign in.
  @MaxLength(256)
  password: string;
}
