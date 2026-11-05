import { Anvil } from "lucide-react";
import Link from "next/link";

/** The TaskForge mark and name, linking home: the app's sidebar and the public site's header. */
export default function BrandLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-md text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <span className="flex size-7 items-center justify-center rounded-lg bg-accent text-accent-foreground">
        <Anvil className="size-4" aria-hidden />
      </span>
      TaskForge
    </Link>
  );
}
