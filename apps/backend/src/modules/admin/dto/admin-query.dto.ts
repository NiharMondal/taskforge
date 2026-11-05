import { PaginationQueryDto } from "@/common/dto/pagination-query.dto";
import {
  MAX_ADMIN_SEARCH_LENGTH,
  SUBSCRIPTION_PLAN_VALUES,
  type SubscriptionPlan,
} from "@taskforge/shared";
import { Transform } from "class-transformer";
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

/** Trimmed; blank means no search. */
const trimToUndefined = ({ value }: { value: unknown }) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
};

/** `GET /admin/users?search=&page=&limit=`. */
export class QueryAdminUsersDto extends PaginationQueryDto {
  /** Part of a name or email, ignoring case; or a whole user id. */
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(MAX_ADMIN_SEARCH_LENGTH)
  search?: string;
}

/** `GET /admin/workspaces?search=&plan=&page=&limit=`. */
export class QueryAdminWorkspacesDto extends PaginationQueryDto {
  /** Part of the workspace's name or its owner's email, ignoring case; or a whole workspace id. */
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(MAX_ADMIN_SEARCH_LENGTH)
  search?: string;

  /** Only workspaces on this plan now (`effectivePlan`, not the stored one). */
  @IsOptional()
  @IsIn(SUBSCRIPTION_PLAN_VALUES)
  plan?: SubscriptionPlan;
}
