import AdminShell from "@/components/Admin/AdminShell";
import ProfileClient from "@/components/Admin/Profile/ProfileClient";

export default function Page() {
  return (
    <AdminShell>
      <ProfileClient />
    </AdminShell>
  );
}
