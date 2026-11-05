import { IsUUID } from "class-validator";

export class TransferOwnershipDto {
  /** The member who becomes the owner; they must already be in the workspace. */
  @IsUUID()
  userId: string;
}
