import JoinViaLinkClient from "@/components/Player/Setup/JoinViaLinkClient";

import { NOINDEX_METADATA } from "@/lib/seo/metadata";

// App screens, not landing pages: keep them out of search results.
export const metadata = NOINDEX_METADATA;

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
