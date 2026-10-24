import { describe, expect, it } from "vitest";
import {
  ASSETS_QUIET_MS,
  FORCE_START_AFTER_MS,
  LobbyReadiness,
} from "./lobby-readiness";

describe("LobbyReadiness", () => {
  it("counts ready and downloading players", () => {
    const r = new LobbyReadiness();
    r.joined("ROOM", "a", 0);
    r.joined("ROOM", "b", 0);
    r.report("ROOM", "a", true, 100);
    expect(r.status("ROOM", ["a", "b"], 200)).toMatchObject({
      ready: 1,
      total: 2,
      pending: 1,
    });
  });

  it("starts at once when everyone is ready", () => {
    const r = new LobbyReadiness();
    r.joined("ROOM", "a", 0);
    r.report("ROOM", "a", true, 10);
    expect(r.mayStart("ROOM", ["a"], 20)).toBe(true);
    expect(r.status("ROOM", ["a"], 20).forceAt).toBe(0);
  });

  it("waits for downloads, then lets the host start anyway", () => {
    const r = new LobbyReadiness();
    r.joined("ROOM", "a", 1000);
    r.report("ROOM", "a", false, 2000);
    expect(r.mayStart("ROOM", ["a"], 3000)).toBe(false);
    expect(r.status("ROOM", ["a"], 3000).forceAt).toBe(
      1000 + FORCE_START_AFTER_MS,
    );
    // Still downloading at the deadline: "start anyway" is allowed.
    r.report("ROOM", "a", false, 1000 + FORCE_START_AFTER_MS);
    expect(r.mayStart("ROOM", ["a"], 1000 + FORCE_START_AFTER_MS)).toBe(true);
  });

  it("doesn't wait for quiet devices or ones that left", () => {
    const r = new LobbyReadiness();
    r.joined("ROOM", "a", 0);
    expect(r.mayStart("ROOM", ["a"], ASSETS_QUIET_MS + 1)).toBe(true);
    r.joined("ROOM", "b", 0);
    r.left("ROOM", "b");
    expect(r.status("ROOM", [], 10).pending).toBe(0);
  });
});
