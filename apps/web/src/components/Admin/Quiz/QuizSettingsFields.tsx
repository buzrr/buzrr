"use client";

import {
  quizSettingsSchema,
  type ModerationSettings,
  type QuizSettings,
  type SoundSettings,
} from "@buzrr/contract";
import Switch from "@/components/ui/Switch";

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
  { key: "showScores", label: "Show the standings after every question" },
  {
    key: "confirmShowScores",
    label: "On its own page",
    parent: "showScores",
  },
];

/** Stored quiz settings with the defaults filled in (invalid → defaults). */
export function quizSettingsOf(raw: unknown): QuizSettings {
  const parsed = quizSettingsSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : quizSettingsSchema.parse({});
}

/**
 * The quiz settings controls: question sounds, live reactions, moderated mode.
 * Controlled — the quiz editor saves every change, the "Host quiz" dialog
 * keeps them for the game it opens.
 */
export default function QuizSettingsFields({
  settings,
  onChange,
  disabled = false,
}: {
  settings: QuizSettings;
  onChange: (next: QuizSettings) => void;
  disabled?: boolean;
}) {
  const mod = settings.moderation;
  const setSound = (patch: Partial<SoundSettings>) =>
    onChange({ ...settings, sound: { ...settings.sound, ...patch } });
  const setModeration = (patch: Partial<ModerationSettings>) =>
    onChange({ ...settings, moderation: { ...mod, ...patch } });
  const selectClass =
    "w-44 rounded-lg border border-lprimary/20 dark:border-white/10 bg-transparent dark:bg-dark px-2 py-1 text-[13px]";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1.5 text-sm">
        <span className="font-semibold">Question sounds</span>
        <label className="flex items-center gap-2">
          <span className="w-20 shrink-0 text-[13px]">Play on</span>
          <select
            aria-label="Where sounds play"
            value={settings.sound.playOn}
            disabled={disabled}
            onChange={(e) =>
              setSound({ playOn: e.target.value as SoundSettings["playOn"] })
            }
            className={selectClass}
          >
            <option value="host">Host&apos;s screen</option>
            <option value="players">Players&apos; devices</option>
            <option value="both">Both</option>
            <option value="off">Off</option>
          </select>
        </label>
        {settings.sound.playOn === "host" && (
          <label className="flex items-center gap-2">
            <Switch
              aria-label="Players can turn sound on"
              checked={settings.sound.playerOptIn}
              disabled={disabled}
              onCheckedChange={(checked) => setSound({ playerOptIn: checked })}
            />
            <span className="text-[13px] max-w-[230px]">
              Players can turn sound on for themselves
            </span>
          </label>
        )}
      </div>
      <span className="mt-1 text-sm font-semibold">Quiz settings</span>
      <div className="flex items-center gap-2">
        <Switch
          aria-label="Live reactions"
          checked={settings.reactions}
          disabled={disabled}
          onCheckedChange={(checked) =>
            onChange({ ...settings, reactions: checked })
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
          disabled={disabled}
          onCheckedChange={(checked) => setModeration({ enabled: checked })}
        />
        <span className="text-sm max-w-[250px]">
          Moderated mode — you step the room through every question
        </span>
      </div>
      {mod.enabled && (
        <div className="ml-3 pl-3 border-l-2 border-lprimary/20 dark:border-white/10 flex flex-col gap-2">
          {SUB_OPTIONS.map((o) => {
            const off = disabled || (o.parent ? !mod[o.parent] : false);
            return (
              <label
                key={o.key}
                className={`flex items-center gap-2 ${o.parent ? "ml-4" : ""} ${off && o.parent ? "opacity-50" : ""}`}
              >
                <Switch
                  aria-label={o.label}
                  checked={mod[o.key]}
                  disabled={off}
                  onCheckedChange={(checked) =>
                    setModeration({ [o.key]: checked })
                  }
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
