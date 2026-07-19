import AdminShell from "@/components/Admin/AdminShell";

export default function MainsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
