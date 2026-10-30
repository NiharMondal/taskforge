import { buttonVariants } from "@heroui/react";

/** A `Link` styled as the primary call to action. */
export const PRIMARY_LINK = buttonVariants({ variant: "primary" });

/** A `Link` styled as a secondary action. */
export const SECONDARY_LINK = buttonVariants({ variant: "secondary" });

/** A `Link` styled as a quiet action, for the header. */
export const GHOST_LINK = buttonVariants({ variant: "ghost" });

/** The public site's footer links. */
export const FOOTER_LINKS = [
	{ href: "/pricing", label: "Pricing" },
	{ href: "/terms", label: "Terms" },
	{ href: "/privacy", label: "Privacy" },
] as const;
