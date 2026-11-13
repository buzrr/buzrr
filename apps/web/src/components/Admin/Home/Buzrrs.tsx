"use client";

import ClientBuzrrs from "./ClientBuzrrs";
import LoaderBuzrrs from "./LoaderBuzrrs";
import QuizActionCards from "./QuizActionCards";
import { useQuizzesInfiniteQuery } from "@/lib/modules/quizzes/hooks";
import { useLoadMoreOnScroll } from "@/hooks/useLoadMoreOnScroll";

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
  const query = useQuizzesInfiniteQuery();
  const { data, isPending, hasNextPage, isFetchingNextPage, fetchNextPage } =
    query;
  const quizzes = data?.pages.flatMap((page) => page.items);
  const total = data?.pages[0]?.total ?? quizzes?.length;
  const sentinelRef = useLoadMoreOnScroll({
    // After a failed page, wait for the retry button instead of looping.
    hasMore: hasNextPage && !query.isFetchNextPageError,
    loading: isFetchingNextPage,
    loadMore: () => void fetchNextPage(),
  });

  return (
    <>
      <SectionLabel className="mb-3.5">Start something new</SectionLabel>
      <QuizActionCards />

      <SectionLabel
        className="mt-7 md:mt-[30px] mb-3.5"
        count={total ?? undefined}
      >
        Your quizzes
      </SectionLabel>
      {isPending ? (
        <LoaderBuzrrs cardCount={3} />
      ) : !quizzes ? (
        <p className="text-dark dark:text-white text-sm">
          Could not load quizzes. Check your connection and API configuration.
        </p>
      ) : (
        <>
          <ClientBuzrrs quizzes={quizzes} />
          {isFetchingNextPage && (
            <div className="mt-3 md:mt-4">
              <LoaderBuzrrs cardCount={3} />
            </div>
          )}
          {query.isFetchNextPageError && (
            <button
              type="button"
              onClick={() => void fetchNextPage()}
              className="mt-4 text-sm font-bold text-lprimary dark:text-dprimary hover:underline"
            >
              Couldn&apos;t load more quizzes. Retry
            </button>
          )}
          <div ref={sentinelRef} aria-hidden="true" />
        </>
      )}
    </>
  );
};

export default Buzrrs;
