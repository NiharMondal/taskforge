/**
 * Layout for the unauthenticated auth routes (/login, /register).
 *
 * Centers a single card on the screen. The `(auth)` route group keeps these
 * pages out of the dashboard shell without affecting the URL.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}
