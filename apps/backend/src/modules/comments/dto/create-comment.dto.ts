import { MAX_COMMENT_LENGTH } from "@taskforge/shared";
import { IsString, MaxLength, ValidateBy } from "class-validator";

/**
 * The web editor sends HTML, so an "empty" comment can still be a non-empty
 * string (`<p> </p>`). Require some text once tags and whitespace are gone.
 */
export function hasText(html: unknown): boolean {
  return (
    typeof html === "string" &&
    html
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;|\s/g, "")
      .trim().length > 0
  );
}

const HasText = () =>
  ValidateBy({
    name: "hasText",
    validator: {
      validate: hasText,
      defaultMessage: () => "content must not be empty",
    },
  });

export class CreateCommentDto {
  /** HTML from the editor, stored as sent; the web sanitizes it on render. */
  @IsString()
  @MaxLength(MAX_COMMENT_LENGTH)
  @HasText()
  content: string;
}
