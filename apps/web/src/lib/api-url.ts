/**
 * Backend API base URL. One default, shared by the browser client
 * (`lib/axios.ts`) and the Auth.js server code (`lib/auth.ts`).
 *
 * Keep the `NEXT_PUBLIC_` prefix: `lib/axios.ts` runs in the browser, and Next
 * only exposes `NEXT_PUBLIC_*` variables there (inlined at build time, so set
 * it on the host before `next build`). A plain `API_URL` would be undefined in
 * the browser and every client request would go to the localhost default.
 */
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5001/api/v1";
