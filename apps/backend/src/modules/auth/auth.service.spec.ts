import { passwordUtils } from "@/common/utils/password";
import { PrismaService } from "@/prisma/prisma.service";
import { hashToken } from "@/helper";
import { MailService } from "@/modules/mail/mail.service";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { AuthProvider, WorkspaceRole } from "generated/prisma/enums";
import { AuthService } from "./auth.service";
import { GoogleIdentity, GoogleTokenVerifier } from "./google-token-verifier";
import { RefreshTokenService } from "./refresh-token.service";

const identity: GoogleIdentity = {
  sub: "google-sub-1",
  email: "Alice@Example.com",
  name: "Alice",
  picture: "https://lh3.example/alice.png",
};

// Typed `unknown` so the asymmetric matcher isn't an unsafe `any`.
const anyDate: unknown = expect.any(Date);

let prisma: {
  auth: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    deleteMany: jest.Mock;
    upsert: jest.Mock;
  };
  user: {
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  pendingRegistration: {
    count: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    deleteMany: jest.Mock;
  };
  workspace: { create: jest.Mock };
  role: { createManyAndReturn: jest.Mock };
  membership: { create: jest.Mock };
  $transaction: jest.Mock;
};
let verifier: { verify: jest.Mock };
let jwt: { sign: jest.Mock };
let refreshTokens: {
  issue: jest.Mock;
  consume: jest.Mock;
  revoke: jest.Mock;
  revokeAllForUser: jest.Mock;
};
let mail: { sendInBackground: jest.Mock };
let service: AuthService;

/** The emails sent, as `{ to, subject, text }`. */
const sentMail = () =>
  (
    mail.sendInBackground.mock.calls as [
      { to: string; subject: string; text: string },
    ][]
  ).map(([m]) => m);

/** The system roles seeded for the new workspace, by key. */
const seededKeys = () =>
  (
    prisma.role.createManyAndReturn.mock.calls as [
      { data: { workspaceId: string; systemKey: WorkspaceRole }[] },
    ][]
  )[0][0].data.map((r) => r.systemKey);

beforeEach(() => {
  prisma = {
    auth: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      upsert: jest.fn().mockResolvedValue({}),
    },
    user: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        id: "user-new",
        name: "Alice",
        email: "alice@example.com",
        avatarUrl: identity.picture,
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    workspace: {
      create: jest.fn().mockResolvedValue({ id: "ws-new", name: "Alice's" }),
    },
    role: {
      createManyAndReturn: jest.fn(
        ({ data }: { data: { systemKey: WorkspaceRole }[] }) =>
          Promise.resolve(
            data.map((r) => ({
              id: `role-${r.systemKey}`,
              systemKey: r.systemKey,
            })),
          ),
      ),
    },
    membership: { create: jest.fn().mockResolvedValue({}) },
    pendingRegistration: {
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((cb: (tx: unknown) => unknown) =>
    cb(prisma),
  );
  verifier = { verify: jest.fn().mockResolvedValue(identity) };
  jwt = { sign: jest.fn().mockReturnValue("signed.jwt") };
  refreshTokens = {
    issue: jest.fn().mockResolvedValue("refresh-token"),
    consume: jest.fn(),
    revoke: jest.fn().mockResolvedValue(undefined),
    revokeAllForUser: jest.fn().mockResolvedValue(undefined),
  };
  mail = { sendInBackground: jest.fn() };

  service = new AuthService(
    prisma as unknown as PrismaService,
    jwt as unknown as JwtService,
    verifier as unknown as GoogleTokenVerifier,
    refreshTokens as unknown as RefreshTokenService,
    mail as unknown as MailService,
    { get: () => "https://app.example/" } as unknown as ConfigService,
  );
});

describe("AuthService.register", () => {
  const dto = { name: "Bob", email: " Bob@Example.com ", password: "secret1" };

  /** The token in the emailed link. */
  const linkToken = () =>
    /verify-email\?token=([0-9a-f]{64})/.exec(sentMail()[0].text)?.[1];

  it("creates no account: it stores a pending sign-up and emails its link", async () => {
    const result = await service.register(dto);

    expect(result).toEqual({ email: "bob@example.com" });
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.auth.create).not.toHaveBeenCalled();
    expect(prisma.workspace.create).not.toHaveBeenCalled();

    expect(sentMail()).toHaveLength(1);
    expect(sentMail()[0].to).toBe("bob@example.com");
    expect(sentMail()[0].text).toContain(
      "https://app.example/verify-email?token=",
    );

    // Only the token's hash is stored, never the token itself.
    const { data } = (
      prisma.pendingRegistration.create.mock.calls as [
        { data: { email: string; name: string; tokenHash: string } },
      ][]
    )[0][0];
    expect(data).toMatchObject({ email: "bob@example.com", name: "Bob" });
    expect(data.tokenHash).toBe(hashToken(linkToken()!));
  });

  it("stores a hash, never the plain password", async () => {
    await service.register(dto);

    const { data } = (
      prisma.pendingRegistration.create.mock.calls as [
        { data: { passwordHash: string } },
      ][]
    )[0][0];
    expect(data.passwordHash).not.toBe(dto.password);
    await expect(
      passwordUtils.comparePassword(dto.password, data.passwordHash),
    ).resolves.toBe(true);
  });

  it("answers a taken address the same way, and emails its owner instead", async () => {
    prisma.user.findFirst.mockResolvedValue({
      name: "Bobby",
      emailVerifiedAt: new Date("2026-10-01"),
    });

    const result = await service.register(dto);

    expect(result).toEqual({ email: "bob@example.com" });
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { email: { equals: "bob@example.com", mode: "insensitive" } },
      select: { name: true, emailVerifiedAt: true },
    });
    expect(prisma.pendingRegistration.create).not.toHaveBeenCalled();
    expect(sentMail()).toHaveLength(1);
    expect(sentMail()[0].subject).toBe("You already have a TaskForge account");
    expect(sentMail()[0].text).not.toContain("verify-email");
  });

  it("starts a sign-up for an unverified account registered before verification", async () => {
    prisma.user.findFirst.mockResolvedValue({
      name: "Bob",
      emailVerifiedAt: null,
    });

    await service.register(dto);

    expect(prisma.pendingRegistration.create).toHaveBeenCalled();
    expect(sentMail()[0].text).toContain("verify-email?token=");
  });

  it("sends nothing past the per-address limit, without saying so", async () => {
    prisma.pendingRegistration.count.mockResolvedValue(3);

    const result = await service.register(dto);

    expect(result).toEqual({ email: "bob@example.com" });
    expect(prisma.pendingRegistration.create).not.toHaveBeenCalled();
    expect(mail.sendInBackground).not.toHaveBeenCalled();
  });
});

describe("AuthService.verifyEmail", () => {
  const token = "a".repeat(64);
  const pending = {
    id: "pending-1",
    email: "bob@example.com",
    name: "Bob",
    passwordHash: "$2b$12$hash",
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + 60_000),
  };

  beforeEach(() => {
    prisma.pendingRegistration.findUnique.mockResolvedValue(pending);
    prisma.user.create.mockResolvedValue({
      id: "user-bob",
      name: "Bob",
      email: "bob@example.com",
      avatarUrl: null,
    });
  });

  it("looks the sign-up up by the token's hash", async () => {
    await service.verifyEmail(token);

    expect(prisma.pendingRegistration.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: hashToken(token) },
    });
  });

  it("creates a verified user, its EMAIL auth, a workspace and OWNER membership, and signs in", async () => {
    const session = await service.verifyEmail(token);

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: { name: "Bob", email: "bob@example.com", emailVerifiedAt: anyDate },
    });
    expect(prisma.auth.create).toHaveBeenCalledWith({
      data: {
        provider: AuthProvider.EMAIL,
        password: "$2b$12$hash",
        userId: "user-bob",
      },
    });
    expect(seededKeys()).toEqual(["OWNER", "ADMIN", "MEMBER", "VIEWER"]);
    expect(prisma.membership.create).toHaveBeenCalledWith({
      data: {
        userId: "user-bob",
        workspaceId: "ws-new",
        role: WorkspaceRole.OWNER,
        roleId: "role-OWNER",
      },
    });
    expect(session).toMatchObject({
      user: { id: "user-bob", email: "bob@example.com" },
      accessToken: "signed.jwt",
      refreshToken: "refresh-token",
    });
  });

  it("uses the link once and drops every other sign-up for the address", async () => {
    await service.verifyEmail(token);

    expect(prisma.pendingRegistration.deleteMany).toHaveBeenCalledWith({
      where: { id: "pending-1" },
    });
    expect(prisma.pendingRegistration.deleteMany).toHaveBeenCalledWith({
      where: { email: "bob@example.com" },
    });
  });

  it("refuses an unknown, expired or already-used link", async () => {
    prisma.pendingRegistration.findUnique.mockResolvedValueOnce(null);
    await expect(service.verifyEmail(token)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    prisma.pendingRegistration.findUnique.mockResolvedValueOnce({
      ...pending,
      expiresAt: new Date(Date.now() - 1),
    });
    await expect(service.verifyEmail(token)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    // A concurrent click claimed it first.
    prisma.pendingRegistration.deleteMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.verifyEmail(token)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(jwt.sign).not.toHaveBeenCalled();
  });

  it("refuses when the address got an account in the meantime", async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: "user-g",
      emailVerifiedAt: new Date(),
    });

    await expect(service.verifyEmail(token)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.auth.upsert).not.toHaveBeenCalled();
  });

  it("hands an unverified older account to whoever proved the address", async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: "user-old",
      name: "Someone",
      email: "Bob@Example.com",
      emailVerifiedAt: null,
    });
    prisma.user.update.mockResolvedValue({
      id: "user-old",
      name: "Bob",
      email: "Bob@Example.com",
      avatarUrl: null,
    });

    const session = await service.verifyEmail(token);

    expect(prisma.auth.upsert).toHaveBeenCalledWith({
      where: {
        userId_provider: { userId: "user-old", provider: AuthProvider.EMAIL },
      },
      create: {
        provider: AuthProvider.EMAIL,
        password: "$2b$12$hash",
        userId: "user-old",
      },
      update: { password: "$2b$12$hash" },
    });
    expect(refreshTokens.revokeAllForUser).toHaveBeenCalledWith(
      "user-old",
      prisma,
    );
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-old" },
      data: { name: "Bob", emailVerifiedAt: anyDate },
    });
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.workspace.create).not.toHaveBeenCalled();
    expect(session.user.id).toBe("user-old");
  });
});

describe("AuthService.signIn", () => {
  const bob = {
    id: "user-bob",
    name: "Bob",
    email: "bob@example.com",
    avatarUrl: null,
    emailVerifiedAt: new Date("2026-10-01") as Date | null,
  };
  /** The EMAIL Auth row the lookup returns, with its user. */
  const emailAuth = (password: string) => ({
    provider: AuthProvider.EMAIL,
    password,
    userId: bob.id,
    user: bob,
  });
  const signIn = (email: string, password: string) =>
    service.signIn({ email, password });

  it("looks up the EMAIL sign-in method by its user's email", async () => {
    prisma.auth.findFirst.mockResolvedValue(
      emailAuth(await passwordUtils.hashPassword("secret1")),
    );

    const session = await signIn("Bob@Example.com", "secret1");

    expect(prisma.auth.findFirst).toHaveBeenCalledWith({
      where: {
        provider: AuthProvider.EMAIL,
        user: {
          email: { equals: "bob@example.com", mode: "insensitive" },
        },
      },
      include: { user: true },
    });
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
    expect(jwt.sign).toHaveBeenCalledWith({
      sub: "user-bob",
      email: "bob@example.com",
    });
    expect(session.user.email).toBe("bob@example.com");
  });

  it("returns an access token, its expiry and a refresh token", async () => {
    prisma.auth.findFirst.mockResolvedValue(
      emailAuth(await passwordUtils.hashPassword("secret1")),
    );

    const before = Date.now();
    const session = await signIn("bob@example.com", "secret1");

    expect(session.accessToken).toBe("signed.jwt");
    expect(session.refreshToken).toBe("refresh-token");
    expect(refreshTokens.issue).toHaveBeenCalledWith("user-bob", undefined);
    const expiresIn = Date.parse(session.accessTokenExpiresAt) - before;
    expect(expiresIn).toBeGreaterThanOrEqual(15 * 60_000);
    expect(expiresIn).toBeLessThan(16 * 60_000);
  });

  it("refuses the right password on an account whose email was never confirmed", async () => {
    prisma.auth.findFirst.mockResolvedValue({
      ...emailAuth(await passwordUtils.hashPassword("secret1")),
      user: { ...bob, emailVerifiedAt: null },
    });

    await expect(signIn("bob@example.com", "secret1")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(jwt.sign).not.toHaveBeenCalled();
    expect(refreshTokens.issue).not.toHaveBeenCalled();
  });

  describe("gives every failure the same answer", () => {
    const rejection = async (attempt: Promise<unknown>) => {
      const error = await attempt.catch((e: unknown) => e);
      expect(error).toBeInstanceOf(UnauthorizedException);
      expect(jwt.sign).not.toHaveBeenCalled();
      return (error as UnauthorizedException).message;
    };

    it("for an unknown email, a Google-only account and a wrong password", async () => {
      // Unknown email, or an account with no EMAIL sign-in (Google only):
      // either way there is no EMAIL Auth row to find.
      const unknown = await rejection(signIn("nobody@example.com", "secret1"));

      prisma.auth.findFirst.mockResolvedValue(
        emailAuth(await passwordUtils.hashPassword("secret1")),
      );
      const wrongPassword = await rejection(
        signIn("bob@example.com", "nope12"),
      );

      expect(unknown).toBe("Invalid email or password");
      expect(wrongPassword).toBe(unknown);
    });

    it("still runs a password comparison when no account matches", async () => {
      const compare = jest.spyOn(passwordUtils, "comparePassword");

      await rejection(signIn("nobody@example.com", "secret1"));

      expect(compare).toHaveBeenCalledWith(
        "secret1",
        expect.stringMatching(/^\$2[aby]\$12\$/),
      );
      compare.mockRestore();
    });
  });
});

describe("AuthService.googleSignIn", () => {
  const googleAuthLookup = {
    where: {
      provider_providerId: {
        provider: AuthProvider.GOOGLE,
        providerId: "google-sub-1",
      },
    },
    include: { user: true },
  };

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
      expect(prisma.auth.findUnique).toHaveBeenCalledWith(googleAuthLookup);
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
      expect(prisma.auth.findUnique).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe("a returning Google user", () => {
    const linkedUser = {
      id: "user-1",
      name: "Alice",
      email: "alice@example.com",
      avatarUrl: null,
    };

    beforeEach(() => {
      prisma.auth.findUnique.mockResolvedValue({ user: linkedUser });
    });

    it("is matched by Google's `sub` and signed in as that user", async () => {
      const session = await service.googleSignIn({ idToken: "t" });

      expect(jwt.sign).toHaveBeenCalledWith({
        sub: "user-1",
        email: "alice@example.com",
      });
      expect(session.accessToken).toBe("signed.jwt");
      expect(session.user.id).toBe("user-1");
      // Already linked: no sign-in method is added or removed.
      expect(prisma.auth.create).not.toHaveBeenCalled();
      expect(prisma.auth.deleteMany).not.toHaveBeenCalled();
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.user.findFirst).not.toHaveBeenCalled();
      expect(prisma.auth.create).not.toHaveBeenCalled();
    });

    it("still works after the user changed their Google email", async () => {
      verifier.verify.mockResolvedValue({
        ...identity,
        email: "alice.new@example.com",
      });

      const session = await service.googleSignIn({ idToken: "t" });

      expect(session.user.id).toBe("user-1");
      expect(session.user.email).toBe("alice@example.com");
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.auth.create).not.toHaveBeenCalled();
    });

    it("keeps an uploaded avatar rather than Google's picture", async () => {
      prisma.auth.findUnique.mockResolvedValue({
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

  describe("an existing account with the same email", () => {
    const existing = {
      id: "user-5",
      name: "Alice",
      email: "Alice@Example.com", // legacy mixed-case row
      avatarUrl: null,
      auths: [],
    };

    beforeEach(() => {
      prisma.user.findFirst.mockResolvedValue(existing);
    });

    it("matches the email case-insensitively", async () => {
      await service.googleSignIn({ idToken: "t" });

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          email: { equals: "alice@example.com", mode: "insensitive" },
        },
        include: { auths: { where: { provider: AuthProvider.GOOGLE } } },
      });
    });

    it("adds a GOOGLE auth to that user and creates no new user", async () => {
      const session = await service.googleSignIn({ idToken: "t" });

      expect(prisma.auth.create).toHaveBeenCalledWith({
        data: {
          provider: AuthProvider.GOOGLE,
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

    it("drops the password of an account whose email nobody had verified", async () => {
      // Whoever registered this address never proved they own it, so the
      // password may belong to someone else (account pre-hijacking).
      await service.googleSignIn({ idToken: "t" });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.auth.deleteMany).toHaveBeenCalledWith({
        where: { userId: "user-5", provider: AuthProvider.EMAIL },
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-5" },
        data: { emailVerifiedAt: anyDate },
      });
      // ...and whoever set that password is signed out everywhere.
      expect(refreshTokens.revokeAllForUser).toHaveBeenCalledWith(
        "user-5",
        prisma,
      );
      expect(prisma.auth.create).toHaveBeenCalled();
    });

    it("keeps the password of an account whose email was already verified", async () => {
      prisma.user.findFirst.mockResolvedValue({
        ...existing,
        emailVerifiedAt: new Date("2026-10-01"),
      });

      const session = await service.googleSignIn({ idToken: "t" });

      expect(prisma.auth.deleteMany).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(refreshTokens.revokeAllForUser).not.toHaveBeenCalled();
      expect(prisma.auth.create).toHaveBeenCalledWith({
        data: {
          provider: AuthProvider.GOOGLE,
          providerId: "google-sub-1",
          userId: "user-5",
        },
      });
      expect(session.user.id).toBe("user-5");
    });

    it("refuses a second Google account for a user already linked to one", async () => {
      prisma.user.findFirst.mockResolvedValue({
        ...existing,
        auths: [{ provider: AuthProvider.GOOGLE, providerId: "other-sub" }],
      });

      await expect(
        service.googleSignIn({ idToken: "t" }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.auth.create).not.toHaveBeenCalled();
      expect(prisma.auth.deleteMany).not.toHaveBeenCalled();
      expect(jwt.sign).not.toHaveBeenCalled();
    });
  });

  describe("a brand-new Google user", () => {
    it("creates user (with email), GOOGLE auth, workspace and OWNER membership", async () => {
      const session = await service.googleSignIn({ idToken: "t" });

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          name: "Alice",
          email: "alice@example.com",
          avatarUrl: identity.picture,
          emailVerifiedAt: anyDate,
        },
      });
      expect(prisma.auth.create).toHaveBeenCalledWith({
        data: {
          provider: AuthProvider.GOOGLE,
          providerId: "google-sub-1",
          userId: "user-new",
        },
      });
      expect(seededKeys()).toEqual(["OWNER", "ADMIN", "MEMBER", "VIEWER"]);
      expect(prisma.membership.create).toHaveBeenCalledWith({
        data: {
          userId: "user-new",
          workspaceId: "ws-new",
          role: WorkspaceRole.OWNER,
          roleId: "role-OWNER",
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

describe("AuthService.refresh", () => {
  it("issues a new pair in the spent token's family", async () => {
    refreshTokens.consume.mockResolvedValue({
      userId: "user-bob",
      familyId: "family-1",
    });
    prisma.user.findUnique.mockResolvedValue({
      id: "user-bob",
      email: "bob@example.com",
    });

    const tokens = await service.refresh("old-token");

    expect(refreshTokens.consume).toHaveBeenCalledWith("old-token");
    expect(refreshTokens.issue).toHaveBeenCalledWith("user-bob", "family-1");
    expect(jwt.sign).toHaveBeenCalledWith({
      sub: "user-bob",
      email: "bob@example.com",
    });
    expect(tokens).toMatchObject({
      accessToken: "signed.jwt",
      refreshToken: "refresh-token",
    });
  });

  it("passes on a rejected token without issuing anything", async () => {
    refreshTokens.consume.mockRejectedValue(new UnauthorizedException());

    await expect(service.refresh("bad")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(jwt.sign).not.toHaveBeenCalled();
    expect(refreshTokens.issue).not.toHaveBeenCalled();
  });
});

describe("AuthService.logout", () => {
  it("revokes the refresh token's session", async () => {
    await service.logout("the-token");

    expect(refreshTokens.revoke).toHaveBeenCalledWith("the-token");
  });
});
