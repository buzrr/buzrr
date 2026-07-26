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
