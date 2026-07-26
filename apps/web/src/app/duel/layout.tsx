export default function DuelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The session gate lives in the individual pages (see lib/duel-session.ts) so
  // deep links such as an invite URL survive the login round-trip.
  return (
    <div className="min-h-dvh bg-light-bg dark:bg-dark-bg">{children}</div>
  );
}
