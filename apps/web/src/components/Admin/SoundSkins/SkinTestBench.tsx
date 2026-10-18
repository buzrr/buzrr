"use client";

import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { LuPlay, LuSquare } from "react-icons/lu";
import type { SoundSlot } from "@buzrr/contract";
import { Switch } from "@/components/ui/Switch";
import { mutedText } from "@/components/Game/GameUI";
import { useT } from "@/lib/i18n/context";
import { audioContext, type SoundHandle } from "@/lib/sound/synth";

/** Like the game: the countdown before a question, the tusch → reveal gap. */
const COUNTDOWN_MS = 5000;
const REVEAL_AFTER_END_MS = 900;
const REVEAL_SHOW_MS = 5000;
const SCORES_SHOW_MS = 10_000;
/** Like the game: reveal / scores songs fade out this long before the next. */
const FADE_OUT_MS = 1000;

type Stage = "countdown" | "question" | "reveal" | "scores";

/** Plays one slot the way the game does; null = this skin has nothing there. */
export type SlotPlayer = (
  slot: SoundSlot,
  extra: { remainingMs?: number; progress?: () => number },
) => SoundHandle | null;

/**
 * Plays a question round with this skin, timed like a game: countdown (5 s),
 * the question for the chosen time, the tusch, then optionally the reveal
 * and the scoreboard — with the time left on screen.
 */
export function SkinTestBench({
  play,
  hasLastQuestion = false,
  countdownTailMs = 0,
  lastCountdownTailMs,
}: {
  play: SlotPlayer;
  /** How long the countdown song plays on after 0 (the question music waits). */
  countdownTailMs?: number;
  /** The same for the last question's countdown (default: as above). */
  lastCountdownTailMs?: number;
  /** The skin has a song for the last question: offer to test that one. */
  hasLastQuestion?: boolean;
}) {
  const t = useT();
  const [seconds, setSeconds] = useState(20);
  const [withReveal, setWithReveal] = useState(true);
  const [withScores, setWithScores] = useState(true);
  const [lastQuestion, setLastQuestion] = useState(false);
  const [stage, setStage] = useState<Stage | null>(null);
  const [endsAt, setEndsAt] = useState(0);
  const [now, setNow] = useState(0);
  const handles = useRef<SoundHandle[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const stopAll = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    handles.current.forEach((h) => h.stop());
    handles.current = [];
    setStage(null);
  };
  useEffect(() => () => stopAll(), []);
  useEffect(() => {
    if (!stage) return;
    const tick = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(tick);
  }, [stage]);

  const keep = (h: SoundHandle | null) => {
    if (h) handles.current.push(h);
    return h;
  };
  const at = (ms: number, fn: () => void) =>
    timers.current.push(setTimeout(fn, ms));
  const enter = (s: Stage, durationMs: number) => {
    setStage(s);
    setEndsAt(Date.now() + durationMs);
    setNow(Date.now());
  };

  const start = () => {
    stopAll();
    void audioContext()?.resume();
    const questionMs = seconds * 1000;
    enter("countdown", COUNTDOWN_MS);
    // The last question: its own countdown / music (the player falls back).
    const last = hasLastQuestion && lastQuestion;
    const countdownSong = keep(
      play(last ? "lastCountdown" : "countdown", {
        remainingMs: COUNTDOWN_MS,
      }),
    );
    const tailMs = last
      ? (lastCountdownTailMs ?? countdownTailMs)
      : countdownTailMs;
    at(COUNTDOWN_MS, () => {
      // Like the game: the countdown song stops (after its "after 0"
      // seconds) and the question music starts once it is over.
      countdownSong?.stop();
      enter("question", questionMs);
      const t0 = Date.now();
      const bed: { h: SoundHandle | null } = { h: null };
      const tail = Math.min(tailMs, questionMs);
      const startBed = () => {
        bed.h = keep(
          play(last ? "lastQuestion" : "question", {
            remainingMs: questionMs - tail,
            progress: () => Math.min(1, (Date.now() - t0) / questionMs),
          }),
        );
      };
      if (tail > 0) at(tail, startBed);
      else startBed();
      at(questionMs, () => {
        // Phase over: the bed stops (an end-aligned song plays on its extend).
        bed.h?.stop();
        keep(play("end", {}));
        let revealSong: SoundHandle | null = null;
        if (withReveal) {
          enter("reveal", REVEAL_SHOW_MS);
          at(REVEAL_AFTER_END_MS, () => {
            revealSong = keep(play("reveal", {}));
          });
        }
        const revealEnd = withReveal ? REVEAL_SHOW_MS : REVEAL_AFTER_END_MS;
        // Leaving the reveal: its song fades out, the scores start after it.
        at(revealEnd, () => revealSong?.stop(FADE_OUT_MS / 1000));
        const scoresAt = withReveal ? revealEnd + FADE_OUT_MS : revealEnd;
        if (withScores) {
          at(scoresAt, () => {
            enter("scores", SCORES_SHOW_MS);
            const bedScores = keep(play("scores", {}));
            at(SCORES_SHOW_MS, () => bedScores?.stop(FADE_OUT_MS / 1000));
            at(SCORES_SHOW_MS + FADE_OUT_MS, stopAll);
          });
        } else {
          at(scoresAt + 1500, stopAll);
        }
      });
    });
  };

  const left = Math.max(0, Math.ceil((endsAt - now) / 1000));
  const labels: Record<Stage, string> = {
    countdown: t("Countdown"),
    question: t("Question"),
    reveal: t("Reveal"),
    scores: t("Scores"),
  };

  return (
    <div className="flex flex-col gap-2.5 rounded-xl bg-lprimary/5 dark:bg-white/3 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex items-center gap-1.5">
          {t("Question time")}
          <input
            type="number"
            min={3}
            max={300}
            value={seconds}
            onChange={(e) =>
              setSeconds(
                Math.min(300, Math.max(3, Number(e.target.value) || 3)),
              )
            }
            className="w-20 rounded-lg border border-lprimary/20 dark:border-white/10 bg-transparent px-2 py-1 tabular-nums"
          />
          s
        </label>
        {hasLastQuestion && (
          <label className="flex items-center gap-2">
            <Switch
              aria-label={t("Last question")}
              checked={lastQuestion}
              onCheckedChange={setLastQuestion}
            />
            {t("Last question")}
          </label>
        )}
        <label className="flex items-center gap-2">
          <Switch
            aria-label={t("Reveal")}
            checked={withReveal}
            onCheckedChange={setWithReveal}
          />
          {t("Reveal")}
        </label>
        <label className="flex items-center gap-2">
          <Switch
            aria-label={t("Scores")}
            checked={withScores}
            onCheckedChange={setWithScores}
          />
          {t("Scores")}
        </label>
        <button
          type="button"
          onClick={stage ? stopAll : start}
          className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-white bg-lprimary dark:bg-dprimary dark:text-dark cursor-pointer"
        >
          {stage ? <LuSquare size={12} /> : <LuPlay size={12} />}
          {stage ? t("Stop") : t("Start test")}
        </button>
      </div>
      {stage && (
        <div className="flex items-baseline gap-3" aria-live="polite">
          <span className="font-bold">{labels[stage]}</span>
          <span
            className={clsx(
              "tabular-nums font-extrabold",
              stage === "countdown" ? "text-3xl" : "text-xl",
            )}
          >
            {left}
          </span>
          <span className={clsx("text-xs", mutedText)}>
            {t("seconds left")}
          </span>
        </div>
      )}
    </div>
  );
}
