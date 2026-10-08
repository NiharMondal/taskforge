import { PrismaService } from "@/prisma/prisma.service";
import { UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { WorkspaceRole } from "generated/prisma/enums";
import { AuthService } from "./auth.service";
import { GoogleIdentity, GoogleTokenVerifier } from "./google-token-verifier";

describe("AuthService.googleSignIn", () => {
  const identity: GoogleIdentity = {
    sub: "google-sub-1",
    email: "Alice@Example.com",
    name: "Alice",
    picture: "https://lh3.example/alice.png",
  };

  let prisma: {
    oAuthAccount: { findUnique: jest.Mock; create: jest.Mock };
    auth: { findFirst: jest.Mock; create: jest.Mock };
    user: { create: jest.Mock };
    workspace: { create: jest.Mock };
    membership: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let verifier: { verify: jest.Mock };
  let jwt: { sign: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    prisma = {
      oAuthAccount: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      auth: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      user: {
        create: jest.fn().mockResolvedValue({
          id: "user-new",
          name: "Alice",
          avatarUrl: identity.picture,
        }),
      },
      workspace: { create: jest.fn().mockResolvedValue({ id: "ws-new" }) },
      membership: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation((cb: (tx: unknown) => unknown) =>
      cb(prisma),
    );
    verifier = { verify: jest.fn().mockResolvedValue(identity) };
    jwt = { sign: jest.fn().mockReturnValue("signed.jwt") };

    service = new AuthService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
      verifier as unknown as GoogleTokenVerifier,
    );
  });

  describe("identity comes from the verified token, not the request", () => {
    it("verifies the id token it was given", async () => {
      await service.googleSignIn({ idToken: "the-token" });

      expect(verifier.verify).toHaveBeenCalledWith("the-token");
    });

    it("ignores identity fields smuggled into the body", async () => {
      // The old exploit: claim to be the victim by sending their email/googleId.
      const forged = {
        idToken: "attackers-own-valid-token",
        email: "victim@example.com",
        googleId: "victims-google-id",
        name: "Victim",
      };

      const session = await service.googleSignIn(forged);

      expect(session.user.email).toBe("alice@example.com");
      expect(prisma.oAuthAccount.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            provider_providerId: {
              provider: "GOOGLE",
              providerId: "google-sub-1",
            },
          },
        }),
      );
      expect(JSON.stringify(prisma.user.create.mock.calls)).not.toContain(
        "Victim",
      );
      expect(jwt.sign).not.toHaveBeenCalledWith(
        expect.objectContaining({ email: "victim@example.com" }),
      );
    });

    it("issues no token and touches nothing when verification fails", async () => {
      verifier.verify.mockRejectedValue(
        new UnauthorizedException("Invalid Google token"),
      );

      await expect(
        service.googleSignIn({ idToken: "forged" }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(jwt.sign).not.toHaveBeenCalled();
      expect(prisma.oAuthAccount.findUnique).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe("a returning Google user", () => {
    const linkedUser = {
      id: "user-1",
      name: "Alice",
      avatarUrl: null,
      auth: { email: "alice@example.com" },
    };

    beforeEach(() => {
      prisma.oAuthAccount.findUnique.mockResolvedValue({ user: linkedUser });
    });

    it("is matched by Google's `sub` and signed in as that user", async () => {
      const session = await service.googleSignIn({ idToken: "t" });

      expect(jwt.sign).toHaveBeenCalledWith({
        sub: "user-1",
        email: "alice@example.com",
      });
      expect(session.accessToken).toBe("signed.jwt");
      expect(session.user.id).toBe("user-1");
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.auth.findFirst).not.toHaveBeenCalled();
    });

    it("still works after the user changed their Google email", async () => {
      verifier.verify.mockResolvedValue({
        ...identity,
        email: "alice.new@example.com",
      });

      const session = await service.googleSignIn({ idToken: "t" });

      expect(session.user.id).toBe("user-1");
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.oAuthAccount.create).not.toHaveBeenCalled();
    });

    it("keeps an uploaded avatar rather than Google's picture", async () => {
      prisma.oAuthAccount.findUnique.mockResolvedValue({
        user: { ...linkedUser, avatarUrl: "https://cdn.example/mine.png" },
      });

      const session = await service.googleSignIn({ idToken: "t" });

      expect(session.user.avatarUrl).toBe("https://cdn.example/mine.png");
    });

    it("falls back to Google's picture when there is no stored avatar", async () => {
      const session = await service.googleSignIn({ idToken: "t" });

      expect(session.user.avatarUrl).toBe(identity.picture);
    });
  });

  describe("an existing password account with the same email", () => {
    const existing = {
      id: "auth-5",
      userId: "user-5",
      email: "Alice@Example.com", // legacy mixed-case row
      user: { id: "user-5", name: "Alice", avatarUrl: null },
    };

    beforeEach(() => {
      prisma.auth.findFirst.mockResolvedValue(existing);
    });

    it("matches the email case-insensitively", async () => {
      await service.googleSignIn({ idToken: "t" });

      expect(prisma.auth.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            email: { equals: "alice@example.com", mode: "insensitive" },
          },
        }),
      );
    });

    it("links Google to that User (not the Auth row) and creates no new user", async () => {
      const session = await service.googleSignIn({ idToken: "t" });

      expect(prisma.oAuthAccount.create).toHaveBeenCalledWith({
        data: {
          provider: "GOOGLE",
          providerId: "google-sub-1",
          userId: "user-5",
        },
      });
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(session.user.id).toBe("user-5");
      expect(jwt.sign).toHaveBeenCalledWith({
        sub: "user-5",
        email: "Alice@Example.com",
      });
    });
  });

  describe("a brand-new Google user", () => {
    it("creates user, auth, oauth link, workspace and OWNER membership", async () => {
      const session = await service.googleSignIn({ idToken: "t" });

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: { name: "Alice", avatarUrl: identity.picture },
      });
      expect(prisma.auth.create).toHaveBeenCalledWith({
        data: { email: "alice@example.com", userId: "user-new" },
      });
      expect(prisma.oAuthAccount.create).toHaveBeenCalledWith({
        data: {
          provider: "GOOGLE",
          providerId: "google-sub-1",
          userId: "user-new",
        },
      });
      expect(prisma.membership.create).toHaveBeenCalledWith({
        data: {
          userId: "user-new",
          workspaceId: "ws-new",
          role: WorkspaceRole.OWNER,
        },
      });
      expect(session.user).toMatchObject({
        id: "user-new",
        email: "alice@example.com",
      });
    });

    it("stores and signs the lowercase email", async () => {
      await service.googleSignIn({ idToken: "t" });

      expect(jwt.sign).toHaveBeenCalledWith({
        sub: "user-new",
        email: "alice@example.com",
      });
    });
  });
});
