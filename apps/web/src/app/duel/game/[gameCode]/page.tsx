import DuelGameClient from "@/components/Duel/DuelGameClient";
import { requireDuelSession } from "@/lib/duel-session";

export default async function Page({
  params,
}: {
  params: Promise<{ gameCode: string }>;
}) {
  const { gameCode } = await params;
  await requireDuelSession(`/duel/game/${gameCode}`);
  return <DuelGameClient gameCode={gameCode} />;
}
