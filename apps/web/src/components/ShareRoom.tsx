"use client";

import { useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { LuCheck, LuCopy } from "react-icons/lu";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import clsx from "clsx";
import { buildJoinUrl } from "@/lib/join-link";
import { Button } from "@/components/ui/Button";

/**
 * Host-facing share widget: a scannable QR + copyable link that drops players
 * straight into the game (name → join). Shown in the quiz lobby (`full`) and
 * the live in-game sidebar (`compact`).
 */
export default function ShareRoom({
  gameCode,
  variant = "full",
}: {
  gameCode: string;
  variant?: "full" | "compact";
}) {
  const url = useMemo(() => buildJoinUrl(gameCode), [gameCode]);
  const [copied, setCopied] = useState(false);
  const compact = variant === "compact";
  const qrSize = compact ? 96 : 160;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Join link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  }

  return (
    <div
      className={clsx(
        "flex flex-col items-center",
        compact ? "gap-2" : "gap-3",
      )}
    >
      {!compact && (
        <p className="text-sm tracking-[2px] text-gray-500 dark:text-gray-300">
          SCAN TO JOIN
        </p>
      )}

      {/* White backdrop keeps the QR scannable in both light and dark themes. */}
      <div className="rounded-xl bg-white p-2 shadow">
        <QRCodeSVG value={url} size={qrSize} marginSize={0} level="M" />
      </div>

      {!compact && (
        <p className="max-w-full truncate text-center text-sm text-stone-500 dark:text-stone-400">
          {url}
        </p>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={handleCopy}
        leftIcon={copied ? <LuCheck size={16} /> : <LuCopy size={16} />}
        aria-label="Copy join link"
      >
        {copied ? "Copied" : "Copy link"}
      </Button>
    </div>
  );
}
