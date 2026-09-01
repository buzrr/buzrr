import type { Metadata } from "next";
import SpacesClient from "@/components/Admin/AI/SpacesClient";

export const metadata: Metadata = { title: "AI Spaces" };

export default function AiSpacesPage() {
  return <SpacesClient />;
}
