import { describe, expect, it, vi } from "vitest";
import { resyncOnReturn } from "../useGameSocket";

const socket = (connected: boolean) => ({ connected, emit: vi.fn() });

describe("resyncOnReturn", () => {
  it("asks for a snapshot when the page comes back with the socket up", () => {
    const conn = socket(true);
    resyncOnReturn(conn, "visible");
    expect(conn.emit).toHaveBeenCalledExactlyOnceWith("request-sync");
  });

  it("does nothing when the page is hidden", () => {
    const conn = socket(true);
    resyncOnReturn(conn, "hidden");
    expect(conn.emit).not.toHaveBeenCalled();
  });

  it("leaves a disconnected socket to the manager", () => {
    const conn = socket(false);
    resyncOnReturn(conn, "visible");
    expect(conn.emit).not.toHaveBeenCalled();
  });
});
