import { VALIDATION_PIPE_OPTIONS } from "@/app.setup";
import { ValidationPipe } from "@nestjs/common";
import { CreateRoleDto } from "./create-role.dto";
import { UpdateRoleDto } from "./update-role.dto";

const pipe = new ValidationPipe(VALIDATION_PIPE_OPTIONS);
const validate = (dto: new () => object, value: object) =>
  pipe.transform(value, { type: "body", metatype: dto });

describe("CreateRoleDto", () => {
  it("trims the name and accepts catalog permissions", async () => {
    await expect(
      validate(CreateRoleDto, {
        name: "  Triage ",
        permissions: ["issue:status", "comment:create"],
      }),
    ).resolves.toEqual({
      name: "Triage",
      permissions: ["issue:status", "comment:create"],
    });
  });

  it("accepts an empty permission list (a read-only role)", async () => {
    await expect(
      validate(CreateRoleDto, { name: "Guest", permissions: [] }),
    ).resolves.toBeDefined();
  });

  it.each([
    ["a blank name", { name: "   ", permissions: [] }],
    ["a name over 50 characters", { name: "x".repeat(51), permissions: [] }],
    ["no permissions field", { name: "Triage" }],
    ["an unknown key", { name: "T", permissions: ["issue:fly"] }],
    ["an owner-only key", { name: "T", permissions: ["workspace:delete"] }],
    [
      "a repeated key",
      { name: "T", permissions: ["issue:status", "issue:status"] },
    ],
    ["a systemKey", { name: "T", permissions: [], systemKey: "ADMIN" }],
  ])("rejects %s", async (_case, value) => {
    await expect(validate(CreateRoleDto, value)).rejects.toThrow();
  });
});

describe("UpdateRoleDto", () => {
  it("takes either field alone", async () => {
    await expect(validate(UpdateRoleDto, { name: "New" })).resolves.toEqual({
      name: "New",
    });
    await expect(validate(UpdateRoleDto, { permissions: [] })).resolves.toEqual(
      { permissions: [] },
    );
  });

  it("rejects null for either field", async () => {
    await expect(validate(UpdateRoleDto, { name: null })).rejects.toThrow();
    await expect(
      validate(UpdateRoleDto, { permissions: null }),
    ).rejects.toThrow();
  });
});
