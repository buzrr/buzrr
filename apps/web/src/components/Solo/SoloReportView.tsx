"use client";

import Report from "@/components/Admin/Report/Report";
import Skeleton from "@/components/ui/Skeleton";
import { useSoloReportQuery } from "@/lib/modules/solo/hooks";
import { useLocale, useT } from "@/lib/i18n/context";

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
  const t = useT();
  const locale = useLocale();
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
          {t("Could not load the report.")}
        </p>
      ) : (
        <>
          <p className="text-2xl text-center font-black text-dark dark:text-white">
            {t("{title} — Test", { title: data.test.title })}
          </p>
          <p className="text-sm text-dark dark:text-white text-center">
            {t("Test {code} · {finished} of {started} finished", {
              code: data.test.code,
              finished: data.test.finished,
              started: data.test.started,
            })}
            {data.test.closesAt &&
              ` · ${t(
                data.test.closed ? "Closed {date}" : "Open until {date}",
                {
                  date: new Date(data.test.closesAt).toLocaleString(locale, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }),
                },
              )}`}
          </p>
          <Report
            title={data.test.title}
            entries={data.entries.map((e) => ({
              ...e,
              name: e.finished
                ? e.name
                : `${e.name} (${t("{n} of {total}", {
                    n: e.progress,
                    total: data.test.questionCount,
                  })})`,
            }))}
            questions={data.questions}
            emptyText={t("Nobody has played this test yet.")}
          />
        </>
      )}
    </div>
  );
}
