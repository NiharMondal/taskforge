"use client";

import { Button } from "@heroui/react";
import { signOut } from "next-auth/react";

/**
 * Logout control. Clears the Auth.js session (JWT cookie) and returns the user
 * to /login, per spec/auth.md.
 */
export function SignOutButton() {
  return (
    <Button variant="outline" onClick={() => signOut({ callbackUrl: "/login" })}>
      Sign out
    </Button>
  );
}
