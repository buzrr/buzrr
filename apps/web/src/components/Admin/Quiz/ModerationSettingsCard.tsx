"use client";

import { toast } from "react-toastify";
import {
  BUILTIN_SOUND_SKINS,
  quizSettingsSchema,
  type ModerationSettings,
  type QuizSettings,
  type SoundSettings,
} from "@buzrr/contract";
import { useSoundSkinsQuery } from "@/lib/modules/sound-skins/hooks";
import type { AvatarSkin } from "@buzrr/contract";
import { AVATAR_SKIN_NAMES } from "@/components/Admin/AvatarSkins/AvatarSkinsClient";
import { BUILTIN_SKINS, type BuiltinSkinId } from "@/lib/sound/synth";
import Switch from "@/components/ui/Switch";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useUpdateQuizMutation } from "@/lib/modules/quizzes/hooks";
import { useT } from "@/lib/i18n/context";
import type { QuizDetail } from "@/lib/modules/quizzes/api";

type SubKey = Exclude<keyof ModerationSettings, "enabled">;

const SUB_OPTIONS: { key: SubKey; label: string; parent?: SubKey }[] = [
  {
    key: "confirmNextQuestion",
    label: "Get-ready slide before the first question (you start the round)",
  },
  {
    key: "confirmShowAnswer",
    label: "Show the answer on click (first how the room voted)",
  },
  { key: "showScores", label: "Show scores after every question" },
  {
    key: "confirmShowScores",
    label: "Show the scores on click",
    parent: "showScores",
  },
];

/**
 * Moderated mode: the host steps the room through every question — get-ready
 * slide, countdown, question, answer, scores. Stored in `Quiz.settings`.
 */
export default function ModerationSettingsCard({ quiz }: { quiz: QuizDetail }) {
  const t = useT();
  const updateQuiz = useUpdateQuizMutation();
  const parsed = quizSettingsSchema.safeParse(quiz.settings ?? {});
  const settings: QuizSettings = parsed.success
    ? parsed.data
    : quizSettingsSchema.parse({});
  const mod = settings.moderation;

  const skins = useSoundSkinsQuery();
  const saveSound = (patch: Partial<SoundSettings>) =>
    updateQuiz.mutate(
      {
        quizId: quiz.id,
        settings: { ...settings, sound: { ...settings.sound, ...patch } },
      },
      { onError: (err) => toast.error(getApiErrorMessage(err)) },
    );
  // Same width for every sound selector, so they line up.
  const selectClass =
    "w-44 rounded-lg border border-lprimary/20 dark:border-white/10 bg-transparent dark:bg-dark px-2 py-1 text-[13px]";

  const save = (patch: Partial<ModerationSettings>) =>
    updateQuiz.mutate(
      {
        quizId: quiz.id,
        settings: { ...settings, moderation: { ...mod, ...patch } },
      },
      { onError: (err) => toast.error(getApiErrorMessage(err)) },
    );

  return (
    <div className="mt-3 mb-1 flex flex-col gap-2">
      <label className="flex items-center gap-2 text-sm">
        <span className="w-20 shrink-0 text-[13px] font-semibold">
          {t("Avatars")}
        </span>
        <select
          aria-label={t("Avatar skin")}
          value={settings.avatarSkin}
          disabled={updateQuiz.isPending}
          onChange={(e) =>
            updateQuiz.mutate(
              {
                quizId: quiz.id,
                settings: {
                  ...settings,
                  avatarSkin: e.target.value as QuizSettings["avatarSkin"],
                },
              },
              { onError: (err) => toast.error(getApiErrorMessage(err)) },
            )
          }
          className={selectClass}
        >
          <option value="default">{t("Default (your settings)")}</option>
          {(Object.keys(AVATAR_SKIN_NAMES) as AvatarSkin[]).map((k) => (
            <option key={k} value={k}>
              {t(AVATAR_SKIN_NAMES[k])}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-col gap-1.5 text-sm">
        <span className="font-semibold">{t("Sounds")}</span>
        <label className="flex items-center gap-2">
          <span className="w-20 shrink-0 text-[13px]">{t("Play on")}</span>
          <select
            aria-label={t("Where sounds play")}
            value={settings.sound.playOn}
            disabled={updateQuiz.isPending}
            onChange={(e) =>
              saveSound({ playOn: e.target.value as SoundSettings["playOn"] })
            }
            className={selectClass}
          >
            <option value="host">{t("Host's screen")}</option>
            <option value="players">{t("Players' devices")}</option>
            <option value="both">{t("Both")}</option>
            <option value="off">{t("Off")}</option>
          </select>
        </label>
        {settings.sound.playOn !== "off" && (
          <label className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-[13px]">{t("Audio skin")}</span>
            <select
              aria-label={t("Audio skin")}
              value={settings.sound.skin}
              disabled={updateQuiz.isPending}
              onChange={(e) => saveSound({ skin: e.target.value })}
              className={selectClass}
            >
              <option value="default">{t("Default (your settings)")}</option>
              {BUILTIN_SOUND_SKINS.map((id) => (
                <option key={id} value={id}>
                  {t(BUILTIN_SKINS[id as BuiltinSkinId].name)}
                </option>
              ))}
              {(skins.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.isGlobal ? " (shared)" : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        {settings.sound.playOn !== "off" && (
          <label className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-[13px]">{t("Music")}</span>
            <select
              aria-label={t("Music")}
              value={settings.sound.music ? "on" : "off"}
              disabled={updateQuiz.isPending}
              onChange={(e) => saveSound({ music: e.target.value === "on" })}
              className={selectClass}
            >
              <option value="on">{t("Music")}</option>
              <option value="off">{t("No music (effects only)")}</option>
            </select>
          </label>
        )}
        {settings.sound.playOn === "host" && (
          <label className="flex items-center gap-2">
            <Switch
              aria-label={t("Players can turn sound on")}
              checked={settings.sound.playerOptIn}
              disabled={updateQuiz.isPending}
              onCheckedChange={(checked) => saveSound({ playerOptIn: checked })}
            />
            <span className="text-[13px] max-w-[230px]">
              {t("Players can turn sound on for themselves")}
            </span>
          </label>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Switch
          aria-label={t("Live reactions")}
          checked={settings.reactions}
          disabled={updateQuiz.isPending}
          onCheckedChange={(checked) =>
            updateQuiz.mutate(
              {
                quizId: quiz.id,
                settings: { ...settings, reactions: checked },
              },
              { onError: (err) => toast.error(getApiErrorMessage(err)) },
            )
          }
        />
        <span className="text-sm max-w-[250px]">
          {t("Live reactions — players can send 👍 ❤️ 😂 to your screen")}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Switch
          aria-label={t("Moderated mode")}
          checked={mod.enabled}
          disabled={updateQuiz.isPending}
          onCheckedChange={(checked) => save({ enabled: checked })}
        />
        <span className="text-sm max-w-[250px]">
          {t("Moderated mode — you step the room through every question")}
        </span>
      </div>
      {mod.enabled && (
        <div className="ml-3 pl-3 border-l-2 border-lprimary/20 dark:border-white/10 flex flex-col gap-2">
          {SUB_OPTIONS.map((o) => {
            const disabled =
              updateQuiz.isPending || (o.parent ? !mod[o.parent] : false);
            return (
              <label
                key={o.key}
                className={`flex items-center gap-2 ${o.parent ? "ml-4" : ""} ${disabled && o.parent ? "opacity-50" : ""}`}
              >
                <Switch
                  aria-label={t(o.label)}
                  checked={mod[o.key]}
                  disabled={disabled}
                  onCheckedChange={(checked) => save({ [o.key]: checked })}
                />
                <span className="text-[13px] max-w-[230px]">{t(o.label)}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
