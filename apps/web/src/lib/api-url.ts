/**
 * Backend API base URL. One default, shared by the browser client
 * (`lib/axios.ts`) and the Auth.js server code (`lib/auth.ts`).
 */
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5001/api/v1";
