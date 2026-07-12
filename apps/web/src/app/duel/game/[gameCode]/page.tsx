import DuelGameClient from "@/components/Duel/DuelGameClient";

export default async function Page({
  params,
}: {
  params: Promise<{ gameCode: string }>;
}) {
  const { gameCode } = await params;
  return <DuelGameClient gameCode={gameCode} />;
}
