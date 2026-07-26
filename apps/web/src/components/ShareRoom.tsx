"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { LuCheck, LuCopy, LuShare2 } from "react-icons/lu";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import clsx from "clsx";
import { Button } from "@/components/ui/Button";

/**
 * Share widget: a scannable QR + copyable link. Used for hosted-quiz join links
 * (lobby `full`, in-game sidebar `compact`) and for 1v1 friend challenges — it
 * takes a ready-made URL so it stays agnostic about what it's sharing.
 */
export default function ShareRoom({
  url,
  variant = "full",
  caption = "SCAN TO JOIN",
  toastMessage = "Join link copied!",
}: {
  url: string;
  variant?: "full" | "compact";
  caption?: string;
  toastMessage?: string;
}) {
  const [copied, setCopied] = useState(false);
  // Resolved after mount: reading `navigator` during render would make the SSR
  // and first client render disagree, which React flags as a hydration error.
  const [canShare, setCanShare] = useState(false);
  const compact = variant === "compact";
  const qrSize = compact ? 96 : 160;

  useEffect(() => {
    setCanShare(typeof navigator.share === "function");
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success(toastMessage);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  }

  async function handleShare() {
    try {
      await navigator.share({ url });
    } catch {
      // Cancelling the share sheet rejects — not an error worth surfacing.
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
          {caption}
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

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          leftIcon={copied ? <LuCheck size={16} /> : <LuCopy size={16} />}
          aria-label="Copy link"
        >
          {copied ? "Copied" : "Copy link"}
        </Button>

        {canShare && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleShare()}
            leftIcon={<LuShare2 size={16} />}
            aria-label="Share link"
          >
            Share
          </Button>
        )}
      </div>
    </div>
  );
}
