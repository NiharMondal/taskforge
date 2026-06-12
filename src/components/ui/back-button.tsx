import { ArrowLeft } from "lucide-react";
import Link from "next/link";

type Props = {
	href: string;
	label: string;
};

export default function BackButton({ href, label }: Props) {
	return (
		<Link
			href={href}
			className="flex w-fit items-center gap-1 text-sm text-muted transition-colors hover:text-foreground"
		>
			<ArrowLeft className="h-4 w-4" />
			{label}
		</Link>
	);
}
