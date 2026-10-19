"use client";

import clsx from "clsx";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { toast } from "react-toastify";
import { LuArrowRight, LuClock, LuListChecks, LuUser } from "react-icons/lu";
import { useQuery } from "@tanstack/react-query";
import type { SoloView, StateSyncPayload } from "@buzrr/contract";
import { DEFAULT_AVATAR } from "@/constants";
import { useAppDispatch, useAppSelector } from "@/state/hooks";
import { applySync, resetGame, setConnection } from "@/state/game/gameSlice";
import { getApiErrorMessage } from "@/lib/api/errors";
import { clearPlayerLocalSession } from "@/lib/player-session";
import { soloApi } from "@/lib/modules/solo/api";
import { pl, tx, useLocale, useT } from "@/lib/i18n/context";
import { LeaderBoard, Question, Result } from "@/components/Player/GameScreens";
import type { AnswerSender } from "@/components/Player/GameScreens/Question";
import CreatePlayerForm from "@/components/Player/Setup/CreatePlayerForm";
import JoinShell from "@/components/Player/Setup/JoinShell";
import ProfilePreview from "@/components/Player/Setup/ProfilePreview";
import { PROFILES } from "@/components/Player/SelectProfile";
import GetReady from "@/components/Game/GetReady";
import {
  labelClass,
  mutedText,
  panelClass,
  primaryButtonClass,
  subtleCardClass,
} from "@/components/Game/GameUI";

/** Remembers that this device has started the test, to pick it up again. */
const startedKey = (code: string) => `solo:${code}:started`;

const hasPlayer = () =>
  typeof window !== "undefined" &&
  Boolean(
    window.localStorage.getItem("playerId") &&
    window.localStorage.getItem("playerToken"),
  );

/**
 * "Play alone": one player's run through a test, at their own pace. The
 * server sends the live game's question and result payloads, applied to the
 * same game state, so the usual player screens render them.
 */
export default function SoloPlayClient({ code: rawCode }: { code: string }) {
  const t = useT();
  const code = rawCode.replace(/\s/g, "").toUpperCase();
  const dispatch = useAppDispatch();
  const phase = useAppSelector((s) => s.game.phase);
  const question = useAppSelector((s) => s.game.question);
  const you = useAppSelector((s) => s.game.you);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<SoloView | null>(null);
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState({ name: "", image: PROFILES[0] });

  const info = useQuery({
    queryKey: ["solo", "info", code],
    queryFn: () => soloApi.info(code),
    retry: false,
  });

  useEffect(() => {
    dispatch(resetGame());
    dispatch(setConnection("connected"));
    setReady(hasPlayer());
  }, [dispatch]);

  /** The server's view of the attempt, onto the game state. */
  const apply = useCallback(
    (v: SoloView) => {
      setView(v);
      if (v.phase !== "question" && v.phase !== "reveal") return;
      const sync: StateSyncPayload = {
        phase: v.phase,
        mode: "classic",
        qIndex: v.qIndex,
        qCount: v.qCount,
        question: v.question,
        remainingMs: v.remainingMs,
        reveal: v.reveal,
        players: [],
        you: v.you,
      };
      dispatch(resetGame());
      dispatch(setConnection("connected"));
      dispatch(applySync(sync));
    },
    [dispatch],
  );

  // `tx`, not `t`: a stable callback (`t` is new on every render).
  const fail = useCallback((err: unknown) => {
    if (isAxiosError(err) && err.response?.status === 401) {
      // The guest token ran out: a new profile starts a new run.
      clearPlayerLocalSession();
      setReady(false);
      toast.error(tx("Your session expired. Please try again."));
      return;
    }
    toast.error(getApiErrorMessage(err));
  }, []);

  const run = useCallback(
    async (step: () => Promise<SoloView>) => {
      setBusy(true);
      try {
        apply(await step());
      } catch (err) {
        fail(err);
      } finally {
        setBusy(false);
      }
    },
    [apply, fail],
  );

  /** Starts (or picks up) the run; a fresh one opens its first question. */
  const start = useCallback(
    () =>
      run(async () => {
        const v = await soloApi.start(code);
        try {
          window.localStorage.setItem(startedKey(code), "1");
        } catch {}
        return v.phase === "intro" ? soloApi.next(v.attemptId) : v;
      }),
    [run, code],
  );
  const refresh = useCallback(
    () => run(() => soloApi.start(code)),
    [run, code],
  );

  // A device that started this test picks it up where it was.
  useEffect(() => {
    if (!ready) return;
    let started = false;
    try {
      started = window.localStorage.getItem(startedKey(code)) === "1";
    } catch {}
    if (started) void refresh();
  }, [ready, code, refresh]);

  // Time's up on an unanswered question: the server records the miss.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (view?.phase !== "question" || you?.answered) return;
    timer.current = setTimeout(
      () => void refresh(),
      (view.remainingMs ?? 0) + 700,
    );
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [view, you, refresh]);

  const send = useCallback<AnswerSender>(
    (payload, ack) => {
      if (!view) return;
      soloApi
        .answer(view.attemptId, payload)
        .then((v) => {
          ack({
            accepted: true,
            answer: v.you?.answer ?? payload.answer,
            timeTakenMs: v.you?.timeTakenMs ?? undefined,
          });
          apply(v);
        })
        .catch((err) => {
          ack({ accepted: false, reason: getApiErrorMessage(err) });
        });
    },
    [view, apply],
  );

  if (info.isPending) return <GetReady title={t("Play alone")} />;
  if (info.isError || !info.data) {
    return (
      <Notice
        title={t("Test not found")}
        text={t("This link is invalid or the test was deleted.")}
      />
    );
  }
  const test = info.data;

  if (!ready) {
    return (
      <JoinShell
        form={
          <CreatePlayerForm
            data={profile}
            setData={setProfile}
            onCreated={() => setReady(true)}
            subtitle={
              <>
                {t("Test")}:{" "}
                <b className="font-bold text-lprimary dark:text-dprimary">
                  {test.title}
                </b>
              </>
            }
          />
        }
        preview={<ProfilePreview name={profile.name} image={profile.image} />}
      />
    );
  }

  if (view?.phase === "done") {
    return (
      <LeaderBoard
        playerId={window.localStorage.getItem("playerId") ?? ""}
        position={view.final?.rank ?? null}
        score={view.totalScore}
        quizTitle={test.title}
        players={view.final?.of}
      />
    );
  }

  if (view && phase === "question" && question) {
    return (
      <Question
        question={question}
        send={send}
        resync={() => void refresh()}
        quizTitle={test.title}
        gameCode={test.code}
        hideRoomCode
        hostName={test.hostName}
        hostImage={test.hostImage}
      />
    );
  }

  if (view && phase === "reveal") {
    const last = view.qIndex >= view.qCount - 1;
    return (
      <Result
        you={you}
        gameCode={test.code}
        quizTitle={test.title}
        hideRoomCode
        hostName={test.hostName}
        hostImage={test.hostImage}
        next={
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => soloApi.next(view.attemptId))}
            className={clsx(primaryButtonClass, "px-6")}
          >
            {last ? t("See my result") : t("Next question")}
            <LuArrowRight size={18} />
          </button>
        }
      />
    );
  }

  return (
    <Intro
      title={test.title}
      hostName={test.hostName}
      hostImage={test.hostImage}
      questionCount={test.questionCount}
      closesAt={test.closesAt}
      closed={test.closed}
      busy={busy}
      onStart={() => void start()}
    />
  );
}

function Intro(props: {
  title: string;
  hostName: string | null;
  hostImage: string | null;
  questionCount: number;
  closesAt: string | null;
  closed: boolean;
  busy: boolean;
  onStart: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  return (
    <div className="flex flex-col items-center justify-center min-h-[85dvh] px-4 py-8 text-dark dark:text-white">
      <div
        className={clsx(
          panelClass,
          "w-full max-w-md px-6 sm:px-10 py-10 text-center animate-fade-up",
        )}
      >
        <span className={labelClass}>{t("Play alone")}</span>
        <h1 className="mt-4 text-[28px] md:text-[34px] font-extrabold tracking-[-0.02em] leading-[1.1] break-words">
          {props.title}
        </h1>
        {props.hostName && (
          <p
            className={clsx(
              "mt-3 inline-flex items-center gap-2 text-sm",
              mutedText,
            )}
          >
            <Image
              src={props.hostImage || DEFAULT_AVATAR}
              width={24}
              height={24}
              alt=""
              className="size-6 rounded-full object-cover"
            />
            {t("Quiz by")} <b>{props.hostName}</b>
          </p>
        )}
        <ul
          className={clsx(
            "mt-6 flex flex-col gap-2.5 rounded-2xl p-4 text-left text-sm",
            subtleCardClass,
          )}
        >
          <li className="flex items-center gap-2.5">
            <LuListChecks size={18} className="shrink-0" />
            {t(pl(props.questionCount, "{n} question", "{n} questions"), {
              n: props.questionCount,
            })}
          </li>
          <li className="flex items-center gap-2.5">
            <LuClock size={18} className="shrink-0" />
            {t("Each question has a time limit — the faster, the more points.")}
          </li>
          <li className="flex items-center gap-2.5">
            <LuUser size={18} className="shrink-0" />
            {t("You play on your own, at your own pace between questions.")}
          </li>
        </ul>
        {props.closesAt && !props.closed && (
          <p className={clsx("mt-4 text-sm", mutedText)}>
            {t("Open until {date}", {
              date: new Date(props.closesAt).toLocaleString(locale, {
                dateStyle: "medium",
                timeStyle: "short",
              }),
            })}
          </p>
        )}
        {props.closed ? (
          <p className="mt-6 font-bold text-red-light dark:text-red-dark">
            {t("This test is closed.")}
          </p>
        ) : (
          <button
            type="button"
            disabled={props.busy}
            onClick={props.onStart}
            className={clsx(primaryButtonClass, "mt-6 w-full px-6")}
          >
            {t("Start")}
            <LuArrowRight size={18} />
          </button>
        )}
      </div>
    </div>
  );
}

function Notice({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[85dvh] px-4 text-dark dark:text-white">
      <div
        className={clsx(
          panelClass,
          "w-full max-w-md px-6 py-10 text-center animate-fade-up",
        )}
      >
        <h1 className="text-2xl font-extrabold">{title}</h1>
        <p className={clsx("mt-3", mutedText)}>{text}</p>
      </div>
    </div>
  );
}
