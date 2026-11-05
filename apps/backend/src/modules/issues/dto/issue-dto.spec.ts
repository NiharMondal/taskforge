import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { IssueType } from "generated/prisma/enums";
import { CreateIssueDto } from "./create-issue.dto";
import { UpdateIssueDto } from "./update-issue.dto";

/** The properties the validation pipe would refuse, for one request body. */
async function invalidFields(dto: new () => object, body: object) {
  const errors = await validate(plainToInstance(dto, body));
  return errors.map((e) => e.property);
}

describe.each([
  ["CreateIssueDto", CreateIssueDto, { title: "New issue" }],
  ["UpdateIssueDto", UpdateIssueDto, {}],
] as const)("%s type and timeEstimate", (_name, dto, base) => {
  const check = (fields: object) => invalidFields(dto, { ...base, ...fields });

  it.each([IssueType.EPIC, IssueType.STORY, IssueType.TASK, IssueType.BUG])(
    "accepts type %s",
    async (type) => {
      expect(await check({ type })).toEqual([]);
    },
  );

  it.each([
    ["SUBTASK, which only parentIssueId sets", IssueType.SUBTASK],
    ["null, since the column is NOT NULL", null],
    ["an unknown type", "FEATURE"],
  ])("refuses type %s", async (_label, type) => {
    expect(await check({ type })).toEqual(["type"]);
  });

  it.each([0, 5, 100, null])(
    "accepts timeEstimate %p",
    async (timeEstimate) => {
      expect(await check({ timeEstimate })).toEqual([]);
    },
  );

  it.each([-1, 101, 2.5, "5"])(
    "refuses timeEstimate %p",
    async (timeEstimate) => {
      expect(await check({ timeEstimate })).toEqual(["timeEstimate"]);
    },
  );
});

describe.each([
  ["CreateIssueDto", CreateIssueDto, { title: "New issue" }],
  ["UpdateIssueDto", UpdateIssueDto, {}],
] as const)("%s labelIds", (_name, dto, base) => {
  const check = (fields: object) => invalidFields(dto, { ...base, ...fields });
  const uuid = (n: number) =>
    `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

  it.each([
    ["an empty list", []],
    ["ten labels", Array.from({ length: 10 }, (_, i) => uuid(i))],
  ])("accepts %s", async (_label, labelIds) => {
    expect(await check({ labelIds })).toEqual([]);
  });

  it.each([
    ["null", null],
    ["a string", uuid(1)],
    ["a non-uuid", ["label-1"]],
    ["duplicates", [uuid(1), uuid(1)]],
    ["eleven labels", Array.from({ length: 11 }, (_, i) => uuid(i))],
  ])("refuses %s", async (_label, labelIds) => {
    expect(await check({ labelIds })).toEqual(["labelIds"]);
  });
});
