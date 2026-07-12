"use client";
import { useAppSelector } from "@/state/hooks";

/**
 * Connection feedback: a slim banner while socket.io retries automatically,
 * and a blocking overlay with a manual retry once it has given up. Game state
 * resyncs automatically (server pushes `state-sync`) when the connection is
 * back.
 */
export default function ConnectionBanner() {
  const connection = useAppSelector((state) => state.game.connection);

  if (connection === "connected" || connection === "connecting") return null;

  if (connection === "reconnecting") {
    return (
      <div
        role="status"
        className="fixed top-0 left-0 right-0 z-50 py-2 px-4 text-center text-sm font-bold text-white bg-red-light dark:bg-red-dark"
      >
        <span className="inline-block h-3 w-3 mr-2 rounded-full border-2 border-white border-t-transparent animate-spin align-middle" />
        Connection lost — reconnecting…
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/70 px-6 text-center"
    >
      <p className="text-xl font-black text-white">Disconnected</p>
      <p className="text-sm text-white/80 max-w-xs">
        We couldn&apos;t reach the game server. Check your internet connection.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="px-6 py-3 rounded-xl font-bold bg-lprimary dark:bg-dprimary text-white dark:text-dark"
      >
        Tap to retry
      </button>
    </div>
  );
}
