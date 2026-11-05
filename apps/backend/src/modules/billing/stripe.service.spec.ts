import { ConfigService } from "@nestjs/config";
import { StripeService } from "./stripe.service";

describe("StripeService.mode", () => {
  const withKey = (key: string | undefined) =>
    new StripeService({
      get: () => key,
    } as unknown as ConfigService);

  it.each([
    ["sk_test_abc", "test"],
    ["rk_test_abc", "test"],
    ["sk_live_abc", "live"],
    ["rk_live_abc", "live"],
    ["whatever", null],
    ["", null],
    [undefined, null],
  ] as const)("reads %j as %s", (key, mode) => {
    expect(withKey(key).mode()).toBe(mode);
  });
});
