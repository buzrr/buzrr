"use client";

import clsx from "clsx";
import Link from "next/link";
import { useState } from "react";
import { toast } from "react-toastify";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getApiErrorMessage } from "@/lib/api/errors";
import { quizzesApi } from "@/lib/modules/quizzes/api";
import { queryKeys } from "@/lib/modules/query-keys";
import { useT, pl } from "@/lib/i18n/context";
import { mutedText, panelClass } from "@/components/Game/GameUI";

/**
 * Admins: every user's quizzes with their owner, and "Move to…" to hand a
 * quiz to someone else (by email). To edit someone else's quiz, move it to
 * yourself.
 */
export default function AllQuizzesAdmin({
  me,
}: {
  me?: { id: string; email: string } | null;
}) {
  const t = useT();
  const myUserId = me?.id;
  const qc = useQueryClient();
  const all = useQuery({
    queryKey: ["quizzes", "all-admin"],
    queryFn: () => quizzesApi.listAll(),
  });
  const move = useMutation({
    mutationFn: (v: { quizId: string; email: string }) =>
      quizzesApi.changeOwner(v.quizId, v.email),
    onSuccess: (res) => {
      toast.success(t("Moved to {email}", { email: res.owner.email }));
      void qc.invalidateQueries({ queryKey: ["quizzes", "all-admin"] });
      void qc.invalidateQueries({ queryKey: queryKeys.quizzes.all });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
  const [movingId, setMovingId] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  if (all.isPending)
    return <p className={mutedText}>{t("Loading all quizzes…")}</p>;
  if (all.isError)
    return <p className="text-red-light">{t("Could not load quizzes.")}</p>;

  return (
    <div
      className={clsx(
        panelClass,
        "p-3 md:p-4 flex flex-col gap-1.5 text-dark dark:text-white",
      )}
    >
      {(all.data ?? []).map((q) => {
        const mine = q.user.id === myUserId;
        return (
          <div
            key={q.id}
            className="flex flex-wrap items-center gap-2.5 rounded-xl px-3 py-2 bg-light-bg dark:bg-card-dark"
          >
            <span className="flex-1 min-w-40">
              {mine ? (
                <Link
                  href={`/admin/quiz/${q.id}`}
                  className="font-semibold hover:underline"
                >
                  {q.title}
                </Link>
              ) : (
                <span className="font-semibold">{q.title}</span>
              )}
              <span className={clsx("block text-xs", mutedText)}>
                {q.user.name ? `${q.user.name} · ` : ""}
                {q.user.email} ·{" "}
                {t(
                  pl(q._count?.questions ?? 0, "{n} question", "{n} questions"),
                  {
                    n: q._count?.questions ?? 0,
                  },
                )}
              </span>
            </span>
            {movingId === q.id ? (
              <form
                className="flex items-center gap-1.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  move.mutate(
                    { quizId: q.id, email },
                    { onSuccess: () => setMovingId(null) },
                  );
                }}
              >
                <input
                  type="email"
                  required
                  autoFocus
                  placeholder={t("new owner's email")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-56 rounded-lg border border-lprimary/20 dark:border-white/10 bg-transparent px-2 py-1 text-sm placeholder:text-[#8a8896] dark:placeholder:text-muted-dark"
                />
                <button
                  type="submit"
                  disabled={move.isPending}
                  className="rounded-lg px-2.5 py-1 text-sm font-bold bg-lprimary dark:bg-dprimary text-white dark:text-dark cursor-pointer"
                >
                  {t("Move")}
                </button>
                <button
                  type="button"
                  onClick={() => setMovingId(null)}
                  className="text-sm underline cursor-pointer"
                >
                  {t("cancel")}
                </button>
              </form>
            ) : (
              <span className="flex gap-1.5">
                {!mine && me?.email && (
                  <button
                    type="button"
                    disabled={move.isPending}
                    onClick={() =>
                      move.mutate({ quizId: q.id, email: me.email })
                    }
                    className="rounded-lg px-2.5 py-1 text-sm font-bold bg-lprimary/10 dark:bg-white/5 cursor-pointer"
                  >
                    {t("Move to me")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setMovingId(q.id);
                    setEmail("");
                  }}
                  className="rounded-lg px-2.5 py-1 text-sm font-bold bg-lprimary/10 dark:bg-white/5 cursor-pointer"
                >
                  {t("Move to…")}
                </button>
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
