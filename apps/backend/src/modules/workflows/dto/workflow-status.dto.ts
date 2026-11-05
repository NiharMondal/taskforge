import { IsOptionalNonNull } from "@/common/decorators/is-optional-non-null.decorator";
import { trim } from "@/modules/labels/dto/create-label.dto";
import { MAX_STATUS_NAME_LENGTH } from "@taskforge/shared";
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";
import { StatusCategory } from "generated/prisma/enums";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const HEX_COLOR_MESSAGE = "color must be a hex color like #22c55e";
const POSITION = /^[0-9A-Za-z]+$/;
const POSITION_MESSAGE = "position must be a base-62 fractional index";

export class CreateWorkflowStatusDto {
  /** Unique within the project, ignoring case. */
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_STATUS_NAME_LENGTH)
  name: string;

  @IsString()
  @Matches(HEX_COLOR, { message: HEX_COLOR_MESSAGE })
  color: string;

  @IsEnum(StatusCategory)
  category: StatusCategory;

  /**
   * Column order: a fractional index the client computes from the neighbours
   * it shows (`rankBetween`), like a card's rank. Left out, the status goes
   * last.
   */
  @IsOptionalNonNull()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(POSITION, { message: POSITION_MESSAGE })
  position?: string;
}

export class UpdateWorkflowStatusDto {
  @IsOptionalNonNull()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_STATUS_NAME_LENGTH)
  name?: string;

  @IsOptionalNonNull()
  @IsString()
  @Matches(HEX_COLOR, { message: HEX_COLOR_MESSAGE })
  color?: string;

  @IsOptionalNonNull()
  @IsEnum(StatusCategory)
  category?: StatusCategory;

  @IsOptionalNonNull()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(POSITION, { message: POSITION_MESSAGE })
  position?: string;

  /**
   * `true` makes this the project's default status and clears the old one.
   * `false` is refused: a project always has a default, so pick another.
   */
  @IsOptionalNonNull()
  @IsBoolean()
  isDefault?: boolean;
}

export class DeleteWorkflowStatusQueryDto {
  /** Where the status's issues go. Required when it has any. */
  @IsOptionalNonNull()
  @IsUUID()
  moveTo?: string;
}
