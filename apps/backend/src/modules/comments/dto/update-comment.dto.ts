import { CreateCommentDto } from "./create-comment.dto";

/** A comment has one field, so an edit replaces it: `content` is required. */
export class UpdateCommentDto extends CreateCommentDto {}
