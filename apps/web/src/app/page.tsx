import { redirect } from "next/navigation";

/**
 * Root entry. Sends users into the app shell; `proxy.ts` redirects to /login
 * if there's no session.
 */
export default function Home() {
  redirect("/dashboard");
}
