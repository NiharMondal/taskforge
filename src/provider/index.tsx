import { QueryProvider } from "./query-provider";
import { ThemeProvider } from "./theme-provider";

/**
 * App-wide client providers, composed in one place and mounted once in the
 * root layout. Order: theme (outermost) → server-state (React Query).
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <QueryProvider>{children}</QueryProvider>
    </ThemeProvider>
  );
}
