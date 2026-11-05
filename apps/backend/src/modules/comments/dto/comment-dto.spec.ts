import { MAX_COMMENT_LENGTH } from "@taskforge/shared";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateCommentDto } from "./create-comment.dto";

const invalidFields = async (body: object) =>
  (await validate(plainToInstance(CreateCommentDto, body))).map(
    (e) => e.property,
  );

describe("CreateCommentDto", () => {
  it.each([
    "<p>Looks good</p>",
    "Plain text",
    `<p>${"a".repeat(MAX_COMMENT_LENGTH - 7)}</p>`,
  ])("accepts %p", async (content) => {
    expect(await invalidFields({ content })).toEqual([]);
  });

  it.each([
    ["missing", {}],
    ["null", { content: null }],
    ["empty", { content: "" }],
    ["an empty editor paragraph", { content: "<p></p>" }],
    ["only whitespace and &nbsp;", { content: "<p> &nbsp; </p><p><br></p>" }],
    ["too long", { content: "a".repeat(MAX_COMMENT_LENGTH + 1) }],
  ])("refuses content that is %s", async (_label, body) => {
    expect(await invalidFields(body)).toEqual(["content"]);
  });
});
