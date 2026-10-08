import { IsNotEmpty, IsString, MaxLength } from "class-validator";

/**
 * The only thing the client sends. Email, name, picture and Google id are all
 * read from this token after the backend has verified it with Google — they are
 * deliberately NOT accepted from the body.
 */
export class GoogleAuthDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(8192)
  idToken: string;
}
