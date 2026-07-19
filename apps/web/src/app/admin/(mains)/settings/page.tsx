import AdminShell from "@/components/Admin/AdminShell";
import SettingsClient from "@/components/Admin/Settings/SettingsClient";

export default function Page() {
  return (
    <AdminShell>
      <SettingsClient />
    </AdminShell>
  );
}
