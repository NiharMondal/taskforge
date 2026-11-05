import { MAX_LABEL_NAME_LENGTH } from "@taskforge/shared";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateLabelDto } from "./create-label.dto";
import { UpdateLabelDto } from "./update-label.dto";

const check = async (dto: new () => object, body: object) => {
  const instance = plainToInstance(dto, body);
  const errors = await validate(instance);
  return { instance, invalid: errors.map((e) => e.property) };
};

describe("CreateLabelDto", () => {
  it("trims the name", async () => {
    const { instance, invalid } = await check(CreateLabelDto, {
      name: "  Bug ",
      color: "#ef4444",
    });

    expect(invalid).toEqual([]);
    expect(instance).toMatchObject({ name: "Bug" });
  });

  it.each([
    ["missing", {}],
    ["blank", { name: "   " }],
    ["too long", { name: "a".repeat(MAX_LABEL_NAME_LENGTH + 1) }],
  ])("refuses a name that is %s", async (_label, fields) => {
    const { invalid } = await check(CreateLabelDto, {
      color: "#ef4444",
      ...fields,
    });
    expect(invalid).toEqual(["name"]);
  });

  it.each(["red", "#fff", "#12345g", "ef4444", null])(
    "refuses color %p",
    async (color) => {
      const { invalid } = await check(CreateLabelDto, { name: "Bug", color });
      expect(invalid).toEqual(["color"]);
    },
  );
});

describe("UpdateLabelDto", () => {
  it("accepts either field alone", async () => {
    expect((await check(UpdateLabelDto, { name: "Bug" })).invalid).toEqual([]);
    expect((await check(UpdateLabelDto, { color: "#ef4444" })).invalid).toEqual(
      [],
    );
  });

  it.each([
    ["a null name", { name: null }],
    ["a blank name", { name: " " }],
    ["a null color", { color: null }],
  ])("refuses %s", async (_label, body) => {
    expect((await check(UpdateLabelDto, body)).invalid).toHaveLength(1);
  });
});
