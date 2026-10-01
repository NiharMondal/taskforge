import {
  QueryClient,
  defaultShouldDehydrateQuery,
} from "@tanstack/react-query";

const isServer = typeof window === "undefined";

/**
 * SSR-safe QueryClient factory (TanStack v5 recommended pattern).
 *
 * - On the server: a fresh client per request (no cross-request leakage).
 * - In the browser: a singleton, so client state survives re-renders / Fast Refresh.
 */
function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Server state we trust for a minute before refetching.
        staleTime: 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
      dehydrate: {
        // Include in-flight queries so streaming SSR can hydrate them.
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === "pending",
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient(): QueryClient {
  if (isServer) return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}
