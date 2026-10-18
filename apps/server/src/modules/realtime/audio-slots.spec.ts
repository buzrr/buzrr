import { describe, expect, it } from "vitest";
import { AudioSlots, SLOT_STALL_MS } from "./audio-slots";

describe("AudioSlots", () => {
  it("grants everyone at once when unlimited", () => {
    const s = new AudioSlots(0);
    for (let i = 0; i < 100; i++) {
      expect(s.request("ROOM", "question", 0, `p${i}`, `s${i}`, 0)).toBe(true);
    }
  });

  it("queues past the limit and hands slots on as downloads finish", () => {
    const s = new AudioSlots(2);
    expect(s.request("ROOM", "question", 0, "a", "sa", 0)).toBe(true);
    expect(s.request("ROOM", "question", 0, "b", "sb", 0)).toBe(true);
    expect(s.request("ROOM", "question", 0, "c", "sc", 0)).toBe(false);
    expect(s.request("ROOM", "question", 0, "d", "sd", 0)).toBe(false);
    expect(s.release("ROOM", "question", 0, "a", 1)).toEqual([
      { socketId: "sc", qIndex: 0, kind: "question" },
    ]);
    expect(s.leave("ROOM", "b", "sb", 2)).toEqual([
      { socketId: "sd", qIndex: 0, kind: "question" },
    ]);
    // A done report for another question frees nothing.
    expect(s.release("ROOM", "question", 1, "c", 3)).toEqual([]);
  });

  it("never queues the host", () => {
    const s = new AudioSlots(1);
    s.request("ROOM", "question", 0, "a", "sa", 0);
    expect(s.request("ROOM", "question", 0, "host", "sh", 0)).toBe(true);
  });

  it("gives a stalled slot to the next device, progress keeps it", () => {
    const s = new AudioSlots(1);
    s.request("ROOM", "question", 0, "a", "sa", 0);
    s.request("ROOM", "question", 0, "b", "sb", 0);
    s.touch("ROOM", "question", 0, "a", SLOT_STALL_MS - 1);
    expect(s.sweep(SLOT_STALL_MS + 10)).toEqual([]);
    expect(s.sweep(2 * SLOT_STALL_MS)).toEqual([
      { socketId: "sb", qIndex: 0, kind: "question" },
    ]);
  });

  it("keeps the skin's slots apart from the question's", () => {
    const s = new AudioSlots(1);
    s.request("ROOM", "question", 0, "a", "sa", 0);
    expect(s.request("ROOM", "skin", 0, "b", "sb", 0)).toBe(true);
    expect(s.request("ROOM", "skin", 0, "c", "sc", 0)).toBe(false);
    expect(s.leave("ROOM", "b", "sb", 1)).toEqual([
      { socketId: "sc", qIndex: 0, kind: "skin" },
    ]);
  });

  it("starts a fresh round for the next question", () => {
    const s = new AudioSlots(1);
    s.request("ROOM", "question", 0, "a", "sa", 0);
    expect(s.request("ROOM", "question", 1, "b", "sb", 0)).toBe(true);
  });
});
