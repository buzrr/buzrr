import NavbarToggle from "@/components/Admin/NavbarToggle";
import DuelPortalTabs from "@/components/Admin/DuelPortal/DuelPortalTabs";

/** Duel content admin: the question pool, bulk upload and categories. */
export default function DuelPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="p-6 w-full">
      <div className="flex items-center">
        <span className="md:hidden inline">
          <NavbarToggle />
        </span>
        <h1 className="text-md md:text-3xl font-black md:py-2 dark:text-white">
          Duel Portal
        </h1>
      </div>
      <DuelPortalTabs />
      {children}
    </div>
  );
}
