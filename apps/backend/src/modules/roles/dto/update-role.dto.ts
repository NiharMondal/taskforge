import { IsOptionalNonNull } from "@/common/decorators/is-optional-non-null.decorator";
import {
  GRANTABLE_PERMISSIONS,
  type GrantablePermission,
} from "@/common/permissions/permissions";
import { trim } from "@/modules/labels/dto/create-label.dto";
import { Transform } from "class-transformer";
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
} from "class-validator";
import { MAX_ROLE_NAME_LENGTH } from "./create-role.dto";

/** Rename a custom role, or replace its permissions (the list is the new set). */
export class UpdateRoleDto {
  @IsOptionalNonNull()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_ROLE_NAME_LENGTH)
  name?: string;

  @IsOptionalNonNull()
  @IsArray()
  @ArrayUnique()
  @IsIn(GRANTABLE_PERMISSIONS, { each: true })
  permissions?: GrantablePermission[];
}
