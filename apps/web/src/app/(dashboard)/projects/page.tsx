import type { Metadata } from "next";
import ProjectComponent from "@/features/projects/components/ProjectComponent";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectPage() {
	return <ProjectComponent />;
}
