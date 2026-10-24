"use client";

import Report from "@/components/Admin/Report/Report";
import Skeleton from "@/components/ui/Skeleton";
import { useSoloReportQuery } from "@/lib/modules/solo/hooks";

/** A test's report: who played how, and how each question went. */
export default function SoloReportView({
  testId,
  onBack,
  backLabel,
}: {
  testId: string;
  onBack: () => void;
  backLabel: string;
}) {
  const { data, isPending, isError } = useSoloReportQuery(testId);

  return (
    <div className="flex flex-col items-center w-full gap-4">
      <button
        type="button"
        onClick={onBack}
        className="self-start text-sm text-lprimary dark:text-dprimary font-bold hover:underline hover:cursor-pointer"
      >
        ← {backLabel}
      </button>
      {isPending ? (
        <Skeleton className="h-64 w-full max-w-2xl rounded-xl bg-white dark:bg-card-dark" />
      ) : isError || !data ? (
        <p className="text-center text-dark dark:text-white py-8">
          Could not load the report.
        </p>
      ) : (
        <>
          <p className="text-2xl text-center font-black text-dark dark:text-white">
            {data.test.title} — Test
          </p>
          <p className="text-sm text-dark dark:text-white text-center">
            Test {data.test.code} · {data.test.finished} of {data.test.started}{" "}
            finished
            {data.test.closesAt &&
              ` · ${
                data.test.closed
                  ? `Closed ${new Date(data.test.closesAt).toLocaleString(
                      "en",
                      {
                        dateStyle: "medium",
                        timeStyle: "short",
                      },
                    )}`
                  : `Open until ${new Date(data.test.closesAt).toLocaleString(
                      "en",
                      {
                        dateStyle: "medium",
                        timeStyle: "short",
                      },
                    )}`
              }`}
          </p>
          <Report
            title={data.test.title}
            entries={data.entries.map((e) => ({
              ...e,
              name: e.finished
                ? e.name
                : `${e.name} (${`${e.progress} of ${data.test.questionCount}`})`,
            }))}
            questions={data.questions}
            emptyText="Nobody has played this test yet."
          />
        </>
      )}
    </div>
  );
}
