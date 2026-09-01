import { redirect } from "next/navigation";
import { headers } from "next/headers";
import SpaceWorkspaceClient from "@/components/Admin/AI/SpaceWorkspaceClient";
import { auth } from "@/lib/auth";

export default async function KnowledgeSpacePage({
  params,
}: {
  params: Promise<{ spaceId: string }>;
}) {
  const { spaceId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect("/auth/login");

  return <SpaceWorkspaceClient spaceId={spaceId} />;
}
