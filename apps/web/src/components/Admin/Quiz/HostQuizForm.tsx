"use client";

import React from "react";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { LuPlay } from "react-icons/lu";
import type { QuizSettings } from "@buzrr/contract";
import BasicModal from "@/components/Modal";
import QuizSettingsFields, {
  quizSettingsOf,
} from "@/components/Admin/Quiz/QuizSettingsFields";
import { primaryButtonClass } from "@/components/Game/GameUI";
import { useAppDispatch } from "@/state/hooks";
import { setPlayers } from "@/state/admin/playersSlice";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useT } from "@/lib/i18n/context";
import { useCreateGameSessionMutation } from "@/lib/modules/game-sessions/hooks";

/**
 * "Host quiz": a dialog with the quiz's settings to change for this game
 * (stored on the room, optionally as the quiz's new default); "Start" opens
 * the room.
 */
export default function HostQuizForm(props: {
  quizId: string;
  /** The quiz's stored settings (`Quiz.settings`), the dialog's start. */
  settings: unknown;
  disabled?: boolean;
  className?: string;
}) {
  const t = useT();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const mutation = useCreateGameSessionMutation();
  const [open, setOpen] = React.useState(false);
  const [settings, setSettings] = React.useState<QuizSettings>(() =>
    quizSettingsOf(props.settings),
  );
  const [saveAsDefault, setSaveAsDefault] = React.useState(false);

  // Every opening starts from the quiz's settings as they are now.
  const openDialog = () => {
    setSettings(quizSettingsOf(props.settings));
    setSaveAsDefault(false);
    setOpen(true);
  };
  const close = () => {
    if (!mutation.isPending) setOpen(false);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(
      { quizId: props.quizId, settings, saveAsDefault },
      {
        onSuccess: (res) => {
          dispatch(setPlayers([]));
          router.push(`/admin/play/${res.id}`);
        },
        onError: (err) => {
          toast.error(getApiErrorMessage(err));
        },
      },
    );
  };

  return (
    <div className={props.className}>
      <button
        type="button"
        onClick={openDialog}
        disabled={props.disabled}
        className="w-full flex items-center justify-center gap-2.5 rounded-[15px] p-4 text-[17px] font-bold text-white bg-linear-to-br from-[#9a6cf5] to-[#7c4ddb] dark:from-accent dark:to-accent-deep shadow-[0_10px_26px_-10px_#8b5cf6] transition-[filter,transform] hover:brightness-107 active:translate-y-px cursor-pointer disabled:cursor-default disabled:bg-none disabled:bg-gray disabled:shadow-none disabled:hover:brightness-100"
      >
        <LuPlay size={18} className="fill-current" />
        {t("Host quiz")}
      </button>
      <BasicModal
        btnTitle={t("Host quiz")}
        subtitle={t("Settings for this game. Change them before you start.")}
        icon={<LuPlay size={22} className="fill-current" />}
        open={open}
        onClose={close}
      >
        <form onSubmit={onSubmit}>
          <div className="px-5 pt-4 md:px-7">
            <QuizSettingsFields
              settings={settings}
              onChange={setSettings}
              disabled={mutation.isPending}
            />
          </div>
          <div className="mt-5 flex flex-col md:flex-row items-stretch md:items-center gap-3.5 border-t border-lprimary/15 dark:border-white/10 px-5 pt-[18px] pb-6 md:px-7 md:py-4">
            <label className="flex flex-1 items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={saveAsDefault}
                disabled={mutation.isPending}
                onChange={(e) => setSaveAsDefault(e.target.checked)}
                className="size-4 accent-lprimary dark:accent-dprimary"
              />
              {t("Save as this quiz's default")}
            </label>
            <button
              type="button"
              onClick={close}
              disabled={mutation.isPending}
              className="rounded-[14px] border-2 border-lprimary dark:border-dprimary px-[22px] py-3 font-bold text-lprimary dark:text-dprimary cursor-pointer hover:bg-lprimary/10 dark:hover:bg-dprimary/10 disabled:opacity-60"
            >
              {t("Cancel")}
            </button>
            <button
              type="submit"
              autoFocus
              disabled={mutation.isPending}
              className={clsx(primaryButtonClass, "px-[26px]")}
            >
              <LuPlay size={16} className="fill-current" />
              {mutation.isPending ? t("Starting…") : t("Start")}
            </button>
          </div>
        </form>
      </BasicModal>
    </div>
  );
}
