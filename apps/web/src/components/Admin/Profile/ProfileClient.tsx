"use client";

import NavbarToggle from "@/components/Admin/NavbarToggle";
import { useT } from "@/lib/i18n/context";
import ProfileDetails from "./ProfileDetails";

export default function ProfileClient() {
  const t = useT();
  return (
    <div className="w-full p-4 md:p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="md:hidden">
          <NavbarToggle />
        </span>
        <h1 className="text-2xl font-black text-dark dark:text-white">
          {t("Profile")}
        </h1>
      </div>
      <ProfileDetails />
    </div>
  );
}
