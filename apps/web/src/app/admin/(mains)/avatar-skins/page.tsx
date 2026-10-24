import { getT } from "@/lib/i18n/server";
import NavbarToggle from "@/components/Admin/NavbarToggle";
import AvatarSkinsClient from "@/components/Admin/AvatarSkins/AvatarSkinsClient";

export default async function Page() {
  const t = await getT();
  return (
    <div className="p-6 w-full">
      <div className="flex items-center">
        <span className="md:hidden inline">
          <NavbarToggle />
        </span>
        <h1 className="text-md md:text-3xl font-black md:py-2 dark:text-white">
          {t("Avatar Skins")}
        </h1>
      </div>
      <AvatarSkinsClient />
    </div>
  );
}
