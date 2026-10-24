"use client";

import {
  quizSettingsSchema,
  type ModerationSettings,
  type QuizSettings,
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
 * The quiz settings controls: live reactions, moderated mode.
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
  const setModeration = (patch: Partial<ModerationSettings>) =>
    onChange({ ...settings, moderation: { ...mod, ...patch } });

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold">Quiz settings</span>
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
