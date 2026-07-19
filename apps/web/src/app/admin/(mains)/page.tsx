import NavbarToggle from "@/components/Admin/NavbarToggle";
import GridListToggle from "@/components/Admin/GridListToggle";
import AdminHomeHeader from "@/components/Admin/Home/AdminHomeHeader";
import Buzrrs from "@/components/Admin/Home/Buzrrs";

export default function Home() {
  return (
    <div className="p-4 md:p-6 w-full">
      <div className="flex justify-between items-center gap-2">
        <span className="md:hidden inline">
          <NavbarToggle />
        </span>
        <AdminHomeHeader />
        <GridListToggle />
      </div>
      <div className="mt-4 bg-white dark:bg-dark rounded-2xl p-4 md:p-6 min-h-[60vh]">
        <Buzrrs />
      </div>
    </div>
  );
}
