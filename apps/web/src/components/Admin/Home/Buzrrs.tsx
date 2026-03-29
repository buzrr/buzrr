"use client";

import ClientBuzrrs from "./ClientBuzrrs";
import LoaderBuzrrs from "./LoaderBuzrrs";
import { useQuizzesQuery } from "@/lib/modules/quizzes/hooks";

const Buzrrs = () => {
  const { data: quizzes, isPending, isError } = useQuizzesQuery();

  if (isPending) {
    return <LoaderBuzrrs cardCount={3} />;
  }

  if (isError || !quizzes) {
    return (
      <p className="text-dark dark:text-white text-sm">
        Could not load quizzes. Check your connection and API configuration.
      </p>
    );
  }

  return <ClientBuzrrs quizzes={quizzes} />;
};

export default Buzrrs;
