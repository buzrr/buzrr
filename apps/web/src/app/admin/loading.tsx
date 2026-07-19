import AdminShell from "@/components/Admin/AdminShell";
import { ContentLoader } from "@/components/ui/RouteLoader";

export default function Loading() {
  return (
    <AdminShell>
      <ContentLoader />
    </AdminShell>
  );
}
