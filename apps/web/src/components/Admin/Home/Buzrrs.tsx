"use client";

import ClientBuzrrs from "./ClientBuzrrs";
import LoaderBuzrrs from "./LoaderBuzrrs";
import QuizActionCards from "./QuizActionCards";
import { useQuizzesQuery } from "@/lib/modules/quizzes/hooks";

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

  return (
    <>
      <SectionLabel className="mb-3.5">Start something new</SectionLabel>
      <QuizActionCards />

      <SectionLabel
        className="mt-7 md:mt-[30px] mb-3.5"
        count={quizzes?.length}
      >
        Your quizzes
      </SectionLabel>
      {isPending ? (
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
