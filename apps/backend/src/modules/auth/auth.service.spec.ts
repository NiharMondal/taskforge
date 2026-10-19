import { passwordUtils } from "@/common/utils/password";
import { PrismaService } from "@/prisma/prisma.service";
import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { AuthProvider, WorkspaceRole } from "generated/prisma/enums";
import { AuthService } from "./auth.service";
import { GoogleIdentity, GoogleTokenVerifier } from "./google-token-verifier";

const identity: GoogleIdentity = {
  sub: "google-sub-1",
  email: "Alice@Example.com",
  name: "Alice",
  picture: "https://lh3.example/alice.png",
};

let prisma: {
  auth: { findUnique: jest.Mock; create: jest.Mock };
  user: { findFirst: jest.Mock; create: jest.Mock };
  workspace: { create: jest.Mock };
  membership: { create: jest.Mock };
  $transaction: jest.Mock;
};
let verifier: { verify: jest.Mock };
let jwt: { sign: jest.Mock };
let service: AuthService;

beforeEach(() => {
  prisma = {
    auth: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
    },
    user: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        id: "user-new",
        name: "Alice",
        email: "alice@example.com",
        avatarUrl: identity.picture,
      }),
    },
    workspace: {
      create: jest.fn().mockResolvedValue({ id: "ws-new", name: "Alice's" }),
    },
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

describe("AuthService.register", () => {
  const dto = { name: "Bob", email: " Bob@Example.com ", password: "secret1" };

  beforeEach(() => {
    prisma.user.create.mockResolvedValue({
      id: "user-bob",
      name: "Bob",
      email: "bob@example.com",
    });
  });

  it("creates the user (with email), an EMAIL auth, a workspace and OWNER membership", async () => {
    const result = await service.register(dto);

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: { name: "Bob", email: "bob@example.com" },
    });
    expect(prisma.auth.create).toHaveBeenCalledWith({
      data: {
        provider: AuthProvider.EMAIL,
        password: expect.any(String) as string,
        userId: "user-bob",
      },
    });
    expect(prisma.membership.create).toHaveBeenCalledWith({
      data: {
        userId: "user-bob",
        workspaceId: "ws-new",
        role: WorkspaceRole.OWNER,
      },
    });
    expect(result.user).toEqual({
      id: "user-bob",
      name: "Bob",
      email: "bob@example.com",
    });
  });

  it("stores a hash, never the plain password", async () => {
    await service.register(dto);

    const { data } = (prisma.auth.create.mock.calls as unknown[][])[0][0] as {
      data: { password: string };
    };
    expect(data.password).not.toBe(dto.password);
    await expect(
      passwordUtils.comparePassword(dto.password, data.password),
    ).resolves.toBe(true);
  });

  it("rejects an email that is already taken, case-insensitively", async () => {
    prisma.user.findFirst.mockResolvedValue({ id: "user-old" });

    await expect(service.register(dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { email: { equals: "bob@example.com", mode: "insensitive" } },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("AuthService.signIn", () => {
  const user = (auths: object[]) => ({
    id: "user-bob",
    name: "Bob",
    email: "bob@example.com",
    avatarUrl: null,
    auths,
  });

  it("signs in with the password on the user's EMAIL auth", async () => {
    const password = await passwordUtils.hashPassword("secret1");
    prisma.user.findFirst.mockResolvedValue(
      user([{ provider: AuthProvider.EMAIL, password }]),
    );

    const session = await service.signIn({
      email: "Bob@Example.com",
      password: "secret1",
    });

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { email: { equals: "bob@example.com", mode: "insensitive" } },
      include: { auths: { where: { provider: AuthProvider.EMAIL } } },
    });
    expect(jwt.sign).toHaveBeenCalledWith({
      sub: "user-bob",
      email: "bob@example.com",
    });
    expect(session.user.email).toBe("bob@example.com");
  });

  it("refuses a Google-only account (no EMAIL auth)", async () => {
    prisma.user.findFirst.mockResolvedValue(user([]));

    await expect(
      service.signIn({ email: "bob@example.com", password: "secret1" }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwt.sign).not.toHaveBeenCalled();
  });

  it("refuses a wrong password", async () => {
    const password = await passwordUtils.hashPassword("secret1");
    prisma.user.findFirst.mockResolvedValue(
      user([{ provider: AuthProvider.EMAIL, password }]),
    );

    await expect(
      service.signIn({ email: "bob@example.com", password: "wrong-pw" }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("404s an unknown email", async () => {
    await expect(
      service.signIn({ email: "nobody@example.com", password: "secret1" }),
    ).rejects.toBeInstanceOf(NotFoundException);
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

    it("refuses a second Google account for a user already linked to one", async () => {
      prisma.user.findFirst.mockResolvedValue({
        ...existing,
        auths: [{ provider: AuthProvider.GOOGLE, providerId: "other-sub" }],
      });

      await expect(
        service.googleSignIn({ idToken: "t" }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.auth.create).not.toHaveBeenCalled();
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
        },
      });
      expect(prisma.auth.create).toHaveBeenCalledWith({
        data: {
          provider: AuthProvider.GOOGLE,
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
