import JoinViaLinkClient from "@/components/Player/Setup/JoinViaLinkClient";

export default async function JoinViaLink({
  params,
}: {
  params: Promise<{ gameCode: string }>;
}) {
  const { gameCode } = await params;
  return <JoinViaLinkClient gameCode={decodeURIComponent(gameCode)} />;
}
