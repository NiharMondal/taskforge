import {
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GoogleTokenVerifier } from "./google-token-verifier";

const mockVerifyIdToken = jest.fn();

jest.mock("google-auth-library", () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: mockVerifyIdToken,
  })),
}));

describe("GoogleTokenVerifier", () => {
  const clientId = "my-client-id.apps.googleusercontent.com";

  const verifierWith = (env: Record<string, string | undefined>) =>
    new GoogleTokenVerifier({
      get: (key: string) => env[key],
    } as unknown as ConfigService);

  const ticketFor = (payload: object | undefined) => ({
    getPayload: () => payload,
  });

  beforeEach(() => {
    mockVerifyIdToken.mockReset();
  });

  it("returns the verified claims", async () => {
    mockVerifyIdToken.mockResolvedValue(
      ticketFor({
        sub: "google-sub-1",
        email: "alice@example.com",
        email_verified: true,
        name: "Alice",
        picture: "https://lh3.example/alice.png",
      }),
    );

    await expect(
      verifierWith({ GOOGLE_CLIENT_ID: clientId }).verify("id-token"),
    ).resolves.toEqual({
      sub: "google-sub-1",
      email: "alice@example.com",
      name: "Alice",
      picture: "https://lh3.example/alice.png",
    });
  });

  it("pins the token to our own OAuth client via `audience`", async () => {
    mockVerifyIdToken.mockResolvedValue(
      ticketFor({ sub: "s", email: "a@example.com", email_verified: true }),
    );

    await verifierWith({ GOOGLE_CLIENT_ID: clientId }).verify("id-token");

    expect(mockVerifyIdToken).toHaveBeenCalledWith({
      idToken: "id-token",
      audience: clientId,
    });
  });

  it("falls back to the email's local part when Google sends no name", async () => {
    mockVerifyIdToken.mockResolvedValue(
      ticketFor({ sub: "s", email: "alice@example.com", email_verified: true }),
    );

    const identity = await verifierWith({ GOOGLE_CLIENT_ID: clientId }).verify(
      "id-token",
    );

    expect(identity.name).toBe("alice");
  });

  it("rejects a token Google's library refuses (bad signature, wrong audience, expired)", async () => {
    mockVerifyIdToken.mockRejectedValue(new Error("Wrong recipient"));

    await expect(
      verifierWith({ GOOGLE_CLIENT_ID: clientId }).verify("forged"),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects an email Google has not verified", async () => {
    mockVerifyIdToken.mockResolvedValue(
      ticketFor({ sub: "s", email: "a@example.com", email_verified: false }),
    );

    await expect(
      verifierWith({ GOOGLE_CLIENT_ID: clientId }).verify("id-token"),
    ).rejects.toThrow("not verified");
  });

  it.each([
    ["no payload", undefined],
    ["no sub", { email: "a@example.com", email_verified: true }],
    ["no email", { sub: "s", email_verified: true }],
  ])("rejects a token with %s", async (_label, payload) => {
    mockVerifyIdToken.mockResolvedValue(ticketFor(payload));

    await expect(
      verifierWith({ GOOGLE_CLIENT_ID: clientId }).verify("id-token"),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("refuses to run (rather than accept any audience) when GOOGLE_CLIENT_ID is unset", async () => {
    await expect(verifierWith({}).verify("id-token")).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(mockVerifyIdToken).not.toHaveBeenCalled();
  });
});
