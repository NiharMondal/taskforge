# 🔐 TaskForge Frontend Authentication (Next.js + Auth.js)

## 🎯 Objective

Implement authentication in Next.js using Auth.js while delegating:

* User validation → Backend API
* Password handling → Backend API
* JWT issuance → Backend API

Frontend should:

* Store session
* Manage login/logout
* Protect routes
* Attach token to API requests

---

# 🧱 Architecture Overview

Frontend (Next.js)
↓
Auth.js (Credentials Provider)
↓
Backend API (NestJS / Express)
↓
JWT Token returned
↓
Stored in Auth.js session

---

# 📦 Install Dependencies

```bash
pnpm add next-auth
```

---

# 📁 File Structure

```
src/app/api/auth/[...nextauth]/route.ts
src/lib/auth.ts          # providers, jwt/session callbacks (Node runtime)
src/lib/auth.config.ts   # Edge-safe subset + route authorization
src/proxy.ts             # Next 16's replacement for middleware.ts
src/lib/axios.ts         # the `api` client; attaches the Bearer token
src/lib/auth-token.ts    # token-getter seam registered by src/provider/auth-provider.tsx
```

> Implementation note: this spec predates the code. Where its samples differ from the files above
> (they use the v4 `next-auth/middleware` API and a `fetch` wrapper that was never built), the
> files are the truth.

---

# ⚙️ Auth Configuration

## `/lib/auth.ts`

```ts
import CredentialsProvider from "next-auth/providers/credentials";

export const authOptions = {
  session: {
    strategy: "jwt",
  },

  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: {},
        password: {},
      },

      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Missing credentials");
        }

        // 🔥 Call YOUR backend API
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: credentials.email,
            password: credentials.password,
          }),
        });

        if (!res.ok) {
          throw new Error("Invalid credentials");
        }

        const data = await res.json();

        /**
         * Expected backend response:
         * {
         *   user: { id, name, email },
         *   accessToken: "jwt-token"
         * }
         */

        return {
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          accessToken: data.accessToken,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.accessToken = user.accessToken;
      }
      return token;
    },

    async session({ session, token }) {
      session.user.id = token.userId;
      session.accessToken = token.accessToken;
      return session;
    },
  },

  pages: {
    signIn: "/login",
  },
};
```

---

# 🔌 Route Handler

## `/app/api/auth/[...nextauth]/route.ts`

```ts
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
```

---

# 📝 Login Page

## `/app/login/page.tsx`

```tsx
"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (res?.error) {
      alert("Login failed");
    } else {
      window.location.href = "/dashboard";
    }
  };

  return (
    <div>
      <input onChange={(e) => setEmail(e.target.value)} />
      <input type="password" onChange={(e) => setPassword(e.target.value)} />
      <button onClick={handleLogin}>Login</button>
    </div>
  );
}
```

---

# 📝 Registration Flow

## ❗ Important

Registration is handled ONLY by backend.

## Example:

```ts
await fetch(`${API_URL}/auth/register`, {
  method: "POST",
  body: JSON.stringify({
    name,
    email,
    password,
  }),
});
```

After registration:
→ Redirect to login

---

# 🔐 Protecting Routes

## Server Component

```ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Dashboard() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return <div>Dashboard</div>;
}
```

---

## Proxy (`src/proxy.ts`)

Next 16 renamed `middleware.ts` to `proxy.ts`. It runs Auth.js with the Edge-safe
`src/lib/auth.config.ts`, whose `authorized` callback lets `/login`, `/register` and `/api/auth`
through, sends signed-in users away from the auth pages, and redirects everyone else without a
session to `/login?callbackUrl=<requested url>`. It is a UX guard only; the `(dashboard)` layout
re-checks the session and the backend is the real boundary.

---

# 🌐 API Client (CRITICAL)

## `src/lib/axios.ts`

Every request goes through the `api` wrapper in `src/lib/axios.ts`. Its request interceptor sets
`Authorization: Bearer <accessToken>` from the token getter that `src/provider/auth-provider.tsx`
registers in `src/lib/auth-token.ts` (the token kept from `useSession()`), so `axios.ts` never
imports next-auth. A backend `401` signs the user out.

---

# 🔄 Logout

```ts
import { signOut } from "next-auth/react";

await signOut({ callbackUrl: "/login" });
```

---

# ⚠️ Rules (STRICT)

1. NEVER store token in localStorage manually
2. ALWAYS use session from Auth.js
3. ALWAYS send token to backend via Authorization header
4. DO NOT decode JWT in frontend for security decisions
5. Backend is source of truth for permissions

---

# ✅ Expected Backend Contract

## Login Response

```json
{
  "user": {
    "id": "string",
    "name": "string",
    "email": "string"
  },
  "accessToken": "jwt"
}
```

---

# 🚀 Definition of Done

* Login works via backend
* JWT stored in session
* Protected routes working
* API calls include token
* Logout works correctly

---

# 🔥 Future Enhancements

* Refresh token handling
* Axios interceptor instead of fetch
* Role-based UI rendering (non-secure, UX only)
* Session persistence optimization

---
