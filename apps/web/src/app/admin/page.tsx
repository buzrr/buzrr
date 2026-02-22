import { Suspense } from "react";
import NavbarToggle from "@/components/Admin/NavbarToggle";
import Navbar from "@/components/Admin/Navbar";
import GridListToggle from "@/components/Admin/GridListToggle";
import Buzrrs from "@/components/Admin/Home/Buzrrs";
import LoaderBuzrrs from "@/components/Admin/Home/LoaderBuzrrs";

export default function Home() {
  return (
    <div className="flex">
      <Navbar />
      <div className="p-6 w-full md:w-[75%]">
        <div className="flex justify-between">
          <span className="md:hidden inline">
            <NavbarToggle />
          </span>
          <span className="ml-2">
            <p className="dark:text-white text-xs md:text-base">
              Hey There 👋!
            </p>
            <h1 className="text-md md:text-3xl font-black md:py-2 text-dark dark:text-white">
              Welcome Back To Your Quiz Hub!
            </h1>
          </span>
          <GridListToggle />
        </div>
        <Suspense fallback={<LoaderBuzrrs cardCount={3} />}>
          <Buzrrs />
        </Suspense>
      </div>
    </div>
  );
}
