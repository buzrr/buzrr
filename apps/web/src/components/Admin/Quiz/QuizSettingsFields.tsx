"use client";

import {
  BUILTIN_SOUND_SKINS,
  quizSettingsSchema,
  type AvatarSkin,
  type ModerationSettings,
  type QuizSettings,
  type SoundSettings,
} from "@buzrr/contract";
import { useSoundSkinsQuery } from "@/lib/modules/sound-skins/hooks";
import { AVATAR_SKIN_NAMES } from "@/components/Admin/AvatarSkins/AvatarSkinsClient";
import { BUILTIN_SKINS, type BuiltinSkinId } from "@/lib/sound/synth";
import Switch from "@/components/ui/Switch";
import { useT } from "@/lib/i18n/context";

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
 * The quiz settings controls: avatars, sounds, live reactions, moderated
 * mode. Controlled — the quiz editor saves every change, the "Host quiz"
 * dialog keeps them for the game it opens.
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
  const t = useT();
  const mod = settings.moderation;
  const skins = useSoundSkinsQuery();
  const setSound = (patch: Partial<SoundSettings>) =>
    onChange({ ...settings, sound: { ...settings.sound, ...patch } });
  const setModeration = (patch: Partial<ModerationSettings>) =>
    onChange({ ...settings, moderation: { ...mod, ...patch } });
  // Same width for every sound selector, so they line up.
  const selectClass =
    "w-44 rounded-lg border border-lprimary/20 dark:border-white/10 bg-transparent dark:bg-dark px-2 py-1 text-[13px]";

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 text-sm">
        <span className="w-20 shrink-0 text-[13px] font-semibold">
          {t("Avatars")}
        </span>
        <select
          aria-label={t("Avatar skin")}
          value={settings.avatarSkin}
          disabled={disabled}
          onChange={(e) =>
            onChange({
              ...settings,
              avatarSkin: e.target.value as QuizSettings["avatarSkin"],
            })
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
            disabled={disabled}
            onChange={(e) =>
              setSound({ playOn: e.target.value as SoundSettings["playOn"] })
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
              disabled={disabled}
              onChange={(e) => setSound({ skin: e.target.value })}
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
              disabled={disabled}
              onChange={(e) => setSound({ music: e.target.value === "on" })}
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
              disabled={disabled}
              onCheckedChange={(checked) => setSound({ playerOptIn: checked })}
            />
            <span className="text-[13px] max-w-[230px]">
              {t("Players can turn sound on for themselves")}
            </span>
          </label>
        )}
      </div>
      <span className="mt-1 text-sm font-semibold">{t("Quiz settings")}</span>
      <div className="flex items-center gap-2">
        <Switch
          aria-label={t("Live reactions")}
          checked={settings.reactions}
          disabled={disabled}
          onCheckedChange={(checked) =>
            onChange({ ...settings, reactions: checked })
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
          disabled={disabled}
          onCheckedChange={(checked) => setModeration({ enabled: checked })}
        />
        <span className="text-sm max-w-[250px]">
          {t("Moderated mode — you step the room through every question")}
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
                  aria-label={t(o.label)}
                  checked={mod[o.key]}
                  disabled={off}
                  onCheckedChange={(checked) =>
                    setModeration({ [o.key]: checked })
                  }
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
