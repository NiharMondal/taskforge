import { MAX_WORKFLOW_TRANSITIONS } from "@taskforge/shared";
import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsUUID, ValidateNested } from "class-validator";

export class WorkflowTransitionDto {
  @IsUUID()
  fromStatusId: string;

  @IsUUID()
  toStatusId: string;
}

export class ReplaceTransitionsDto {
  /**
   * Every move the project allows, replacing the stored set. Both statuses must
   * be this project's, and a status can't move to itself (staying put is
   * always allowed).
   */
  @IsArray()
  @ArrayMaxSize(MAX_WORKFLOW_TRANSITIONS)
  @ValidateNested({ each: true })
  @Type(() => WorkflowTransitionDto)
  transitions: WorkflowTransitionDto[];
}
