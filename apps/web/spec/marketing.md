# Public pages — Web Spec

## Goal

A public site in front of the app: something to land on, a pricing page, and the Terms of Service and Privacy Policy that Stripe and Google OAuth review ask for. No backend calls; web only.

## Routes

All in the `(marketing)` route group, sharing a sticky header (brand, Pricing from `sm` up, theme switch, Sign in, Get started) and a footer (Pricing, Terms, Privacy). The landing page has a hero over the `BoardPreview` picture of a sprint board (static and decorative, `aria-hidden`), the feature cards, three "how it works" steps and a closing call to action.

| Path | Page | Rendering |
| --- | --- | --- |
| `/` | Landing: headline, calls to action, feature cards | Dynamic: reads the session |
| `/pricing` | The three plan cards | Static |
| `/terms` | Terms of Service | Static |
| `/privacy` | Privacy Policy | Static |

## Access

- All four need no session. `lib/auth.config.ts` lists `/pricing`, `/terms` and `/privacy` in `PUBLIC_PREFIXES` (matched by whole path segment) and allows `/` by an exact check. `"/"` must never go in the prefix list: every path starts with it.
- **The landing page sends a signed-in visitor to `/dashboard`.** It calls `auth()` itself; the proxy lets everyone through to a public route. A session whose refresh failed (`session.error`) counts as signed out.
- The header doesn't read the session. "Sign in" goes to `/login`, which already sends a signed-in visitor to `/dashboard`.

## Pricing

Renders `PlanCard` (`features/billing/components/PlanCard.tsx`) for each plan in `PLAN_ORDER`, from the same `PLAN_META` as Settings → Billing, so the limits shown come from `@taskforge/shared`. The actions:

- **Free:** "Get started free" → `/register`.
- **Pro:** "Start your free trial" → `/register`. Pro is bought from inside a workspace (Settings → Billing), where the trial starts on the first upgrade.
- **Enterprise:** "Contact us" (`mailto:` `NEXT_PUBLIC_SALES_EMAIL`), hidden when unset.

The Pro price isn't shown as an amount: it is set on the Stripe price and appears at checkout.

## Terms and Privacy

Placeholders until the real text is written: section headings with bracketed notes, and a "Draft" alert on the page. The privacy page already lists the service providers the app uses (Stripe, Cloudinary, Google sign-in). The register form links to both pages, opening in a new tab so the form isn't lost.

## Auth pages and sign-out

The `(auth)` layout (login, register, verify-email) is a split screen: the form column has a header with the brand (to `/`), "Back to home" and the theme switch, and a footer with the public links; from `lg` up a brand panel on the right shows `BoardPreview`. Both forms offer "Continue with Google" above the email form (a first Google sign-in creates the account). "Sign out" in the workspace menu lands on `/`; a session that expires goes to `/login` instead.
