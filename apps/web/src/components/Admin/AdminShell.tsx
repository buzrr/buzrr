import Navbar from "@/components/Admin/Navbar";

/**
 * Shared admin page frame: a sidebar pinned to the left edge that stays put
 * while the content column scrolls. `data-admin-shell` also hides the top logo
 * bar in `app/admin/layout.tsx`, since the sidebar shows the logo instead.
 */
export default function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div data-admin-shell className="flex w-full sm:px-6 md:pr-0">
      <Navbar />
      <div className="w-full min-w-0 md:flex-1">
        <div className="mx-auto max-w-6xl">{children}</div>
      </div>
    </div>
  );
}
