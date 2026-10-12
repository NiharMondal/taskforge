import { corsOrigins } from "./app.setup";

describe("corsOrigins", () => {
  it("defaults to the local web app", () => {
    expect(corsOrigins(undefined)).toEqual([
      "http://localhost:3000",
      "http://localhost:3001",
    ]);
    expect(corsOrigins("  ")).toEqual([
      "http://localhost:3000",
      "http://localhost:3001",
    ]);
  });

  it("reads a comma-separated list, ignoring blanks and spaces", () => {
    expect(
      corsOrigins("https://app.example.com, https://staging.example.com,"),
    ).toEqual(["https://app.example.com", "https://staging.example.com"]);
  });
});
