import { Transform } from "class-transformer";
import { IsNotEmpty, IsString, Matches, MaxLength } from "class-validator";

export const MAX_LABEL_NAME_LENGTH = 30;

/** Trim before validating, so "  " is empty and " Bug" is "Bug". */
export const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

export class CreateLabelDto {
  /** Unique within the workspace, ignoring case. */
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_LABEL_NAME_LENGTH)
  name: string;

  /** A hex color, e.g. `#22c55e`. */
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, {
    message: "color must be a hex color like #22c55e",
  })
  color: string;
}
