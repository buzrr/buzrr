import AdminShell from "@/components/Admin/AdminShell";
import DuelHistoryClient from "@/components/Admin/Profile/DuelHistoryClient";

export default function Page() {
  return (
    <AdminShell>
      <DuelHistoryClient />
    </AdminShell>
  );
}
