"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import clsx from "clsx";
import type { DuelCategory } from "@buzrr/contract";
import { labelClass } from "@/components/Game/GameUI";
import { useT, pl } from "@/lib/i18n/context";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  RANDOM_HUE,
  SearchIcon,
  ShuffleIcon,
  categorySwatch,
  formatPlays,
} from "./duelUi";

const PER_PAGE_DESKTOP = 8;
const PER_PAGE_MOBILE = 6;

/** 6 per page below the `sm` breakpoint (2 columns), 8 above (4 columns). */
function usePerPage(): number {
  const [perPage, setPerPage] = useState(PER_PAGE_DESKTOP);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)");
    const update = () =>
      setPerPage(query.matches ? PER_PAGE_MOBILE : PER_PAGE_DESKTOP);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return perPage;
}

const tileBase =
  "flex items-center gap-2.5 rounded-[14px] border-[1.5px] bg-white dark:bg-dark text-left font-semibold text-dark dark:text-white transition-[border-color,box-shadow,background-color] cursor-pointer";
const tileIdle =
  "border-lprimary/15 dark:border-white/10 hover:border-lprimary/50 dark:hover:border-dprimary/50";
const tileOn =
  "border-lprimary dark:border-dprimary bg-card-light! dark:bg-card-dark! shadow-[0_0_0_3px_rgba(125,73,248,0.18)]";

/**
 * Random (default) plus a searchable, paginated grid of categories that have
 * enough approved questions for a duel.
 */
export default function CategoryPicker({
  categories,
  randomPlays,
  selected,
  onSelect,
}: {
  categories: DuelCategory[];
  randomPlays: number;
  /** Category id, or null for Random. */
  selected: string | null;
  onSelect: (categoryId: string | null) => void;
}) {
  const t = useT();
  const perPage = usePerPage();
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? categories.filter((c) => c.name.toLowerCase().includes(q))
      : categories;
  }, [categories, query]);
  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(
    current * perPage,
    current * perPage + perPage,
  );

  return (
    <div className="flex flex-col gap-3.5">
      <button
        type="button"
        onClick={() => onSelect(null)}
        aria-pressed={selected === null}
        className={clsx(
          tileBase,
          "gap-3.5 px-4 py-3.5",
          selected === null ? tileOn : tileIdle,
        )}
      >
        <span
          className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px] text-white"
          style={{ background: categorySwatch(RANDOM_HUE) }}
        >
          <ShuffleIcon size={18} />
        </span>
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-2.5">
          <span className="text-base font-bold">{t("Random")}</span>
          <span className="text-[12.5px] font-medium text-off-dark dark:text-muted-dark">
            {t("Any category, mixed every round")}
          </span>
          <small className="w-full text-[11.5px] font-medium text-off-dark dark:text-muted-dark">
            {t(pl(randomPlays, "{n} play", "{n} plays"), {
              n: formatPlays(randomPlays),
            })}
          </small>
        </span>
        {selected === null && (
          <span className="ml-auto rounded-full border border-lprimary/15 dark:border-white/10 bg-white dark:bg-dark px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-[0.06em] text-lprimary dark:text-dprimary">
            {t("Default")}
          </span>
        )}
      </button>

      {categories.length > 0 && (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <span className={labelClass}>{t("Or pick a category")}</span>
            <label className="flex w-full items-center gap-2 rounded-xl border-[1.5px] border-lprimary/15 dark:border-white/10 bg-white dark:bg-card-dark px-3 py-2 text-[#8a8896] dark:text-muted-dark sm:w-60 focus-within:border-lprimary dark:focus-within:border-dprimary">
              <SearchIcon size={16} />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                }}
                placeholder={t(
                  pl(
                    categories.length,
                    "Search {n} category",
                    "Search {n} categories",
                  ),
                  { n: categories.length },
                )}
                aria-label={t("Search categories")}
                className="w-full bg-transparent text-[13.5px] text-dark dark:text-white outline-none placeholder:text-[#8a8896] dark:placeholder:text-muted-dark"
              />
            </label>
          </div>

          {visible.length === 0 ? (
            <p className="py-4 text-center text-sm text-off-dark dark:text-muted-dark">
              {t("No categories match “{query}”.", { query })}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2.5">
              {visible.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelect(c.id)}
                  aria-pressed={selected === c.id}
                  className={clsx(
                    tileBase,
                    "min-h-12 p-2.5 text-[13px] leading-tight sm:min-h-[54px] sm:p-3 sm:text-sm",
                    selected === c.id ? tileOn : tileIdle,
                  )}
                >
                  <span
                    className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                    style={{ background: categorySwatch(c.hue) }}
                  >
                    {c.name[0]}
                  </span>
                  <span className="flex min-w-0 flex-col gap-px">
                    <span className="truncate">{c.name}</span>
                    <small className="text-[11.5px] font-medium text-off-dark dark:text-muted-dark">
                      {t(pl(c.plays, "{n} play", "{n} plays"), {
                        n: formatPlays(c.plays),
                      })}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          )}

          {pages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <PagerButton
                label={t("Previous page")}
                disabled={current === 0}
                onClick={() => setPage(current - 1)}
              >
                <ChevronLeftIcon size={16} />
              </PagerButton>
              <span className="flex gap-1.5">
                {Array.from({ length: pages }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={t("Page {n}", { n: i + 1 })}
                    aria-current={i === current ? "page" : undefined}
                    onClick={() => setPage(i)}
                    className={clsx(
                      "h-[7px] cursor-pointer rounded transition-[width,background-color]",
                      i === current
                        ? "w-5 bg-lprimary dark:bg-dprimary"
                        : "w-[7px] rounded-full bg-lprimary/15 dark:bg-white/10",
                    )}
                  />
                ))}
              </span>
              <span className="min-w-[46px] text-center text-[13px] font-semibold text-off-dark dark:text-muted-dark">
                {t("{n} of {total}", { n: current + 1, total: pages })}
              </span>
              <PagerButton
                label={t("Next page")}
                disabled={current === pages - 1}
                onClick={() => setPage(current + 1)}
              >
                <ChevronRightIcon size={16} />
              </PagerButton>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PagerButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-[34px] w-[34px] cursor-pointer items-center justify-center rounded-[10px] border-[1.5px] border-lprimary/15 dark:border-white/10 bg-white dark:bg-dark text-dark dark:text-white disabled:cursor-default disabled:opacity-35"
    >
      {children}
    </button>
  );
}
