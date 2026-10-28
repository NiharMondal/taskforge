import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { PaginationQueryDto } from "./pagination-query.dto";

/** Query strings arrive as strings; the pipe converts them like this. */
const parse = (query: Record<string, string>) =>
  plainToInstance(PaginationQueryDto, query);

const invalidFields = async (query: Record<string, string>) =>
  (await validate(parse(query))).map((e) => e.property);

describe("PaginationQueryDto", () => {
  it("defaults to the first page of 20", async () => {
    const dto = parse({});

    expect(dto).toEqual({ page: 1, limit: 20 });
    expect(await invalidFields({})).toEqual([]);
  });

  it("accepts a page and a limit up to 100", async () => {
    expect(parse({ page: "3", limit: "100" })).toEqual({ page: 3, limit: 100 });
    expect(await invalidFields({ page: "3", limit: "100" })).toEqual([]);
  });

  it.each([
    ["page 0", { page: "0" }, ["page"]],
    ["a fractional page", { page: "1.5" }, ["page"]],
    ["a non-numeric page", { page: "two" }, ["page"]],
    ["limit 0", { limit: "0" }, ["limit"]],
    ["a limit over 100", { limit: "101" }, ["limit"]],
  ])("refuses %s", async (_label, query, fields) => {
    expect(await invalidFields(query)).toEqual(fields);
  });
});
