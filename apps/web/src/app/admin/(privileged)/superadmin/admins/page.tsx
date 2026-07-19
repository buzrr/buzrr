import NavbarToggle from "@/components/Admin/NavbarToggle";
import AdminsListClient from "@/components/Admin/Superadmin/AdminsListClient";

export default function Page() {
  return (
    <div className="p-6 w-full">
      <div className="flex items-center">
        <span className="md:hidden inline">
          <NavbarToggle />
        </span>
        <h1 className="text-md md:text-3xl font-black md:py-2 dark:text-white">
          Manage Admins
        </h1>
      </div>
      <AdminsListClient />
    </div>
  );
}
