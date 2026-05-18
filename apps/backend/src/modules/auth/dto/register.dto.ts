import {
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
} from "class-validator";

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @MinLength(2)
  tenantName: string;

  @IsString()
  @IsUrl()
  @IsOptional()
  avatarUrl?: string;
}
