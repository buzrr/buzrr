"use client";
import clsx from "clsx";
import { DEFAULT_AVATAR } from "@/constants";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useAppDispatch, useAppSelector } from "@/state/hooks";
import { removePlayer, setPlayers } from "@/state/admin/playersSlice";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { AnimatedNumber } from "@/components/Game/motion";
import { ReactionOverlay, useFlyers } from "@/components/Game/Flyers";
import { GameSounds, LiveSounds } from "@/lib/sound/director";
import HostHeader from "@/components/Admin/Game/HostHeader";
import {
  LuBan,
  LuCheck,
  LuCopy,
  LuPlay,
  LuSearch,
  LuShare2,
  LuX,
} from "react-icons/lu";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ConnectionStatusPill from "@/components/ConnectionStatusPill";
import { useAdminSocket } from "@/hooks/useAdminSocket";
import {
  useBanRoomPlayerMutation,
  useRemoveRoomPlayerMutation,
} from "@/lib/modules/game-sessions/hooks";
import type { LobbyReadyPayload, PlayerPayload } from "@buzrr/contract";
import ConfirmationModal from "@/components/Admin/ConfirmationModal";
import { buildJoinUrl } from "@/lib/join-link";
import EndQuizButton from "@/components/Admin/EndQuizButton";
import { useT, pl, tx } from "@/lib/i18n/context";
import { useInstance } from "@/lib/instance-context";

const Lobby = (params: {
  roomId: string;
  userId: string;
  gameCode: string;
  players: PlayerPayload[];
  gameStarted: boolean;
  quizTitle: string;
  quizLogo?: string | null;
  quizId: string;
  maxPlayers?: number;
  plan?: "free" | "pro";
  /** `Quiz.settings` — sounds. */
  quizSettings?: unknown;
}) => {
  const t = useT();
  const dispatch = useAppDispatch();
  const { billing } = useInstance();
  const players = useAppSelector((state) => state.player.players);
  const maxPlayers = params.maxPlayers ?? 50;
  const [load, setLoad] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (params?.gameStarted) {
      router.push(`/admin/game/${params.roomId}`);
    }

    dispatch(setPlayers(params.players));
  }, [dispatch, params.players, params.gameStarted, params.roomId, router]);

  const handleGameStarted = useCallback(() => {
    setLoad(false);
    router.push(`/admin/game/${params.roomId}`);
  }, [params.roomId, router]);

  const { socket } = useAdminSocket({
    gameCode: params.gameCode,
    onPlayerRemoved: (player) => {
      // A device that went quiet just drops off the list — no toast.
      if (player.timedOut) return;
      toast.error(
        player.banned
          ? tx("You have banned {name}", {
              name: player.name ?? tx("the player"),
            })
          : tx("You have removed {name}", {
              name: player.name ?? tx("the player"),
            }),
      );
    },
    onGameStarted: handleGameStarted,
  });

  // Downloads ahead: how many have everything; start waits for them (or for
  // the server's "start anyway" time).
  const [readiness, setReadiness] = useState<LobbyReadyPayload | null>(null);
  useEffect(() => {
    if (!socket) return;
    const onReady = (p: LobbyReadyPayload) => setReadiness(p);
    socket.on("lobby-ready", onReady);
    return () => {
      socket.off("lobby-ready", onReady);
    };
  }, [socket]);

  // Live bubble mini-game totals per waiting player (relayed by the server).
  const [bubbles, setBubbles] = useState<
    Record<string, { hits: number; misses: number }>
  >({});
  // Last reaction per player (shown on their card for a few seconds).
  // `bumpAt`: when the reaction last moved them up — at most once per
  // BUMP_EVERY_MS each, so nobody can tap their way to the top constantly.
  const [lastReaction, setLastReaction] = useState<
    Record<string, { emoji: string; at: number; bumpAt: number }>
  >({});
  // Busy rooms send many of these: they are collected and applied together
  // (one render per FLUSH_MS, not one per event).
  useEffect(() => {
    if (!socket) return;
    let pending: { playerId: string; emoji: string; at: number }[] = [];
    const onReaction = (r: { playerId: string; emoji: string }) => {
      pending.push({ ...r, at: Date.now() });
    };
    const flush = setInterval(() => {
      if (pending.length === 0) return;
      const batch = pending;
      pending = [];
      setLastReaction((prev) => {
        const next = { ...prev };
        for (const r of batch) {
          const before = next[r.playerId]?.bumpAt ?? 0;
          next[r.playerId] = {
            emoji: r.emoji,
            at: r.at,
            bumpAt: r.at - before >= BUMP_EVERY_MS ? r.at : before,
          };
        }
        return next;
      });
    }, FLUSH_MS);
    socket.on("reaction", onReaction);
    return () => {
      clearInterval(flush);
      socket.off("reaction", onReaction);
    };
  }, [socket]);

  // Every newly popped bubble rises out of that player's card, so the host
  // sees the lobby is live.
  const { spawn: spawnBubble, layer: bubbleLayer } = useFlyers();
  const lastHits = useRef<Record<string, number>>({});
  // Big rooms show less: no bubbles rising out of each card, no reorder
  // animation, plain numbers.
  const playerCount = useRef(0);
  useEffect(() => {
    playerCount.current = players.length;
  });
  useEffect(() => {
    if (!socket) return;
    // The server sends the changed totals once a second as one batch.
    const onBatch = ({
      players: batch,
    }: {
      players: Record<string, { hits: number; misses: number }>;
    }) => {
      const flyers = playerCount.current <= FLYER_PLAYER_LIMIT;
      for (const [playerId, st] of Object.entries(batch)) {
        const before = lastHits.current[playerId] ?? st.hits;
        lastHits.current[playerId] = st.hits;
        if (!flyers) continue;
        const card = document.querySelector<HTMLElement>(
          `[data-player-card="${CSS.escape(playerId)}"]`,
        );
        const fresh = Math.min(10, Math.max(0, st.hits - before));
        if (!card || fresh === 0) continue;
        const r = card.getBoundingClientRect();
        for (let i = 0; i < fresh; i++) {
          setTimeout(
            () =>
              spawnBubble({
                emoji: "🫧",
                x: r.left + 24 + Math.random() * Math.max(0, r.width - 48),
                y: r.top,
                dx: (Math.random() - 0.5) * 80,
                rise: 160 + Math.random() * 140,
                size: 20 + Math.random() * 12,
                duration: 1800 + Math.random() * 900,
              }),
            (i * 900) / fresh,
          );
        }
      }
      setBubbles((prev) => ({ ...prev, ...batch }));
    };
    socket.on("bubble-stats-batch", onBatch);
    return () => {
      socket.off("bubble-stats-batch", onBatch);
    };
  }, [socket, spawnBubble]);

  const removePlayerMutation = useRemoveRoomPlayerMutation();
  const banPlayerMutation = useBanRoomPlayerMutation();
  const [playerToBan, setPlayerToBan] = useState<PlayerPayload | null>(null);

  // Kick, ban and stop-hosting go over HTTP so they work even while the socket
  // is down; the server broadcasts the resulting events to everyone connected.
  function handlePlayerRemove(player: PlayerPayload) {
    removePlayerMutation.mutate(
      { roomId: params.roomId, playerId: player.id },
      {
        onSuccess: () => {
          // Connected clients get the player-removed broadcast; update
          // locally in case ours is down (the reducer is idempotent).
          dispatch(removePlayer({ id: player.id }));
          if (!socket?.connected) {
            toast.error(
              t("You have removed {name}", {
                name: player.name ?? t("the player"),
              }),
            );
          }
        },
        onError: () => {
          toast.error(t("Could not remove player. Please try again."));
        },
      },
    );
  }

  function handlePlayerBan() {
    const player = playerToBan;
    if (!player) return;
    banPlayerMutation.mutate(
      { roomId: params.roomId, playerId: player.id },
      {
        onSuccess: () => {
          dispatch(removePlayer({ id: player.id }));
          setPlayerToBan(null);
          if (!socket?.connected) {
            toast.error(
              t("You have banned {name}", {
                name: player.name ?? t("the player"),
              }),
            );
          }
        },
        onError: () => {
          toast.error(t("Could not ban player. Please try again."));
        },
      },
    );
  }

  // Stable for the memoised cards; always calls the latest handler.
  const removeRef = useRef(handlePlayerRemove);
  useEffect(() => {
    removeRef.current = handlePlayerRemove;
  });
  const onKick = useCallback(
    (player: PlayerPayload) => removeRef.current(player),
    [],
  );

  function handleGameStart() {
    if (!socket?.connected) {
      toast.error(t("Not connected to the game server yet. Please wait."));
      return;
    }
    setLoad(true);
    socket.emit("start-game", params.gameCode);
    // Move to the game screen right away instead of waiting for the
    // `game-started` round-trip — it syncs the countdown over the socket on
    // connect, so the host isn't stranded on the lobby while the server spins
    // up the game. `onGameStarted` remains a backup navigation.
    router.push(`/admin/game/${params.roomId}`);
  }

  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [canShare, setCanShare] = useState(false);
  const joinUrl = buildJoinUrl(params.gameCode);
  const isFull = players.length >= maxPlayers;
  const fillPct = Math.min(100, (players.length / maxPlayers) * 100);
  // Waiting list order: whoever just reacted floats to the top (and shows
  // the reaction for a few seconds), everyone else by bubble score.
  const now = useNow(Object.keys(lastReaction).length > 0);
  const fresh = (id: string) => {
    const r = lastReaction[id];
    return r && now - r.at < REACTION_SHOW_MS ? r : null;
  };
  const sortedPlayers = players
    .filter((p) =>
      (p.name ?? "").toLowerCase().includes(query.trim().toLowerCase()),
    )
    .map((p, i) => ({ p, i }))
    .sort((a, b) => {
      const bumped = (id: string) => {
        const at = lastReaction[id]?.bumpAt ?? 0;
        return now - at < REACTION_SHOW_MS ? at : 0;
      };
      const ra = bumped(a.p.id);
      const rb = bumped(b.p.id);
      if (ra !== rb) return rb - ra;
      const sa = bubbleScore(bubbles[a.p.id]);
      const sb = bubbleScore(bubbles[b.p.id]);
      return sb - sa || a.i - b.i;
    })
    .map(({ p }) => p);
  // With many players tapping away the order would never settle: it is
  // re-sorted every REORDER_EVERY_MS; in between, joins go to the end and
  // leaves drop out in place.
  const wanted = sortedPlayers.map((p) => p.id);
  const latest = useRef<string[]>([]);
  useEffect(() => {
    latest.current = wanted;
  });
  const [orderIds, setOrderIds] = useState<string[]>([]);
  useEffect(() => {
    const tm = setInterval(() => setOrderIds(latest.current), REORDER_EVERY_MS);
    return () => clearInterval(tm);
  }, []);
  const wantedSet = new Set(wanted);
  const keep = orderIds.filter((id) => wantedSet.has(id));
  const keepSet = new Set(keep);
  const ids = [...keep, ...wanted.filter((id) => !keepSet.has(id))];
  const byId = new Map(sortedPlayers.map((p) => [p.id, p]));
  const visiblePlayers = ids.map((id) => byId.get(id)!);
  const listRef = useRef<HTMLDivElement>(null);
  const crowded = players.length > CROWD_LIMIT;
  useFlip2d(listRef, crowded ? "" : visiblePlayers.map((p) => p.id).join());

  useEffect(() => {
    setCanShare(typeof navigator.share === "function");
  }, []);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  function copy(what: "code" | "link", text: string) {
    (
      navigator.clipboard?.writeText(text) ??
      Promise.reject(new Error(t("Clipboard unavailable")))
    )
      .then(() => setCopied(what))
      .catch(() => toast.error(t("Failed to copy")));
  }

  // Starting with nobody in the room is fine (a rehearsal, a presentation).
  // `socket.connected` doesn't re-render when it flips; the slice's
  // connection status does (with nobody joining, nothing else would).
  const connection = useAppSelector((state) => state.game.connection);
  const pendingDownloads = readiness?.pending ?? 0;
  const clock = useNow(pendingDownloads > 0);
  const forceAt = readiness?.forceAt ?? 0;
  const canForce = pendingDownloads > 0 && forceAt > 0 && clock >= forceAt;
  const waitingForDownloads = pendingDownloads > 0 && !canForce;
  const forceIn = Math.max(0, Math.ceil((forceAt - clock) / 1000));
  const readyPct = Math.min(
    100,
    ((readiness?.ready ?? 0) / Math.max(1, maxPlayers)) * 100,
  );
  const startDisabled =
    load || !socket || connection !== "connected" || waitingForDownloads;

  return (
    <GameSounds role="host" quizSettings={params.quizSettings}>
      <LiveSounds socket={socket} />
      <div className="w-full max-w-7xl mx-auto flex flex-col px-4 sm:px-6 lg:px-8 -mb-12 pb-4 md:pb-0 md:h-[100dvh] text-dark dark:text-white">
        <HostHeader
          title={params.quizTitle}
          logo={params.quizLogo}
          roomId={params.roomId}
          endRedirect={`/admin/quiz/${params.quizId}`}
        />

        <div className="flex-1 min-h-0 flex flex-col md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3.5 md:gap-5 pb-0 md:pb-[18px]">
          <section className="rounded-3xl border bg-white dark:bg-dark border-lprimary/15 dark:border-white/5 flex flex-col gap-4 md:gap-3.5 [@media(min-height:900px)]:md:gap-5 p-[18px] md:p-[22px] [@media(min-height:900px)]:md:p-[26px] md:min-h-0 md:overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <span className="text-xs font-semibold tracking-[0.12em] uppercase text-[#8a8896] dark:text-muted-dark">
              {t("Room code")}
            </span>
            <button
              type="button"
              onClick={() => copy("code", params.gameCode)}
              className="group w-full flex flex-col items-center gap-1.5 rounded-[18px] border-[1.5px] border-dashed hover:border-solid border-dprimary bg-[#f4efff] dark:bg-[#8b5cf6]/12 px-3 pt-5 pb-4 md:pt-4 md:pb-3 [@media(min-height:900px)]:md:pt-5 [@media(min-height:900px)]:md:pb-4 cursor-pointer transition-transform active:scale-[0.99]"
            >
              <b className="text-[38px] md:text-[40px] [@media(min-height:900px)]:md:text-[46px] font-extrabold tracking-[0.14em] pl-[0.14em] leading-[1.1] tabular-nums text-lprimary dark:text-dprimary">
                {params?.gameCode}
              </b>
              <small
                className={clsx(
                  "flex items-center gap-1.5 text-[13px]",
                  copied === "code"
                    ? "text-green-500"
                    : "text-off-dark dark:text-muted-dark",
                )}
              >
                {copied === "code" ? (
                  <>
                    <LuCheck size={16} />
                    {t("Code copied")}
                  </>
                ) : (
                  <>
                    <LuCopy size={16} />
                    {t("Click to copy")}
                  </>
                )}
              </small>
            </button>

            <div className="flex items-center gap-[18px]">
              <div className="size-[140px] md:size-[150px] [@media(min-height:900px)]:md:size-[200px] shrink-0 rounded-[14px] bg-white p-2 md:p-2.5 border border-lprimary/15 dark:border-white/5">
                <QRCodeSVG
                  value={joinUrl}
                  marginSize={0}
                  level="M"
                  className="size-full"
                />
              </div>
              <div className="flex flex-col gap-1.5 min-w-0">
                <span className="text-xs font-semibold tracking-[0.12em] uppercase text-[#8a8896] dark:text-muted-dark">
                  {t("Scan to join")}
                </span>
                <p className="text-[13.5px] leading-normal text-off-dark dark:text-muted-dark">
                  {t(
                    "Players can scan this with their phone camera, or open the link below.",
                  )}
                </p>
              </div>
            </div>

            <div className="rounded-xl border bg-lprimary/8 dark:bg-white/5 border-lprimary/15 dark:border-white/5 px-3.5 py-2.5">
              <p className="truncate text-[13.5px] text-off-dark dark:text-muted-dark">
                {joinUrl}
              </p>
            </div>
            <div
              className={clsx(
                "grid gap-2.5",
                canShare ? "grid-cols-2" : "grid-cols-1",
              )}
            >
              <button
                type="button"
                onClick={() => copy("link", joinUrl)}
                className={clsx(
                  "flex items-center justify-center gap-2 rounded-xl border-[1.5px] bg-light-bg dark:bg-card-dark p-[11px] text-sm font-semibold cursor-pointer transition-colors",
                  copied === "link"
                    ? "border-green-500 text-green-500"
                    : "border-lprimary/15 dark:border-white/5 hover:border-dprimary",
                )}
              >
                {copied === "link" ? (
                  <LuCheck size={16} />
                ) : (
                  <LuCopy size={16} />
                )}
                {copied === "link" ? "Copied" : t("Copy link")}
              </button>
              {canShare && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.share({ url: joinUrl }).catch(() => {});
                  }}
                  className="flex items-center justify-center gap-2 rounded-xl border-[1.5px] bg-light-bg dark:bg-card-dark border-lprimary/15 dark:border-white/5 hover:border-dprimary p-[11px] text-sm font-semibold cursor-pointer transition-colors"
                >
                  <LuShare2 size={16} />
                  {t("Share")}
                </button>
              )}
            </div>

            <div className="md:mt-auto pt-[18px] md:pt-3.5 [@media(min-height:900px)]:md:pt-[18px] border-t border-lprimary/15 dark:border-white/10 flex flex-col gap-[9px]">
              <div className="flex justify-between items-baseline text-[13.5px] text-off-dark dark:text-muted-dark">
                <span>{t("Participants")}</span>
                <span>
                  <b
                    className={clsx(
                      "text-xl font-bold",
                      isFull
                        ? "text-red-light dark:text-red-dark"
                        : "text-dark dark:text-white",
                    )}
                  >
                    {players.length}
                  </b>{" "}
                  / {maxPlayers}
                </span>
              </div>
              {/* Light: who is here; strong: who has downloaded everything. */}
              <div className="relative h-2 rounded-lg overflow-hidden bg-lprimary/8 dark:bg-white/5">
                <div
                  className={clsx(
                    "absolute inset-y-0 left-0 rounded-lg transition-[width] duration-300",
                    isFull
                      ? "bg-red-light/40 dark:bg-red-dark/40"
                      : "bg-[#9a6cf5]/35 dark:bg-accent/35",
                  )}
                  style={{ width: `${fillPct}%` }}
                />
                <div
                  className={clsx(
                    "absolute inset-y-0 left-0 rounded-lg transition-[width] duration-300",
                    isFull
                      ? "bg-red-light dark:bg-red-dark"
                      : "bg-linear-to-br from-[#9a6cf5] to-[#7c4ddb] dark:from-accent dark:to-accent-deep",
                  )}
                  style={{ width: `${readiness ? readyPct : fillPct}%` }}
                />
              </div>
              {readiness && readiness.total > 0 && (
                <p className="text-[12.5px] font-semibold text-dark dark:text-white">
                  {t("{ready} / {n} ready", {
                    ready: readiness.ready,
                    n: readiness.total,
                  })}
                </p>
              )}
              <p className="text-[12.5px] text-off-dark dark:text-muted-dark">
                {t("This room can hold up to {n} players.", { n: maxPlayers })}
                {billing && params.plan === "free" && (
                  <>
                    {" "}
                    <Link
                      href="/pricing"
                      className="font-semibold text-lprimary dark:text-dprimary hover:underline"
                    >
                      {t("Upgrade to Pro")}
                    </Link>{" "}
                    {t("for rooms of up to 250.")}
                  </>
                )}
              </p>
            </div>
          </section>

          <section className="rounded-3xl border bg-white dark:bg-dark border-lprimary/15 dark:border-white/5 flex flex-col md:min-h-0 md:overflow-hidden">
            <div className="flex flex-wrap items-center gap-3.5 p-4 md:px-[22px] md:pt-5 md:pb-4 border-b border-lprimary/15 dark:border-white/10">
              <h2 className="flex items-center gap-[7px] text-sm font-semibold">
                {t("Players")}
                <span className="rounded-full px-2 py-px text-xs bg-lprimary/8 dark:bg-white/5 text-off-dark dark:text-muted-dark">
                  {players.length}
                </span>
              </h2>
              <label className="flex-1 min-w-40 flex items-center gap-2 rounded-xl border bg-light-bg dark:bg-card-dark border-lprimary/15 dark:border-white/5 focus-within:border-dprimary px-3 text-[#8a8896] dark:text-muted-dark">
                <LuSearch size={17} />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("Search players")}
                  aria-label={t("Search players")}
                  className="flex-1 min-w-0 bg-transparent outline-none py-2.5 text-sm text-dark dark:text-white"
                />
              </label>
            </div>

            <div
              ref={listRef}
              className="md:flex-1 md:min-h-0 md:overflow-y-auto overflow-x-hidden px-4 py-3 md:px-[22px] md:py-4 grid grid-cols-1 md:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] auto-rows-[58px] gap-2.5 content-start"
            >
              {visiblePlayers.map((player) => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  stats={bubbles[player.id]}
                  reaction={fresh(player.id)}
                  plain={crowded}
                  onBan={setPlayerToBan}
                  onKick={onKick}
                />
              ))}
              {visiblePlayers.length === 0 && (
                <div className="col-span-full text-center text-sm py-10 text-[#8a8896] dark:text-muted-dark">
                  {query.trim()
                    ? t("No players match your search.")
                    : t("Waiting for players to join…")}
                </div>
              )}
            </div>

            <div className="sticky bottom-12 md:static flex flex-col md:flex-row items-stretch md:items-center gap-2.5 md:gap-4 px-4 py-3.5 md:px-[22px] md:py-4 border-t border-lprimary/15 dark:border-white/10 bg-white dark:bg-dark rounded-b-3xl">
              <p className="flex-1 text-[13.5px] text-off-dark dark:text-muted-dark">
                {t(
                  pl(
                    players.length,
                    "{n} player is ready. More can join until you start.",
                    "{n} players are ready. More can join until you start.",
                  ),
                  { n: players.length },
                )}
              </p>
              <button
                type="button"
                disabled={startDisabled}
                onClick={handleGameStart}
                className="flex items-center justify-center gap-2.5 whitespace-nowrap rounded-[14px] px-[30px] py-3.5 text-base font-bold text-white bg-linear-to-br from-[#9a6cf5] to-[#7c4ddb] dark:from-accent dark:to-accent-deep shadow-[0_10px_24px_-10px_#7c4ddb] transition-[filter,transform] hover:brightness-108 active:translate-y-px cursor-pointer disabled:opacity-50 disabled:cursor-default disabled:hover:brightness-100"
              >
                <LuPlay size={17} className="fill-current" />
                {load
                  ? "Loading..."
                  : players.length === 0
                    ? t("Start without players")
                    : waitingForDownloads
                      ? t("Waiting for downloads ({n} left · {s} s)", {
                          n: pendingDownloads,
                          s: forceIn,
                        })
                      : canForce
                        ? t("Start anyway ({n} still loading)", {
                            n: pendingDownloads,
                          })
                        : t("Start Game")}
              </button>
            </div>
          </section>
        </div>

        {bubbleLayer}
        <ReactionOverlay
          socket={socket}
          nameOf={(id) => players.find((p) => p.id === id)?.name ?? undefined}
        />
        <ConfirmationModal
          open={playerToBan !== null}
          setOpen={(open) => {
            if (!open) setPlayerToBan(null);
          }}
          onClick={handlePlayerBan}
          desc={t(
            "{name} will be removed and blocked from rejoining this room. The ban lasts until this room ends.",
            { name: playerToBan?.name ?? t("This player") },
          )}
          confirmLabel={t("Ban Player")}
          confirming={banPlayerMutation.isPending}
          confirmingLabel={t("Banning…")}
        />
      </div>
    </GameSounds>
  );
};

const REACTION_SHOW_MS = 5000;
/** Busy-room events (reactions, bubble stats) are applied this often. */
const FLUSH_MS = 500;
/** Above this many players no bubbles rise out of the cards. */
const FLYER_PLAYER_LIMIT = 60;
/** Above this many players: no reorder animation, plain numbers. */
const CROWD_LIMIT = 40;
/** The waiting list re-sorts (bubble score, reactions) at most this often. */
const REORDER_EVERY_MS = 5000;
/** A player's reactions move them to the top of the list at most this often. */
const BUMP_EVERY_MS = 20_000;

/** Bubble ranking: hits, scaled down by the share of taps that missed. */
function bubbleScore(stats: { hits: number; misses: number } | undefined) {
  if (!stats) return -1;
  const taps = stats.hits + stats.misses;
  return taps > 0 ? (stats.hits * stats.hits) / taps : 0;
}

/** The current time, ticking every 500 ms while `active`. */
function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [active]);
  return active ? now : 0;
}

/** Glide `[data-flip-id]` children to their new spot (both axes, grid-safe). */
function useFlip2d(
  container: { current: HTMLElement | null },
  orderKey: string,
) {
  const last = useRef(new Map<string, { x: number; y: number }>());
  useLayoutEffect(() => {
    const root = container.current;
    if (!root) return;
    const next = new Map<string, { x: number; y: number }>();
    root.querySelectorAll<HTMLElement>("[data-flip-id]").forEach((el) => {
      const r = el.getBoundingClientRect();
      const id = el.dataset.flipId!;
      next.set(id, { x: r.left, y: r.top });
      const prev = last.current.get(id);
      if (prev && (prev.x !== r.left || prev.y !== r.top)) {
        el.animate(
          [
            {
              transform: `translate(${prev.x - r.left}px, ${prev.y - r.top}px)`,
            },
            { transform: "translate(0, 0)" },
          ],
          { duration: 450, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
        );
      }
    });
    last.current = next;
  }, [container, orderKey]);
}

/**
 * One waiting player. Memoised: with hundreds in the room, a join, a
 * reaction or a bubble batch re-renders only the cards whose data changed
 * (the whole grid re-rendering several times a second froze the host page).
 */
const PlayerCard = memo(function PlayerCard({
  player,
  stats,
  reaction,
  plain,
  onBan,
  onKick,
}: {
  player: PlayerPayload;
  stats: { hits: number; misses: number } | undefined;
  reaction: { emoji: string; at: number } | null;
  plain: boolean;
  onBan: (player: PlayerPayload) => void;
  onKick: (player: PlayerPayload) => void;
}) {
  const t = useT();
  return (
    <div
      data-player-card={player.id}
      data-flip-id={player.id}
      className="group relative flex items-center gap-[11px] min-w-0 h-[58px] rounded-[14px] border bg-light-bg dark:bg-card-dark border-lprimary/15 dark:border-white/5 hover:border-dprimary pr-2 pl-[9px] transition-colors animate-pop-in"
    >
      <Image
        src={player.profilePic || DEFAULT_AVATAR}
        width={36}
        height={36}
        alt=""
        className="size-9 shrink-0 rounded-full object-cover"
      />
      <span className="flex-1 min-w-0 flex flex-col">
        <span
          className="truncate text-[14.5px] font-medium"
          title={player.name ?? undefined}
        >
          {player.name}
        </span>
        {/* Always one line, so the card's height never changes. */}
        {stats ? (
          <BubbleLine stats={stats} plain={plain} />
        ) : (
          <span className="text-xs">&nbsp;</span>
        )}
      </span>
      {reaction && (
        <span
          key={reaction.at}
          aria-label={`Reacted ${reaction.emoji}`}
          className="pointer-events-none absolute -top-2 left-6 text-xl leading-none animate-pop-in drop-shadow"
        >
          {reaction.emoji}
        </span>
      )}
      <span className="flex gap-0.5 shrink-0 md:opacity-55 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
        <button
          type="button"
          aria-label={t("Ban {name} from this room", {
            name: player.name ?? "",
          })}
          title={t("Ban (can't rejoin)")}
          onClick={() => onBan(player)}
          className="size-[30px] rounded-[9px] flex items-center justify-center text-off-dark dark:text-muted-dark hover:bg-[#e5544e]/14 hover:text-[#e5544e] transition-colors cursor-pointer"
        >
          <LuBan size={17} />
        </button>
        <button
          type="button"
          aria-label={t("Remove {name}", {
            name: player.name ?? "",
          })}
          title={t("Kick (can rejoin)")}
          onClick={() => onKick(player)}
          className="size-[30px] rounded-[9px] flex items-center justify-center text-off-dark dark:text-muted-dark hover:bg-[#e5544e]/14 hover:text-[#e5544e] transition-colors cursor-pointer"
        >
          <LuX size={17} />
        </button>
      </span>
    </div>
  );
});

/** "🫧 12 · 80% hits" — the tally ticks up as the server relays new totals. */
function BubbleLine({
  stats,
  plain = false,
}: {
  stats: { hits: number; misses: number };
  /** No count-up animation (big rooms). */
  plain?: boolean;
}) {
  const total = stats.hits + stats.misses;
  return (
    <span className="text-xs text-off-dark dark:text-muted-dark tabular-nums">
      🫧 {plain ? stats.hits : <AnimatedNumber value={stats.hits} />}
      {total > 0 &&
        ` · ${tx("{n}% hits", { n: Math.round((stats.hits / total) * 100) })}`}
    </span>
  );
}

export default Lobby;
