import { Avatar as AV, cn } from "@heroui/react";
type AvatarProps = {
	fallback?: string;
	src?: string;
	alt?: string;
	size?: "sm" | "lg" | "md";
	shape?: "circle" | "square";
};
export default function Avatar({
	fallback,
	src,
	alt,
	size = "md",
	shape = "circle",
}: AvatarProps) {
	return (
		<AV size={size} className="rounded-full">
			<div
				className={cn(
					"object-cover",
					shape === "circle" && "rounded-full",
				)}
			>
				<AV.Image alt={alt} src={src} />
				<AV.Fallback>{fallback}</AV.Fallback>
			</div>
		</AV>
	);
}
