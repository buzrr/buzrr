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
import { BUILTIN_SKINS, type BuiltinSkinId } from "@/lib/sound/synth";
import Switch from "@/components/ui/Switch";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useUpdateQuizMutation } from "@/lib/modules/quizzes/hooks";
import type { QuizDetail } from "@/lib/modules/quizzes/api";

type SubKey = Exclude<keyof ModerationSettings, "enabled">;

const SUB_OPTIONS: { key: SubKey; label: string; parent?: SubKey }[] = [
  {
    key: "confirmNextQuestion",
    label: "Get-ready slide before each question (host starts it)",
  },
  { key: "showAnswer", label: "Show answer" },
  {
    key: "confirmShowAnswer",
    label: "Confirm show answer",
    parent: "showAnswer",
  },
  { key: "showScores", label: "Show scores after every question" },
  {
    key: "confirmShowScores",
    label: "Confirm show scores",
    parent: "showScores",
  },
];

/**
 * Moderated mode: the host steps the room through every question — get-ready
 * slide, countdown, question, answer, scores. Stored in `Quiz.settings`.
 */
export default function ModerationSettingsCard({ quiz }: { quiz: QuizDetail }) {
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
      <div className="flex flex-col gap-1.5 text-sm">
        <span className="font-semibold">Sounds</span>
        <label className="flex items-center gap-2">
          <span className="w-20 shrink-0 text-[13px]">Play on</span>
          <select
            aria-label="Where sounds play"
            value={settings.sound.playOn}
            disabled={updateQuiz.isPending}
            onChange={(e) =>
              saveSound({ playOn: e.target.value as SoundSettings["playOn"] })
            }
            className={selectClass}
          >
            <option value="host">Your screen</option>
            <option value="players">Players&apos; devices</option>
            <option value="both">Both</option>
            <option value="off">Off</option>
          </select>
        </label>
        {settings.sound.playOn !== "off" && (
          <label className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-[13px]">Audio skin</span>
            <select
              aria-label="Audio skin"
              value={settings.sound.skin}
              disabled={updateQuiz.isPending}
              onChange={(e) => saveSound({ skin: e.target.value })}
              className={selectClass}
            >
              {BUILTIN_SOUND_SKINS.map((id) => (
                <option key={id} value={id}>
                  {BUILTIN_SKINS[id as BuiltinSkinId].name}
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
        {settings.sound.playOn === "host" && (
          <label className="flex items-center gap-2">
            <Switch
              aria-label="Players can turn sound on"
              checked={settings.sound.playerOptIn}
              disabled={updateQuiz.isPending}
              onCheckedChange={(checked) => saveSound({ playerOptIn: checked })}
            />
            <span className="text-[13px] max-w-[230px]">
              Players can turn sound on for themselves
            </span>
          </label>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Switch
          aria-label="Live reactions"
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
          Live reactions — players can send 👍 ❤️ 😂 to your screen
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Switch
          aria-label="Moderated mode"
          checked={mod.enabled}
          disabled={updateQuiz.isPending}
          onCheckedChange={(checked) => save({ enabled: checked })}
        />
        <span className="text-sm max-w-[250px]">
          Moderated mode — you step the room through every question
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
                  aria-label={o.label}
                  checked={mod[o.key]}
                  disabled={disabled}
                  onCheckedChange={(checked) => save({ [o.key]: checked })}
                />
                <span className="text-[13px] max-w-[230px]">{o.label}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
