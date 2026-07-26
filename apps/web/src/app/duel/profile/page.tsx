import Link from "next/link";
import SessionProvider from "@/components/SessionProvider";
import ProfileDetails from "@/components/Admin/Profile/ProfileDetails";
import { requireDuelSession } from "@/lib/duel-session";
import { getUserRole } from "@/lib/get-current-role";

export default async function Page() {
  const session = await requireDuelSession("/duel/profile");
  const role = await getUserRole(session.user.id);

  return (
    <SessionProvider role={role}>
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Link
          href="/duel"
          className="inline-block mb-4 text-sm text-lprimary dark:text-dprimary font-bold hover:underline"
        >
          ← Back to duel
        </Link>
        <h1 className="text-2xl font-black text-dark dark:text-white mb-4">
          Profile
        </h1>
        <ProfileDetails />
      </div>
    </SessionProvider>
  );
}
