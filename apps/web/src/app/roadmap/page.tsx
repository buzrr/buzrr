import type { Metadata } from "next";
import ComingSoon from "@/components/Landing/ComingSoon";
import { ISSUES_LINK } from "@/components/Landing/links";

export const metadata: Metadata = {
  title: "Roadmap",
  description:
    "What's next for Buzrr — a public roadmap page is coming soon; planned work lives in GitHub issues.",
};

export default function RoadmapPage() {
  return (
    <ComingSoon
      title="Roadmap"
      description="A public roadmap page is coming soon. Planned features and ongoing work are tracked in GitHub issues — feedback and PRs welcome."
      ctaLabel="Browse GitHub Issues"
      ctaHref={ISSUES_LINK}
    />
  );
}
