import NavbarToggle from "@/components/Admin/NavbarToggle";
import Navbar from "@/components/Admin/Navbar";

export default async function Page() {
  return (
    <div className="flex">
      <Navbar />
      <div className="p-6 w-full md:w-[75%]">
        <div className="flex">
          <span className="md:hidden inline">
            <NavbarToggle />
          </span>
          <h1 className="text-md md:text-3xl font-black md:py-2 dark:text-white">
            Settings
          </h1>
        </div>
      </div>
    </div>
  );
}
