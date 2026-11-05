import { deriveProjectKey, firstFreeKey } from "./project-key";

describe("deriveProjectKey", () => {
  it.each([
    ["Web App", "WA"],
    ["taskforge", "TAS"],
    ["Customer Self Service Portal Revamp", "CSSP"],
    ["my-cool_api", "MCA"],
    ["Go", "GO"],
    ["2024 Roadmap", "P2R"],
    ["৯৯৯", "PRJ"],
  ])("%s → %s", (name, key) => {
    expect(deriveProjectKey(name)).toBe(key);
  });
});

describe("firstFreeKey", () => {
  it("keeps the base when it is free", () => {
    expect(firstFreeKey("WA", ["WAX"])).toBe("WA");
  });

  it("appends the first free counter", () => {
    expect(firstFreeKey("WA", ["WA", "WA2", "WA4"])).toBe("WA3");
  });
});
