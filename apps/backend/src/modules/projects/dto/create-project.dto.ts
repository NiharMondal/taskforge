import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z][A-Z0-9]{1,9}$/, {
    message:
      "Key must be 2–10 uppercase letters/digits, starting with a letter",
  })
  key: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
