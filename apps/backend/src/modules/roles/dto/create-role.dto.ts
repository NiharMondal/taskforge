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

export const MAX_ROLE_NAME_LENGTH = 50;

export class CreateRoleDto {
  /** Unique within the workspace, ignoring case (built-in names included). */
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_ROLE_NAME_LENGTH)
  name: string;

  /**
   * Keys from the catalog (`GRANTABLE_PERMISSIONS`); empty makes a read-only
   * role. The owner-only keys can't be granted.
   */
  @IsArray()
  @ArrayUnique()
  @IsIn(GRANTABLE_PERMISSIONS, { each: true })
  permissions: GrantablePermission[];
}
