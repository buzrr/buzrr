import type { Metadata } from "next";
import ComingSoon from "@/components/Landing/ComingSoon";
import { COMMITS_LINK } from "@/components/Landing/links";

export const metadata: Metadata = {
  title: "Changelog",
  description:
    "Buzrr release notes are coming soon — every change ships in public on GitHub in the meantime.",
};

export default function ChangelogPage() {
  return (
    <ComingSoon
      title="Changelog"
      description="Release notes are coming soon. Every change ships in public — follow along on the commit history in the meantime."
      ctaLabel="View Commit History"
      ctaHref={COMMITS_LINK}
    />
  );
}
