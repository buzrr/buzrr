import { NOINDEX_METADATA } from "@/lib/seo/metadata";

// App screens, not landing pages: keep them out of search results.
export const metadata = NOINDEX_METADATA;

export default function DuelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Session gating lives in the pages — see lib/duel-session.ts.
  return (
    <div className="min-h-dvh bg-light-bg dark:bg-dark-bg">{children}</div>
  );
}
