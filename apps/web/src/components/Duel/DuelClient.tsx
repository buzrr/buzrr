"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import type { DuelCategory, DuelMatchedPayload } from "@buzrr/contract";
import { DEFAULT_AVATAR } from "@/constants";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import ClientImage from "@/components/ClientImage";
import { labelClass } from "@/components/Game/GameUI";
import { useDuelQueue } from "@/hooks/useDuelQueue";
import {
  useCreateDuelInviteMutation,
  useDuelCategoriesQuery,
  useDuelProfileQuery,
  useSyncDuelTimeZone,
} from "@/lib/modules/duel/hooks";
import CategoryPicker from "./CategoryPicker";
import DuelProfileCard from "./DuelProfileCard";
import StreakButton from "./StreakButton";
import { RANDOM_HUE, categorySwatch } from "./duelUi";
import { useT } from "@/lib/i18n/context";
import { storeMatched } from "./matchedStorage";

/** After this long searching a category, offer Random instead. */
const SWITCH_TO_RANDOM_AFTER_S = 10;

export default function DuelClient({
  initialCategoryId,
  autoStart,
}: {
  initialCategoryId: string | null;
  /** "Play Again": start searching as soon as the page loads. */
  autoStart: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const { data: profile, isPending } = useDuelProfileQuery();
  const { data: catalog, isPending: catalogPending } = useDuelCategoriesQuery();
  useSyncDuelTimeZone(profile ? profile.timeZone : undefined);
  const createInvite = useCreateDuelInviteMutation();
  const [categoryId, setCategoryId] = useState<string | null>(
    initialCategoryId,
  );

  // A stale link (category removed or emptied) falls back to Random.
  const category: DuelCategory | null =
    (categoryId && catalog?.categories.find((c) => c.id === categoryId)) ||
    null;
  const effectiveId = catalog ? (category?.id ?? null) : categoryId;
  const categoryName = category?.name ?? t("Random");

  const { status, error, queuedAt, findMatch, cancel, switchCategory } =
    useDuelQueue({
      onMatched: (payload: DuelMatchedPayload) => {
        storeMatched(payload);
        router.push(`/duel/game/${payload.gameCode}`);
      },
    });
  const [searchingId, setSearchingId] = useState<string | null>(null);

  const select = useCallback(
    (id: string | null) => {
      setCategoryId(id);
      router.replace(
        id ? `/duel?category=${encodeURIComponent(id)}` : "/duel",
        {
          scroll: false,
        },
      );
    },
    [router],
  );

  const start = useCallback(() => {
    setSearchingId(effectiveId);
    void findMatch(effectiveId);
  }, [effectiveId, findMatch]);

  const autoStarted = useRef(false);
  useEffect(() => {
    if (!autoStart || autoStarted.current || catalogPending) return;
    autoStarted.current = true;
    start();
    // Drop `auto` so a reload doesn't re-queue.
    router.replace(
      effectiveId
        ? `/duel?category=${encodeURIComponent(effectiveId)}`
        : "/duel",
      { scroll: false },
    );
  }, [autoStart, catalogPending, start, router, effectiveId]);

  const searching = status === "queued" || status === "connecting";
  const searchingCategory =
    (searchingId && catalog?.categories.find((c) => c.id === searchingId)) ||
    null;

  const invite = () =>
    createInvite.mutate(effectiveId, {
      onSuccess: (res) => router.push(`/duel/invite/${res.code}`),
      onError: () =>
        toast.error(t("Couldn't create a challenge link. Try again.")),
    });

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-card-light dark:border-card-dark bg-light-bg/90 dark:bg-dark-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" aria-label={t("Buzrr home")}>
            <ClientImage
              props={{
                src: "/images/logo.svg",
                darksrc: "/images/logo-dark.svg",
                alt: t("Buzrr Logo"),
                width: 72,
                height: 72,
              }}
            />
          </Link>
          <div className="flex items-center gap-2.5 sm:gap-3.5">
            {profile && <StreakButton streak={profile.streak} />}
            <Link href="/duel/profile" aria-label={t("Open your profile")}>
              <Image
                src={session?.user?.image || DEFAULT_AVATAR}
                width={40}
                height={40}
                alt={t("Profile")}
                className="h-10 w-10 rounded-full transition-opacity hover:opacity-90"
              />
            </Link>
          </div>
        </div>
      </header>

      <div className="flex w-full flex-1 flex-col items-center px-4 pb-44 pt-5 sm:justify-center sm:px-6 sm:pb-16 sm:pt-10">
        <div className="flex w-full max-w-[660px] flex-col gap-3.5 sm:gap-[18px]">
          <h1 className="text-[28px] font-extrabold tracking-tight text-dark dark:text-white sm:text-center sm:text-5xl md:text-6xl animate-fade-up">
            {t("1v1 Duel")}
          </h1>

          {isPending ? (
            <Skeleton className="h-16 w-full rounded-2xl bg-white dark:bg-card-dark sm:h-40" />
          ) : profile ? (
            <>
              <div className="sm:hidden">
                <DuelProfileCard
                  profile={profile}
                  categoryId={effectiveId}
                  categoryName={categoryName}
                  compact
                />
              </div>
              <div className="hidden sm:block">
                <DuelProfileCard
                  profile={profile}
                  categoryId={effectiveId}
                  categoryName={categoryName}
                />
              </div>
            </>
          ) : null}

          {searching ? (
            <SearchingCard
              queuedAt={queuedAt}
              category={searchingCategory}
              onSwitchToRandom={() => {
                setSearchingId(null);
                select(null);
                switchCategory(null);
              }}
              onCancel={cancel}
            />
          ) : status === "matched" ? (
            <p className="animate-pulse text-center font-bold text-dark dark:text-white">
              {t("Opponent found — starting…")}
            </p>
          ) : (
            <>
              <div className="mt-1.5 hidden items-baseline justify-between sm:flex">
                <span className={labelClass}>{t("Category")}</span>
                <span className="text-[13.5px] text-off-dark dark:text-muted-dark">
                  {t("Each category has its own rating")}
                </span>
              </div>
              {catalogPending ? (
                <Skeleton className="h-64 w-full rounded-2xl bg-white dark:bg-card-dark" />
              ) : (
                <CategoryPicker
                  categories={catalog?.categories ?? []}
                  randomPlays={catalog?.randomPlays ?? 0}
                  selected={effectiveId}
                  onSelect={select}
                />
              )}

              {status === "timeout" && (
                <p className="text-center text-sm text-dark dark:text-white">
                  {t("No opponent found this time. Try again?")}
                </p>
              )}
              {status === "error" && error && (
                <p className="text-center text-sm text-red-light dark:text-red-dark">
                  {error}
                </p>
              )}

              {/* Floating on mobile so the CTAs stay reachable while scrolling. */}
              <div className="fixed inset-x-0 bottom-0 z-30 flex flex-col gap-2 bg-linear-to-t from-light-bg from-70% to-transparent px-4 pb-[22px] pt-3.5 dark:from-dark-bg sm:static sm:mt-2 sm:gap-3 sm:bg-none sm:p-0">
                <Button
                  fullWidth
                  size="lg"
                  onClick={start}
                  className="shadow-[0_12px_28px_-14px_rgba(60,30,160,0.55)] sm:shadow-none"
                >
                  {t("Find Match · {category}", { category: categoryName })}
                </Button>
                <Button
                  variant="outline"
                  fullWidth
                  size="lg"
                  disabled={createInvite.isPending}
                  onClick={invite}
                  className="bg-white! dark:bg-dark! sm:bg-transparent!"
                >
                  {createInvite.isPending
                    ? t("Creating link…")
                    : t("Invite a Friend")}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SearchingCard({
  queuedAt,
  category,
  onSwitchToRandom,
  onCancel,
}: {
  queuedAt: number | null;
  /** Null = searching Random. */
  category: DuelCategory | null;
  onSwitchToRandom: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!queuedAt) return;
    const tick = () => setElapsed(Math.floor((Date.now() - queuedAt) / 1000));
    tick();
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [queuedAt]);

  return (
    <div className="flex w-full flex-col items-center gap-3.5 rounded-[22px] border border-lprimary/15 dark:border-white/5 bg-white dark:bg-dark px-6 py-8 text-center shadow-[0_10px_30px_-18px_rgba(70,40,160,0.35)] animate-fade-up">
      <div className="h-16 w-16 animate-spin rounded-full border-[5px] border-card-light dark:border-card-dark border-t-lprimary dark:border-t-dprimary" />
      <h3 className="mt-1.5 text-xl font-bold text-dark dark:text-white sm:text-[22px]">
        {t("Searching for an opponent…")} {queuedAt ? `${elapsed} s` : ""}
      </h3>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-card-light dark:bg-card-dark px-3 py-1.5 text-[13.5px] font-bold text-lprimary dark:text-dprimary">
        <span
          className="h-[9px] w-[9px] rounded-[3px]"
          style={{ background: categorySwatch(category?.hue ?? RANDOM_HUE) }}
        />
        {category?.name ?? t("Random")}
      </span>
      <p className="text-[15px] text-off-dark dark:text-muted-dark">
        {t("The rating range widens the longer you wait.")}
      </p>
      {category && queuedAt && elapsed >= SWITCH_TO_RANDOM_AFTER_S && (
        <p className="text-sm text-off-dark dark:text-muted-dark">
          {t("Taking a while?")}{" "}
          <button
            type="button"
            onClick={onSwitchToRandom}
            className="cursor-pointer font-semibold text-lprimary hover:underline dark:text-dprimary"
          >
            {t("Switch to Random")}
          </button>{" "}
          {t("for a faster match.")}
        </p>
      )}
      <Button variant="outline" fullWidth onClick={onCancel} className="mt-1.5">
        {t("Cancel")}
      </Button>
    </div>
  );
}
