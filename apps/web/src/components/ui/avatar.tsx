import { Avatar as AV, cn } from "@heroui/react";
type AvatarProps = {
	fallback?: string;
	src?: string;
	alt?: string;
	size?: "sm" | "lg" | "md";
	shape?: "circle" | "square";
	customSize?: boolean;
};
export default function Avatar({
	fallback,
	src,
	alt,
	size = "md",
	shape = "circle",
	customSize,
}: AvatarProps) {
	return (
		<AV
			size={size}
			className={cn("ring-1 ring-accent ", { "size-5": customSize })}
		>
			<div
				className={cn(
					"object-cover overflow-hidden",
					shape === "circle" && "rounded-full",
				)}
			>
				<AV.Image alt={alt} src={src} />
				<AV.Fallback>{fallback}</AV.Fallback>
			</div>
		</AV>
	);
}
