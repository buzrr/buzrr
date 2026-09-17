import { median } from "../../common/utils/answer-timing";
import type { TypedSocket } from "./realtime.types";

const PROBE_INTERVAL_MS = 3_000;
/** A probe unanswered this long is dropped rather than recorded. */
const PROBE_TIMEOUT_MS = 5_000;
/** Rolling window of samples the median is taken over. */
const WINDOW_SIZE = 5;

export interface SocketLatency {
  /** Rolling median round trip in ms; 0 until the first probe returns. */
  rttMs(): number;
}

/**
 * Measures one socket's round trip by periodically emitting `latency-probe`
 * and timing the client's ack. Samples stay in this process — the answer
 * that uses them arrives on the same socket, so no other instance needs them.
 * A median keeps a single stalled probe (GC pause, tab throttling) from
 * skewing the estimate.
 */
export function monitorLatency(socket: TypedSocket): SocketLatency {
  const samples: number[] = [];

  const probe = () => {
    const sentAt = Date.now();
    socket.timeout(PROBE_TIMEOUT_MS).emit("latency-probe", (err: Error) => {
      if (err) return;
      samples.push(Date.now() - sentAt);
      if (samples.length > WINDOW_SIZE) samples.shift();
    });
  };

  probe();
  const interval = setInterval(probe, PROBE_INTERVAL_MS);
  interval.unref();
  socket.once("disconnect", () => clearInterval(interval));

  return { rttMs: () => median(samples) };
}
