"use client";

import { ProLock, useHasPro } from "@/components/Billing/ProFeature";
import clsx from "clsx";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import {
  LuCheck,
  LuChevronRight,
  LuImagePlus,
  LuPencil,
  LuTrash2,
  LuX,
} from "react-icons/lu";
import ConfirmationModal from "@/components/Admin/ConfirmationModal";
import { inputClass } from "@/components/Game/GameUI";
import { toast } from "react-toastify";
import Switch from "@/components/ui/Switch";
import { getApiErrorMessage } from "@/lib/api/errors";
import {
  useDeleteResultsMutation,
  useQuizLogoMutation,
  useUpdateQuizMutation,
} from "@/lib/modules/quizzes/hooks";
import type { QuizDetail } from "@/lib/modules/quizzes/api";
import { useInstance } from "@/lib/instance-context";
import { useT, pl } from "@/lib/i18n/context";
import ModerationSettingsCard from "@/components/Admin/Quiz/ModerationSettingsCard";
import { dropTargetClass, useFileDrop } from "@/hooks/useFileDrop";

function formatSessionDate(createdAt: string | Date) {
  const d = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
  return d.toLocaleString("en-US", { timeZoneName: "short" });
}

/** Title and description, editable in place (pencil → fields → save). */
function EditableHeader({ quiz }: { quiz: QuizDetail }) {
  const t = useT();
  const updateQuiz = useUpdateQuizMutation();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(quiz.title);
  const [description, setDescription] = useState(quiz.description ?? "");
  const start = () => {
    setTitle(quiz.title);
    setDescription(quiz.description ?? "");
    setEditing(true);
  };
  const save = () => {
    const trimmed = title.trim();
    if (!trimmed) {
      toast.error(t("The quiz needs a title"));
      return;
    }
    updateQuiz.mutate(
      { quizId: quiz.id, title: trimmed, description: description.trim() },
      {
        onSuccess: () => setEditing(false),
        onError: (err) => toast.error(getApiErrorMessage(err)),
      },
    );
  };
  if (!editing) {
    return (
      <div className="relative mt-3 mb-4 pr-10">
        <h2 className="text-[26px] md:text-[32px] font-bold tracking-[-0.02em] leading-[1.05] mb-1 wrap-break-word">
          {quiz.title}
        </h2>
        {quiz.description && (
          <p className="text-[15px] text-off-dark dark:text-muted-dark wrap-break-word">
            {quiz.description}
          </p>
        )}
        <button
          type="button"
          aria-label={t("Edit title and description")}
          title={t("Edit title and description")}
          onClick={start}
          className="absolute top-0 right-0 size-9 rounded-[10px] flex items-center justify-center text-lprimary dark:text-dprimary hover:bg-lprimary/10 dark:hover:bg-white/5 cursor-pointer"
        >
          <LuPencil size={18} />
        </button>
      </div>
    );
  }
  return (
    <form
      className="mt-3 mb-4 flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <input
        autoFocus
        value={title}
        maxLength={200}
        onChange={(e) => setTitle(e.target.value)}
        aria-label={t("Quiz title")}
        className={clsx(inputClass, "!py-2.5 text-lg font-bold")}
      />
      <textarea
        value={description}
        maxLength={1000}
        rows={3}
        onChange={(e) => setDescription(e.target.value)}
        aria-label={t("Quiz description")}
        placeholder={t("Description (optional)")}
        className={clsx(inputClass, "!py-2.5 text-[15px] resize-none")}
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold text-off-dark dark:text-muted-dark hover:bg-lprimary/8 dark:hover:bg-white/5 cursor-pointer"
        >
          <LuX size={15} />
          {t("Cancel")}
        </button>
        <button
          type="submit"
          disabled={updateQuiz.isPending}
          className="inline-flex items-center gap-1.5 rounded-xl bg-lprimary dark:bg-dprimary px-3 py-1.5 text-sm font-bold text-white dark:text-dark cursor-pointer disabled:opacity-60"
        >
          <LuCheck size={15} />
          {updateQuiz.isPending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

/** The quiz's own logo: shown on its game screens instead of the site logo. */
function LogoSetting({ quiz }: { quiz: QuizDetail }) {
  const t = useT();
  const logoMutation = useQuizLogoMutation(quiz.id);
  const input = useRef<HTMLInputElement>(null);
  const logo = (quiz as QuizDetail & { logo?: string | null }).logo ?? null;
  const upload = (file: File | null) =>
    logoMutation.mutate(file, {
      onSuccess: () =>
        toast.success(file ? t("Logo saved") : t("Logo removed")),
      onError: (err) => toast.error(getApiErrorMessage(err)),
    });
  const hasPro = useHasPro();
  // A picture dropped onto the row becomes the logo.
  const { over, dropProps } = useFileDrop((file) => {
    if (file.type.startsWith("image/")) upload(file);
    else toast.error(t("Drop a picture"));
  }, logoMutation.isPending);
  if (hasPro === false && !logo) {
    // A Pro feature (an existing logo can still be removed).
    return (
      <div className="flex items-center gap-3 mt-3 mb-1">
        <span className="text-sm font-semibold">{t("Quiz logo")}</span>
        <ProLock what={t("A quiz logo")} />
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 mt-3 mb-1" {...dropProps}>
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={logoMutation.isPending}
        title={logo ? t("Change logo") : t("Upload a logo")}
        className={clsx(
          "relative size-14 shrink-0 rounded-xl border-[1.5px] border-dashed border-lprimary/25 dark:border-white/15 bg-light-bg dark:bg-card-dark flex items-center justify-center overflow-hidden cursor-pointer hover:border-dprimary",
          over && dropTargetClass,
        )}
      >
        {logo ? (
          <Image
            src={logo}
            alt={t("Quiz logo")}
            fill
            sizes="56px"
            className="object-contain p-1"
            unoptimized
          />
        ) : (
          <LuImagePlus size={22} className="text-lprimary dark:text-dprimary" />
        )}
      </button>
      <div className="flex flex-col min-w-0">
        <span className="text-sm font-semibold">{t("Quiz logo")}</span>
        <span className="text-xs text-off-dark dark:text-muted-dark">
          {logoMutation.isPending
            ? "Uploading…"
            : logo
              ? t("Shown in the game instead of the site logo")
              : t("Optional · PNG, JPG, SVG or WebP")}
        </span>
      </div>
      {logo && !logoMutation.isPending && (
        <button
          type="button"
          aria-label={t("Remove logo")}
          title={t("Remove logo")}
          onClick={() => upload(null)}
          className="ml-auto size-8 rounded-[9px] flex items-center justify-center text-off-dark dark:text-muted-dark hover:bg-[#e5544e]/14 hover:text-[#e5544e] cursor-pointer"
        >
          <LuTrash2 size={16} />
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          e.target.value = "";
          if (f) upload(f);
        }}
      />
    </div>
  );
}

/**
 * The quiz info panel body: breadcrumb, description, public toggle and past
 * sessions. Rendered in the fixed desktop panel and inside the mobile drawer
 * (which hides the host form — the mobile top bar already has one).
 */
export function QuizInfoContent(props: {
  quiz: QuizDetail;
  /** Unused: "Host quiz" is a floating button on the quiz page now. */
  showHostForm?: boolean;
  onShowLeaderboard?: (resultId: string) => void;
}) {
  const t = useT();
  const pastGames = props.quiz.gameResults ?? [];
  const questionCount = props.quiz._count?.questions ?? 0;
  const updateQuiz = useUpdateQuizMutation();
  const deleteResults = useDeleteResultsMutation(props.quiz.id);
  const { duels } = useInstance();
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  return (
    <>
      <div className="flex flex-col w-[90%] mx-auto text-dark dark:text-white">
        <nav
          aria-label={t("Breadcrumb")}
          className="flex items-center gap-2 text-[13.5px] font-medium text-off-dark dark:text-muted-dark"
        >
          <Link
            href={"/admin"}
            className="hover:underline hover:text-dark dark:hover:text-white"
          >
            {t("Home")}
          </Link>
          <LuChevronRight size={14} />
          <Link
            href={"/admin"}
            className="font-semibold text-dark dark:text-white hover:underline"
          >
            {t("Quizzes")}
          </Link>
          <LuChevronRight size={14} className="shrink-0" />
          <span
            aria-current="page"
            className="min-w-0 truncate text-xs"
            title={props.quiz.title}
          >
            {props.quiz.title.length > 30
              ? `${props.quiz.title.slice(0, 30)}…`
              : props.quiz.title}
          </span>
        </nav>
        <EditableHeader quiz={props.quiz} />
        <p className="w-fit my-1 inline-flex items-center gap-1.5 rounded-[10px] px-3.5 py-[7px] text-[13px] font-semibold bg-[#c4ee4f] text-[#2c3a08] dark:bg-[#b8e94a] dark:text-[#15200a]">
          {t("Questions:")} <b className="font-extrabold">{questionCount}</b>
        </p>
        {duels && (
          <div className="flex items-center gap-2 mt-3 mb-1">
            <Switch
              aria-label={t("Make quiz public for duels")}
              checked={Boolean(props.quiz.isPublic)}
              disabled={updateQuiz.isPending}
              onCheckedChange={(checked) =>
                updateQuiz.mutate(
                  { quizId: props.quiz.id, isPublic: checked },
                  {
                    onError: (err) => toast.error(getApiErrorMessage(err)),
                  },
                )
              }
            />
            <span className="text-sm max-w-[250px]">
              {t(
                "Public — scored questions are submitted for admin review before appearing in 1v1 duels",
              )}
            </span>
          </div>
        )}
        <LogoSetting quiz={props.quiz} />
        <ModerationSettingsCard quiz={props.quiz} />
      </div>
      <div className="flex flex-col w-[90%] mx-auto text-dark dark:text-white">
        <div className="flex items-center justify-between mt-6 mb-3">
          <h4 className="text-sm font-bold tracking-[0.04em] uppercase text-[#8a8896] dark:text-muted-dark">
            {t("Previously played")}
          </h4>
          <span className="rounded-full px-2.5 py-0.5 text-xs bg-lprimary/10 dark:bg-white/5 text-off-dark dark:text-muted-dark">
            {pastGames.length}
          </span>
        </div>
        {/* Full length — the whole panel scrolls, like the question list.
            Bottom room for the floating "Host quiz" button. */}
        <div className="flex flex-col gap-2.5 pb-28">
          {pastGames.length > 0 ? (
            <>
              {pastGames.map((result) => {
                const leaderboardClass =
                  "flex-1 text-center rounded-[9px] p-[9px] text-[12.5px] font-semibold bg-[#ef7f4d] text-white transition-[filter] hover:brightness-106 cursor-pointer";
                return (
                  <div
                    key={result.id}
                    className="rounded-[14px] p-3.5 border bg-light-bg dark:bg-card-dark border-lprimary/15 dark:border-white/5 transition-[border-color,transform] hover:border-lprimary dark:hover:border-dprimary hover:-translate-y-px"
                  >
                    <div className="flex items-center justify-between gap-2.5">
                      <span className="text-[12.5px] font-medium text-off-dark dark:text-muted-dark">
                        {formatSessionDate(result.endedAt)}
                      </span>
                      <span className="text-[13px] font-extrabold tracking-[0.06em] rounded-[7px] px-2 py-0.5 text-lprimary dark:text-dprimary bg-lprimary/10 dark:bg-white/5">
                        {result.gameCode}
                      </span>
                    </div>
                    <div className="text-xs mt-2 mb-[11px] text-off-dark dark:text-muted-dark">
                      {t(pl(result.playerCount, "{n} player", "{n} players"), {
                        n: result.playerCount,
                      })}{" "}
                      ·{" "}
                      {t(
                        pl(
                          result.questionCount,
                          "{n} question",
                          "{n} questions",
                        ),
                        { n: result.questionCount },
                      )}
                    </div>
                    <div className="flex gap-2">
                      {props.onShowLeaderboard ? (
                        <button
                          type="button"
                          className={leaderboardClass}
                          onClick={() => props.onShowLeaderboard?.(result.id)}
                        >
                          {t("See leaderboard")}
                        </button>
                      ) : (
                        <Link
                          href={`/admin/quiz/leaderboard/${result.id}`}
                          className={leaderboardClass}
                        >
                          {t("See leaderboard")}
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() => setConfirmDeleteAll(true)}
                className="mt-1 self-center inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[13px] font-semibold text-red-light dark:text-red-dark hover:bg-red-light/10 dark:hover:bg-red-dark/10 cursor-pointer"
              >
                <LuTrash2 size={14} />
                {t("Delete all")}
              </button>
              <ConfirmationModal
                open={confirmDeleteAll}
                setOpen={setConfirmDeleteAll}
                desc={t(
                  pl(
                    pastGames.length,
                    "Delete the played game of this quiz and its leaderboard? This can't be undone.",
                    "Delete all {n} played games of this quiz and their leaderboards? This can't be undone.",
                  ),
                  { n: pastGames.length },
                )}
                confirmLabel={t("Delete all")}
                confirming={deleteResults.isPending}
                confirmingLabel={t("Deleting…")}
                onClick={() =>
                  deleteResults.mutate(
                    { quizId: props.quiz.id },
                    {
                      onSuccess: () => {
                        setConfirmDeleteAll(false);
                        toast.success(t("Played games deleted"));
                      },
                      onError: (err) => toast.error(getApiErrorMessage(err)),
                    },
                  )
                }
              />
            </>
          ) : (
            <div className="h-fit border border-lprimary/25 dark:border-white/15 border-dashed rounded-[14px] p-4 text-dark dark:text-white">
              <div className="p-2 text-lg font-black text-center">
                {t("No Previously Used Quizzes")}
              </div>
              <p className="p-2 text-sm text-center">
                {t(
                  "It looks like there are no previously used quizzes for this session. Start adding questions to create an engaging quiz for your students.",
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function QuizInfoSection(props: {
  quiz: QuizDetail;
  onShowLeaderboard?: (resultId: string) => void;
}) {
  return (
    <div className="md:w-2/5 lg:w-1/3 shrink-0 h-full bg-white dark:bg-dark rounded-xl p-4 hidden md:flex flex-col min-h-0 overflow-y-auto">
      <QuizInfoContent
        quiz={props.quiz}
        onShowLeaderboard={props.onShowLeaderboard}
      />
    </div>
  );
}
