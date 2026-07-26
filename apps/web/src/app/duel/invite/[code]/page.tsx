import DuelInviteClient from "@/components/Duel/DuelInviteClient";
import { requireDuelSession } from "@/lib/duel-session";

export default async function Page({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  await requireDuelSession(`/duel/invite/${code}`);
  return <DuelInviteClient code={code.toUpperCase()} />;
}
