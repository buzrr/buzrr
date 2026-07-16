import type { Metadata } from "next";
import ComingSoon from "@/components/Landing/ComingSoon";
import { GITHUB_LINK } from "@/components/Landing/links";

export const metadata: Metadata = {
  title: "Docs",
  description:
    "Buzrr documentation — setup guides, self-hosting and API reference are on the way.",
};

export default function DocsPage() {
  return (
    <ComingSoon
      title="Docs"
      description="Full documentation is on the way. Until then, the README covers features, architecture and a local quick start."
      ctaLabel="Read the README"
      ctaHref={`${GITHUB_LINK}#readme`}
    />
  );
}
