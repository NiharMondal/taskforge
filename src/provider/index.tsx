import { AuthProvider } from "./auth-provider";
import { QueryProvider } from "./query-provider";
import { ThemeProvider } from "./theme-provider";

/**
 * App-wide client providers, composed in one place and mounted once in the
 * root layout. Order: theme (outermost) → auth session → server-state.
 * Auth wraps React Query so authenticated requests can resolve the session.
 */
export function Providers({ children }: { children: React.ReactNode }) {
	return (
		<ThemeProvider>
			<AuthProvider>
				<QueryProvider>{children}</QueryProvider>
			</AuthProvider>
		</ThemeProvider>
	);
}
