import { appUrl } from ".";

describe("appUrl", () => {
  const config = (value?: string) => ({ get: <T>() => value as T });

  it("joins APP_URL and the path, without a doubled slash", () => {
    expect(appUrl(config("https://app.example/"), "/login")).toBe(
      "https://app.example/login",
    );
    expect(appUrl(config("https://app.example"), "/login")).toBe(
      "https://app.example/login",
    );
  });

  it("falls back to the local web app", () => {
    expect(appUrl(config(), "/login")).toBe("http://localhost:3000/login");
  });
});
