import Navbar from "@/components/Admin/Navbar";

/**
 * Shared admin page frame: sidebar + content column constrained to the same
 * responsive container as the landing page.
 */
export default function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex w-full max-w-7xl mx-auto sm:px-6 lg:px-8">
      <Navbar />
      <div className="w-full md:w-[75%]">{children}</div>
    </div>
  );
}
