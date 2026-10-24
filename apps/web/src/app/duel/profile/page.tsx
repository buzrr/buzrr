import Link from "next/link";
import SessionProvider from "@/components/SessionProvider";
import ProfileDetails from "@/components/Admin/Profile/ProfileDetails";
import { requireDuelSession } from "@/lib/duel-session";
import { getUserRole } from "@/lib/get-current-role";
import { getT } from "@/lib/i18n/server";

export default async function Page() {
  const session = await requireDuelSession("/duel/profile");
  const role = await getUserRole(session.user.id);
  const t = await getT();

  return (
    <SessionProvider role={role}>
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Link
          href="/duel"
          className="inline-block mb-4 text-sm text-lprimary dark:text-dprimary font-bold hover:underline"
        >
          {t("← Back to duel")}
        </Link>
        <h1 className="text-2xl font-black text-dark dark:text-white mb-4">
          {t("Profile")}
        </h1>
        <ProfileDetails />
      </div>
    </SessionProvider>
  );
}
