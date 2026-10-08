import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OAuth2Client, TokenPayload } from "google-auth-library";

/** The claims of a verified Google ID token that sign-in is allowed to use. */
export type GoogleIdentity = {
  /** Google's stable, never-reused account id. */
  sub: string;
  email: string;
  name: string;
  picture?: string;
};

/**
 * Verifies a Google-issued OpenID Connect ID token.
 *
 * `POST /auth/google` is public, so whatever identity it acts on must be proven
 * by Google's signature rather than asserted by the caller. `verifyIdToken`
 * checks the signature (against Google's published certs), the issuer, the
 * expiry and — via `audience` — that the token was minted for *our* OAuth
 * client and not for some other app.
 */
@Injectable()
export class GoogleTokenVerifier {
  private readonly client = new OAuth2Client();

  constructor(private readonly config: ConfigService) {}

  async verify(idToken: string): Promise<GoogleIdentity> {
    // Read lazily: the backend should still boot for deployments that only use
    // email/password sign-in.
    const audience = this.config.get<string>("GOOGLE_CLIENT_ID");
    if (!audience) {
      throw new ServiceUnavailableException("Google sign-in is not configured");
    }

    let payload: TokenPayload | undefined;
    try {
      const ticket = await this.client.verifyIdToken({ idToken, audience });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException("Invalid Google token");
    }

    if (!payload?.sub || !payload.email) {
      throw new UnauthorizedException("Invalid Google token");
    }

    // An unverified address proves nothing about who owns it, and we link
    // Google logins to existing accounts by email.
    if (payload.email_verified !== true) {
      throw new UnauthorizedException("Google account email is not verified");
    }

    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name ?? payload.email.split("@")[0],
      picture: payload.picture,
    };
  }
}
