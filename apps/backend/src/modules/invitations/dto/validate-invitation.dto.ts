import { IsNotEmpty, IsString } from "class-validator";

/** Query string of `GET /invitations/validate`. */
export class ValidateInvitationQueryDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}
