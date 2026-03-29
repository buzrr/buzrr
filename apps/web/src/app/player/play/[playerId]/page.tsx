import PlayPageClient from "@/components/Player/PlayPageClient";

export default async function Page({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  const { playerId } = await params;
  return <PlayPageClient playerId={playerId} />;
}
