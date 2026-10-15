import DuelClient from "@/components/Duel/DuelClient";
import { requireDuelSession } from "@/lib/duel-session";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; auto?: string }>;
}) {
  await requireDuelSession("/duel");
  const { category, auto } = await searchParams;
  return (
    <DuelClient initialCategoryId={category || null} autoStart={auto === "1"} />
  );
}
