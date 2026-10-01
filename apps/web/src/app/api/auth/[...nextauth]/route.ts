/**
 * Auth.js v5 route handler.
 *
 * Exposes the REST endpoints the client uses (`/api/auth/session`,
 * `/api/auth/callback/credentials`, `/api/auth/signout`, ...). In v5 the
 * handlers are created in `lib/auth.ts`; here we just surface them as GET/POST.
 */
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
