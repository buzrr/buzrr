"use client";

import { useState } from "react";
import clsx from "clsx";
import { toast } from "react-toastify";
import { LuDownload } from "react-icons/lu";
import ProBadge from "@/components/Billing/ProBadge";
import { usePlanLimitPrompt } from "@/components/Billing/UpgradePrompt";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useProFeature } from "@/lib/modules/billing/hooks";
import { gameSessionsApi } from "@/lib/modules/game-sessions/api";

/**
 * Pro: downloads the session report PDF. `roomId` reads a room still on its
 * final leaderboard (live, the room stays open); `resultId` reads the report
 * saved with a finished game. Free accounts get the upgrade prompt.
 */
export default function DownloadReportButton({
  source,
  className,
}: {
  source: { roomId: string } | { resultId: string };
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const { isPro, showBadge } = useProFeature();
  const { handlePlanLimit, promptForFeature, upgradePrompt } =
    usePlanLimitPrompt();

  async function download() {
    if (!isPro) {
      promptForFeature("session_report");
      return;
    }
    setBusy(true);
    try {
      const report =
        "roomId" in source
          ? await gameSessionsApi.liveReport(source.roomId)
          : await gameSessionsApi.resultReport(source.resultId);
      const { downloadSessionReport } =
        await import("@/lib/report/sessionReportPdf");
      await downloadSessionReport(report);
    } catch (err) {
      if (!handlePlanLimit(err)) toast.error(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void download()}
        disabled={busy}
        className={clsx(
          "relative flex items-center justify-center gap-2 whitespace-nowrap rounded-[14px] border-[1.5px] border-lprimary dark:border-dprimary px-6 py-3 text-base font-bold text-lprimary dark:text-dprimary transition-colors hover:bg-lprimary/8 dark:hover:bg-white/5 cursor-pointer disabled:opacity-50 disabled:cursor-default",
          className,
        )}
      >
        {showBadge && <ProBadge />}
        <LuDownload size={18} />
        {busy ? "Preparing report…" : "Download report"}
      </button>
      {upgradePrompt}
    </>
  );
}
