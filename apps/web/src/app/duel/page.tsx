import DuelClient from "@/components/Duel/DuelClient";
import { requireDuelSession } from "@/lib/duel-session";

export default async function Page() {
  await requireDuelSession("/duel");
  return <DuelClient />;
}
