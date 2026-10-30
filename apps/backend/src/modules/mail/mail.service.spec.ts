import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MailService } from "./mail.service";

describe("MailService.sendInBackground", () => {
  const params = {
    to: "bob@example.com",
    subject: "Hello",
    text: "Hi",
    html: "<p>Hi</p>",
  };
  let service: MailService;

  beforeEach(() => {
    // The transport is created but never connects: `sendMail` is mocked.
    service = new MailService({
      get: () => undefined,
      getOrThrow: (key: string) => (key === "SMTP_PORT" ? "587" : "x"),
    } as unknown as ConfigService);
  });

  afterEach(() => jest.restoreAllMocks());

  it("sends the email without waiting for it", () => {
    const sendMail = jest
      .spyOn(service, "sendMail")
      .mockReturnValue(new Promise(() => undefined));

    expect(service.sendInBackground(params)).toBeUndefined();
    expect(sendMail).toHaveBeenCalledWith(params);
  });

  it("logs a failure instead of throwing it", async () => {
    const logError = jest
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => undefined);
    jest.spyOn(service, "sendMail").mockRejectedValue(new Error("SMTP down"));

    expect(() => service.sendInBackground(params)).not.toThrow();
    await new Promise((resolve) => setImmediate(resolve));

    expect(logError).toHaveBeenCalledWith(expect.stringContaining("SMTP down"));
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining("bob@example.com"),
    );
  });
});
