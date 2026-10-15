import { redirect } from "next/navigation";

/** The old "Question Review" page now lives in the Duel Portal. */
export default function Page() {
  redirect("/admin/duel-portal");
}
