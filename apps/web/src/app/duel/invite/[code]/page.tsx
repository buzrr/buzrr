import DuelInviteClient from "@/components/Duel/DuelInviteClient";
import { requireDuelSession } from "@/lib/duel-session";

export default async function Page({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  // Gating here (rather than in the layout) is what lets a signed-out friend
  // land back on this exact challenge after logging in.
  await requireDuelSession(`/duel/invite/${code}`);
  return <DuelInviteClient code={code.toUpperCase()} />;
}
