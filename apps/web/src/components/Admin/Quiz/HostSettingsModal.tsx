"use client";

import clsx from "clsx";
import { useState } from "react";
import { LuPlay, LuSlidersHorizontal } from "react-icons/lu";
import { DEFAULT_READ_TIME_SEC, type GameSettings } from "@buzrr/contract";
import BasicModal from "@/components/Modal";
import { Segmented } from "@/components/ui/Segmented";
import { Switch } from "@/components/ui/Switch";
import {
  labelClass,
  mutedText,
  primaryButtonClass,
  subtleCardClass,
} from "@/components/Game/GameUI";

type Flow = "together" | "question-first";
type ReadTime = Exclude<GameSettings["readTimeSec"], 0>;

const FLOWS: { value: Flow; label: string; hint: string }[] = [
  {
    value: "together",
    label: "Together",
    hint: "The question and its options appear at once; answering opens straight away.",
  },
  {
    value: "question-first",
    label: "Question first",
    hint: "Players read the question, then the options appear and the timer starts.",
  },
];

const READ_TIMES: { value: ReadTime; label: string }[] = [
  { value: 3, label: "3s" },
  { value: 5, label: "5s" },
  { value: 10, label: "10s" },
];

/**
 * How a hosted session plays, chosen before the lobby opens. Settings are
 * fixed for the room once it is created.
 */
export default function HostSettingsModal(props: {
  open: boolean;
  onClose: () => void;
  onStart: (settings: GameSettings) => void;
  pending: boolean;
}) {
  const [flow, setFlow] = useState<Flow>("together");
  const [readTime, setReadTime] = useState<ReadTime>(
    DEFAULT_READ_TIME_SEC as ReadTime,
  );
  const [reactions, setReactions] = useState(false);
  const hint = FLOWS.find((f) => f.value === flow)!.hint;

  return (
    <BasicModal
      open={props.open}
      onClose={() => !props.pending && props.onClose()}
      btnTitle="Game settings"
      subtitle="Choose how this session plays. You can't change these once the lobby is open."
      icon={<LuSlidersHorizontal size={22} />}
    >
      <div className="flex flex-col gap-4 px-5 pt-6 pb-5 md:px-7 md:pb-7">
        <section
          className={clsx(
            "flex flex-col gap-3 rounded-[18px] p-4",
            subtleCardClass,
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className={labelClass}>Question flow</span>
            <Segmented
              label="Question flow"
              value={flow}
              onChange={setFlow}
              options={FLOWS}
            />
          </div>
          <p className={clsx("text-sm leading-normal", mutedText)}>{hint}</p>
          {flow === "question-first" && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-lprimary/15 dark:border-white/10">
              <span className="text-sm font-semibold">Reading time</span>
              <Segmented
                label="Reading time"
                value={readTime}
                onChange={setReadTime}
                options={READ_TIMES}
              />
            </div>
          )}
        </section>

        <section
          className={clsx(
            "flex items-center justify-between gap-4 rounded-[18px] p-4",
            subtleCardClass,
          )}
        >
          <div className="min-w-0">
            <span id="host-reactions-label" className={labelClass}>
              Player reactions
            </span>
            <p className={clsx("mt-1.5 text-sm leading-normal", mutedText)}>
              Players can send emojis during results and leaderboards. They
              float up on your screen.
            </p>
          </div>
          <Switch
            aria-labelledby="host-reactions-label"
            checked={reactions}
            onCheckedChange={setReactions}
            className="shrink-0 cursor-pointer"
          />
        </section>

        <div className="flex flex-col-reverse md:flex-row md:justify-end gap-2.5 pt-1">
          <button
            type="button"
            onClick={props.onClose}
            disabled={props.pending}
            className={clsx(
              "rounded-[14px] px-6 py-3.5 text-base font-semibold cursor-pointer hover:bg-lprimary/8 dark:hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-default",
              mutedText,
            )}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={props.pending}
            onClick={() =>
              props.onStart({
                readTimeSec: flow === "together" ? 0 : readTime,
                reactions,
              })
            }
            className={primaryButtonClass}
          >
            <LuPlay size={17} className="fill-current" />
            {props.pending ? "Opening lobby..." : "Open lobby"}
          </button>
        </div>
      </div>
    </BasicModal>
  );
}
