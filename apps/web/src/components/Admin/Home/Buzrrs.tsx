"use client";

import ClientBuzrrs from "./ClientBuzrrs";
import LoaderBuzrrs from "./LoaderBuzrrs";
import QuizActionCards from "./QuizActionCards";
import { useQuizzesQuery } from "@/lib/modules/quizzes/hooks";
import { useEffect, useState } from "react";
import Switch from "@/components/ui/Switch";
import { authClient } from "@/lib/auth-client";
import { useCurrentRole } from "@/components/SessionProvider";
import AllQuizzesAdmin from "./AllQuizzesAdmin";

const ALL_KEY = "buzrr:admin-all-quizzes";

function SectionLabel({
  children,
  count,
  className,
}: {
  children: React.ReactNode;
  count?: number;
  className?: string;
}) {
  return (
    <h2
      className={`flex items-center gap-2.5 whitespace-nowrap text-xs md:text-[13px] font-semibold tracking-[0.08em] uppercase text-[#8a8896] dark:text-muted-dark ${className ?? ""}`}
    >
      {children}
      {count !== undefined && (
        <span className="rounded-full px-2.5 py-0.5 text-xs tracking-normal bg-lprimary/10 dark:bg-white/5 text-off-dark dark:text-muted-dark">
          {count}
        </span>
      )}
    </h2>
  );
}

const Buzrrs = () => {
  const { data: quizzes, isPending, isError } = useQuizzesQuery();
  const role = useCurrentRole();
  const isAdmin = role === "admin" || role === "superadmin";
  const { data: session } = authClient.useSession();
  // Admins: "show all quizzes" (remembered per browser).
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    try {
      setShowAll(window.localStorage.getItem(ALL_KEY) === "on");
    } catch {
      // ignore
    }
  }, []);
  const toggleAll = (on: boolean) => {
    setShowAll(on);
    try {
      window.localStorage.setItem(ALL_KEY, on ? "on" : "off");
    } catch {
      // ignore
    }
  };

  return (
    <>
      <SectionLabel className="mb-3.5">Start something new</SectionLabel>
      <QuizActionCards />

      <div className="mt-7 md:mt-[30px] mb-3.5 flex flex-wrap items-center gap-4">
        <SectionLabel count={showAll && isAdmin ? undefined : quizzes?.length}>
          {showAll && isAdmin ? "All quizzes" : "Your quizzes"}
        </SectionLabel>
        {isAdmin && (
          <label className="ml-auto flex items-center gap-2 text-sm text-dark dark:text-white">
            <Switch
              aria-label="Show all quizzes"
              checked={showAll}
              onCheckedChange={toggleAll}
            />
            Show all quizzes
          </label>
        )}
      </div>
      {showAll && isAdmin ? (
        <AllQuizzesAdmin
          me={
            session?.user
              ? { id: session.user.id, email: session.user.email }
              : null
          }
        />
      ) : isPending ? (
        <LoaderBuzrrs cardCount={3} />
      ) : isError || !quizzes ? (
        <p className="text-dark dark:text-white text-sm">
          Could not load quizzes. Check your connection and API configuration.
        </p>
      ) : (
        <ClientBuzrrs quizzes={quizzes} />
      )}
    </>
  );
};

export default Buzrrs;
