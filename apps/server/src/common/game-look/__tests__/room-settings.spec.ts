import { quizSettingsSchema } from "@buzrr/contract";
import { describe, expect, it } from "vitest";
import { roomSettings } from "../game-look";

const defaults = quizSettingsSchema.parse({});

describe("roomSettings", () => {
  it("prefers the game's own settings over the quiz's", () => {
    const s = roomSettings({
      settings: { reactions: false, moderation: { enabled: true } },
      quiz: {
        settings: { reactions: true, moderation: { showScores: false } },
      },
    });
    expect(s.reactions).toBe(false);
    expect(s.moderation.enabled).toBe(true);
    // Not merged with the quiz's: missing keys are the defaults.
    expect(s.moderation.showScores).toBe(defaults.moderation.showScores);
  });

  it("falls back to the quiz's settings when the game has none", () => {
    const s = roomSettings({
      settings: null,
      quiz: { settings: { reactions: false } },
    });
    expect(s.reactions).toBe(false);
  });

  it("reads invalid settings as the defaults", () => {
    expect(
      roomSettings({ settings: { reactions: "yes" }, quiz: { settings: {} } }),
    ).toEqual(defaults);
    expect(
      roomSettings({ settings: null, quiz: { settings: "garbage" } }),
    ).toEqual(defaults);
    expect(roomSettings({ settings: null, quiz: { settings: null } })).toEqual(
      defaults,
    );
  });
});
