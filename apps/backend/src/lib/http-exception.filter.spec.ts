import { ArgumentsHost, ConflictException, Logger } from "@nestjs/common";
import { Prisma } from "generated/prisma/client";
import { HttpExceptionFilter } from "./http-exception.filter";

describe("HttpExceptionFilter", () => {
  let status: jest.Mock;
  let json: jest.Mock;
  const filter = new HttpExceptionFilter();

  const hostFor = () =>
    ({
      switchToHttp: () => ({ getResponse: () => ({ status }) }),
    }) as unknown as ArgumentsHost;

  const prismaError = (code: string) =>
    new Prisma.PrismaClientKnownRequestError("raw database detail", {
      code,
      clientVersion: "test",
    });

  /** What the filter sent: [status code, body]. */
  const sent = () => [
    (status.mock.calls[0] as [number])[0],
    (json.mock.calls[0] as [Record<string, unknown>])[0],
  ];

  beforeEach(() => {
    json = jest.fn();
    status = jest.fn().mockReturnValue({ json });
  });

  it("passes an HttpException through in the envelope", () => {
    filter.catch(new ConflictException("Email already in use"), hostFor());

    expect(sent()).toEqual([
      409,
      expect.objectContaining({
        success: false,
        statusCode: 409,
        message: "Email already in use",
      }),
    ]);
  });

  it.each([
    ["P2002", 409],
    ["P2003", 409],
    ["P2025", 404],
  ])(
    "maps Prisma %s to %i without leaking the database message",
    (code, expected) => {
      filter.catch(prismaError(code), hostFor());

      const [statusCode, body] = sent();
      expect(statusCode).toBe(expected);
      expect(body).toMatchObject({ success: false, statusCode: expected });
      expect(JSON.stringify(body)).not.toContain("raw database detail");
    },
  );

  it("turns anything else into an enveloped 500 and logs it", () => {
    const log = jest.spyOn(Logger.prototype, "error").mockImplementation();

    filter.catch(new Error("SELECT * FROM secrets"), hostFor());
    filter.catch(prismaError("P1001"), hostFor());

    for (const call of json.mock.calls as [Record<string, unknown>][]) {
      expect(call[0]).toEqual({
        success: false,
        statusCode: 500,
        message: "Internal server error",
      });
    }
    expect(log).toHaveBeenCalledTimes(2);
    log.mockRestore();
  });
});
