import JoinViaLinkClient from "@/components/Player/Setup/JoinViaLinkClient";

export default async function JoinViaLink({
  params,
}: {
  params: Promise<{ gameCode: string }>;
}) {
  const { gameCode } = await params;
  // Next already decodes the route segment; decoding again throws on a lone
  // "%" and other malformed input. Pass it through — the client normalizes it
  // and an unknown code is handled as an invalid link.
  return <JoinViaLinkClient gameCode={gameCode} />;
}
