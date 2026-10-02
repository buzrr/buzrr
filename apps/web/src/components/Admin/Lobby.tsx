"use client";
import clsx from "clsx";
import { DEFAULT_AVATAR } from "@/constants";
import { useEffect, useState, useCallback } from "react";
import { useAppDispatch, useAppSelector } from "@/state/hooks";
import { removePlayer, setPlayers } from "@/state/admin/playersSlice";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
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
import type { PlayerPayload } from "@/types/socket-events";
import ConfirmationModal from "@/components/Admin/ConfirmationModal";
import { buildJoinUrl } from "@/lib/join-link";
import EndQuizButton from "@/components/Admin/EndQuizButton";

const Lobby = (params: {
  roomId: string;
  userId: string;
  gameCode: string;
  players: PlayerPayload[];
  gameStarted: boolean;
  quizTitle: string;
  quizId: string;
  maxPlayers?: number;
  plan?: "free" | "pro";
}) => {
  const dispatch = useAppDispatch();
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
      toast.error(
        player.banned
          ? `You have banned ${player.name ?? "the player"}`
          : `You have removed ${player.name ?? "the player"}`,
      );
    },
    onGameStarted: handleGameStarted,
  });

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
            toast.error(`You have removed ${player.name ?? "the player"}`);
          }
        },
        onError: () => {
          toast.error("Could not remove player. Please try again.");
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
            toast.error(`You have banned ${player.name ?? "the player"}`);
          }
        },
        onError: () => {
          toast.error("Could not ban player. Please try again.");
        },
      },
    );
  }

  function handleGameStart() {
    if (!socket?.connected) {
      toast.error("Not connected to the game server yet. Please wait.");
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
  const visiblePlayers = players.filter((p) =>
    (p.name ?? "").toLowerCase().includes(query.trim().toLowerCase()),
  );

  useEffect(() => {
    setCanShare(typeof navigator.share === "function");
  }, []);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  function copy(what: "code" | "link", text: string) {
    navigator.clipboard
      .writeText(text)
      .then(() => setCopied(what))
      .catch(() => toast.error("Failed to copy"));
  }

  const startDisabled = players.length === 0 || load || !socket?.connected;

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col px-4 sm:px-6 lg:px-8 pb-16 md:pb-0 md:h-[calc(100dvh-7rem)] text-dark dark:text-white">
      <div className="flex flex-wrap md:flex-nowrap items-center gap-2.5 md:gap-[18px] py-3.5 md:py-[18px] shrink-0">
        <ConnectionStatusPill className="!shadow-none !text-[13px] !font-semibold !px-3 !py-1.5 !border-lprimary/15 dark:!border-white/10 !bg-white dark:!bg-white/5" />
        <div className="order-last md:order-none basis-full md:basis-auto flex-1 min-w-0 flex flex-col md:flex-row md:items-baseline gap-0.5 md:gap-3">
          <h1 className="text-[22px] md:text-2xl font-bold tracking-[-0.01em] truncate">
            {params?.quizTitle}
          </h1>
          <span className="text-sm text-off-dark dark:text-[#a1a1aa] whitespace-nowrap">
            Waiting for players
          </span>
        </div>
        <span className="flex-1 md:hidden" />
        <EndQuizButton
          inline
          roomId={params.roomId}
          redirectTo={`/admin/quiz/${params.quizId}`}
        />
      </div>

      <div className="flex-1 min-h-0 flex flex-col md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3.5 md:gap-5 pb-0 md:pb-[18px]">
        <section className="rounded-3xl border bg-white dark:bg-dark border-lprimary/15 dark:border-white/5 flex flex-col gap-4 md:gap-3.5 [@media(min-height:900px)]:md:gap-5 p-[18px] md:p-[22px] [@media(min-height:900px)]:md:p-[26px] md:min-h-0 md:overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className="text-xs font-semibold tracking-[0.12em] uppercase text-[#8a8896] dark:text-[#71717a]">
            Room code
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
                  : "text-off-dark dark:text-[#a1a1aa]",
              )}
            >
              {copied === "code" ? (
                <>
                  <LuCheck size={16} />
                  Code copied
                </>
              ) : (
                <>
                  <LuCopy size={16} />
                  Click to copy
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
              <span className="text-xs font-semibold tracking-[0.12em] uppercase text-[#8a8896] dark:text-[#71717a]">
                Scan to join
              </span>
              <p className="text-[13.5px] leading-normal text-off-dark dark:text-[#a1a1aa]">
                Players can scan this with their phone camera, or open the link
                below.
              </p>
            </div>
          </div>

          <div className="rounded-xl border bg-lprimary/8 dark:bg-white/5 border-lprimary/15 dark:border-white/5 px-3.5 py-2.5">
            <p className="truncate text-[13.5px] text-off-dark dark:text-[#a1a1aa]">
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
              {copied === "link" ? <LuCheck size={16} /> : <LuCopy size={16} />}
              {copied === "link" ? "Copied" : "Copy link"}
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
                Share
              </button>
            )}
          </div>

          <div className="md:mt-auto pt-[18px] md:pt-3.5 [@media(min-height:900px)]:md:pt-[18px] border-t border-lprimary/15 dark:border-white/10 flex flex-col gap-[9px]">
            <div className="flex justify-between items-baseline text-[13.5px] text-off-dark dark:text-[#a1a1aa]">
              <span>Participants</span>
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
            <div className="h-2 rounded-lg overflow-hidden bg-lprimary/8 dark:bg-white/5">
              <div
                className={clsx(
                  "h-full rounded-lg transition-[width] duration-300",
                  isFull
                    ? "bg-red-light dark:bg-red-dark"
                    : "bg-linear-to-br from-[#9a6cf5] to-[#7c4ddb]",
                )}
                style={{ width: `${fillPct}%` }}
              />
            </div>
            <p className="text-[12.5px] text-off-dark dark:text-[#a1a1aa]">
              This room can hold up to {maxPlayers} players.
              {params.plan === "free" && (
                <>
                  {" "}
                  <Link
                    href="/pricing"
                    className="font-semibold text-lprimary dark:text-dprimary hover:underline"
                  >
                    Upgrade to Pro
                  </Link>{" "}
                  for rooms of up to 250.
                </>
              )}
            </p>
          </div>
        </section>

        <section className="rounded-3xl border bg-white dark:bg-dark border-lprimary/15 dark:border-white/5 flex flex-col md:min-h-0 md:overflow-hidden">
          <div className="flex flex-wrap items-center gap-3.5 p-4 md:px-[22px] md:pt-5 md:pb-4 border-b border-lprimary/15 dark:border-white/10">
            <h2 className="flex items-center gap-[7px] text-sm font-semibold">
              Players
              <span className="rounded-full px-2 py-px text-xs bg-lprimary/8 dark:bg-white/5 text-off-dark dark:text-[#a1a1aa]">
                {players.length}
              </span>
            </h2>
            <label className="flex-1 min-w-40 flex items-center gap-2 rounded-xl border bg-light-bg dark:bg-card-dark border-lprimary/15 dark:border-white/5 focus-within:border-dprimary px-3 text-[#8a8896] dark:text-[#71717a]">
              <LuSearch size={17} />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search players"
                aria-label="Search players"
                className="flex-1 min-w-0 bg-transparent outline-none py-2.5 text-sm text-dark dark:text-white"
              />
            </label>
          </div>

          <div className="md:flex-1 md:min-h-0 md:overflow-y-auto px-4 py-3 md:px-[22px] md:py-4 grid grid-cols-1 md:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2.5 content-start">
            {visiblePlayers.map((player) => (
              <div
                key={player.id}
                className="group flex items-center gap-[11px] min-w-0 rounded-[14px] border bg-light-bg dark:bg-card-dark border-lprimary/15 dark:border-white/5 hover:border-dprimary py-2 pr-2 pl-[9px] transition-colors animate-pop-in"
              >
                <Image
                  src={player.profilePic || DEFAULT_AVATAR}
                  width={36}
                  height={36}
                  alt=""
                  className="size-9 shrink-0 rounded-full object-cover"
                />
                <span
                  className="flex-1 min-w-0 truncate text-[14.5px] font-medium"
                  title={player.name ?? undefined}
                >
                  {player.name}
                </span>
                <span className="flex gap-0.5 shrink-0 md:opacity-55 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
                  <button
                    type="button"
                    aria-label={`Ban ${player.name} from this room`}
                    title="Ban (can't rejoin)"
                    onClick={() => setPlayerToBan(player)}
                    className="size-[30px] rounded-[9px] flex items-center justify-center text-off-dark dark:text-[#a1a1aa] hover:bg-[#e5544e]/14 hover:text-[#e5544e] transition-colors cursor-pointer"
                  >
                    <LuBan size={17} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${player.name}`}
                    title="Kick (can rejoin)"
                    onClick={() => handlePlayerRemove(player)}
                    className="size-[30px] rounded-[9px] flex items-center justify-center text-off-dark dark:text-[#a1a1aa] hover:bg-[#e5544e]/14 hover:text-[#e5544e] transition-colors cursor-pointer"
                  >
                    <LuX size={17} />
                  </button>
                </span>
              </div>
            ))}
            {visiblePlayers.length === 0 && (
              <div className="col-span-full text-center text-sm py-10 text-[#8a8896] dark:text-[#71717a]">
                {query.trim()
                  ? "No players match your search."
                  : "Waiting for players to join…"}
              </div>
            )}
          </div>

          <div className="sticky bottom-12 md:static flex flex-col md:flex-row items-stretch md:items-center gap-2.5 md:gap-4 px-4 py-3.5 md:px-[22px] md:py-4 border-t border-lprimary/15 dark:border-white/10 bg-white dark:bg-dark rounded-b-3xl">
            <p className="flex-1 text-[13.5px] text-off-dark dark:text-[#a1a1aa]">
              {players.length}{" "}
              {players.length === 1 ? "player is" : "players are"} ready. More
              can join until you start.
            </p>
            <button
              type="button"
              disabled={startDisabled}
              onClick={handleGameStart}
              className="flex items-center justify-center gap-2.5 whitespace-nowrap rounded-[14px] px-[30px] py-3.5 text-base font-bold text-white bg-linear-to-br from-[#9a6cf5] to-[#7c4ddb] shadow-[0_10px_24px_-10px_#7c4ddb] transition-[filter,transform] hover:brightness-108 active:translate-y-px cursor-pointer disabled:opacity-50 disabled:cursor-default disabled:hover:brightness-100"
            >
              <LuPlay size={17} className="fill-current" />
              {load ? "Loading..." : "Start Game"}
            </button>
          </div>
        </section>
      </div>

      <ConfirmationModal
        open={playerToBan !== null}
        setOpen={(open) => {
          if (!open) setPlayerToBan(null);
        }}
        onClick={handlePlayerBan}
        desc={`${playerToBan?.name ?? "This player"} will be removed and blocked from rejoining this room. The ban lasts until this room ends.`}
        confirmLabel="Ban Player"
        confirming={banPlayerMutation.isPending}
        confirmingLabel="Banning…"
      />
    </div>
  );
};

export default Lobby;
