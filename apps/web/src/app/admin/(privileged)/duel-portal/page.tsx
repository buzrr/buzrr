import { moderationListStatusSchema } from "@buzrr/contract";
import QuestionListClient from "@/components/Admin/DuelPortal/QuestionListClient";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const parsed = moderationListStatusSchema.safeParse(status);
  const current = parsed.success ? parsed.data : "pending";
  // Keyed by tab, so switching tabs starts with an empty selection.
  return <QuestionListClient key={current} status={current} />;
}
