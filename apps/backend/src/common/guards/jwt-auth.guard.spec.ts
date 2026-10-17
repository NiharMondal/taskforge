import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtAuthGuard } from "./jwt-auth.guard";

const contextFor = (headers: Record<string, string>) =>
  ({
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  }) as unknown as ExecutionContext;

describe("JwtAuthGuard", () => {
  let reflector: Reflector;
  let guard: JwtAuthGuard;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new JwtAuthGuard(reflector);
  });

  it("answers 401, not 403, when the token is missing", () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(false);

    expect(() => guard.canActivate(contextFor({}))).toThrow(
      UnauthorizedException,
    );
  });

  it("lets @Public() routes through without a token", () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(true);

    expect(guard.canActivate(contextFor({}))).toBe(true);
  });
});
