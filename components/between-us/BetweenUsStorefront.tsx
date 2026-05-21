"use client";

// 2026-05-20 — useTransition + React.memo together kill the INP
// 1970ms problem on /mioshy-sex:
//   • useTransition wraps the filter setters so the click handler
//     returns immediately; the re-render runs in a non-urgent slot.
//   • React.memo on GameCard ensures the (unfiltered) cards that
//     remain in the grid skip reconciliation entirely — only the
//     cards being added/removed do any DOM work.
// Combined: filter click goes from blocking ~2s of main-thread to
// nearly instant.
import { memo, useMemo, useState, useTransition } from "react";
import { Link } from "@/navigation";
// 2026-05-20 — switched from lucide-react to local inline-SVG icon
// components. Each card renders 3 stat-chip icons (Heart, MsgCircle,
// Flame); with 30+ cards in the catalogue that's 90 icon instances
// per render. Inline SVG components skip lucide's component-wrapper
// overhead → measurable TBT win on /mioshy-sex.
import {
  Flame,
  Heart,
  MessageCircleHeart,
  Sparkles,
  Star,
} from "@/components/icons/Icons";
import type {
  ExperienceGameCategory,
  ExperienceGameTag,
} from "@/lib/between-us/types";
import type { GameCardData } from "@/lib/between-us/queries";

type Hero = {
  title: string;
  tagline: string;
  singlePrice: string;
  subPrice: string;
  singleEnabled: boolean;
  subEnabled: boolean;
  buyXGetX: { buy: number; get: number }[];
};

export function BetweenUsStorefront({
  locale,
  hero,
  cards,
  categories,
  tags,
  hideHero = false,
  catalogueHeading,
}: {
  locale: string;
  hero: Hero;
  cards: GameCardData[];
  categories: ExperienceGameCategory[];
  tags: ExperienceGameTag[];
  /** When true, the internal hero is suppressed (so the page can render its own). */
  hideHero?: boolean;
  /** Optional heading shown above the grid when hero is hidden. */
  catalogueHeading?: { title: string; subtitle?: string | null };
}) {
  const isHe = locale === "he";
  const [selectedCategory, setSelectedCategory] = useState<string | "all">("all");
  const [selectedTag, setSelectedTag] = useState<string | "all">("all");
  // 2026-05-20 — startTransition wraps the filter state setters so
  // React treats the filter change as non-urgent work. The button
  // click feels instant; the filtered grid re-renders in the next
  // task slot. `isPending` is available for visual feedback if
  // needed later (e.g. a subtle opacity dip on the grid during the
  // transition).
  // `isPending` would let us dim the grid while the transition runs;
  // not wired today, so the destructured slot is underscore-prefixed
  // to satisfy ESLint's unused-vars rule (allows /^_/).
  const [_isPending, startTransition] = useTransition();

  // Filter out empty categories and tags (those with no cards).
  // 2026-05-20 — wrapped in useMemo so the .flatMap + Set
  // construction doesn't recompute on every filter click (only
  // when `cards` changes, which is once per page load).
  const { visibleCategories, visibleTags } = useMemo(() => {
    const activeCategoryIds = new Set(cards.flatMap((c) => c.category_ids));
    const activeTagIds = new Set(cards.flatMap((c) => c.tag_ids));
    return {
      visibleCategories: categories.filter((c) => activeCategoryIds.has(c.id)),
      visibleTags: tags.filter((t) => activeTagIds.has(t.id)),
    };
  }, [cards, categories, tags]);

  const filtered = useMemo(() => {
    return cards.filter((c) => {
      if (selectedCategory !== "all" && !c.category_ids.includes(selectedCategory)) return false;
      if (selectedTag !== "all" && !c.tag_ids.includes(selectedTag)) return false;
      return true;
    });
  }, [cards, selectedCategory, selectedTag]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-12">
      {/* Hero */}
      {hideHero ? null : (
      <section className="text-center">
        <div className="mx-auto inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs backdrop-blur">
          <Sparkles className="h-3.5 w-3.5 text-fuchsia-200" />
          <span className="text-white/85">
            {isHe ? "מבצע זוגות" : "For couples"}
          </span>
        </div>
        <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">
          {hero.title}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-white/80">
          {hero.tagline}
        </p>

        {/* Pricing strip */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm">
          {hero.singleEnabled ? (
            <div className="rounded-full border border-white/20 bg-white/10 px-4 py-2 backdrop-blur">
              <span className="text-white/70">
                {isHe ? "משחק בודד" : "Single game"}
              </span>
              <span className="ms-2 font-semibold">{hero.singlePrice}</span>
            </div>
          ) : null}
          {hero.subEnabled ? (
            <div className="rounded-full border border-fuchsia-300/40 bg-fuchsia-400/15 px-4 py-2 backdrop-blur">
              <Star className="me-1.5 inline h-3.5 w-3.5" />
              <span className="text-white/80">
                {isHe ? "מינוי" : "Membership"}
              </span>
              <span className="ms-2 font-semibold">{hero.subPrice}</span>
            </div>
          ) : null}
          {hero.buyXGetX.length > 0 ? (
            <div className="rounded-full border border-amber-300/40 bg-amber-400/15 px-4 py-2 backdrop-blur">
              <span className="text-white/80">
                {hero.buyXGetX
                  .map((t) =>
                    isHe
                      ? `קנה ${t.buy} קבל ${t.get}`
                      : `Buy ${t.buy} Get ${t.get}`,
                  )
                  .join(" · ")}
              </span>
            </div>
          ) : null}
        </div>
      </section>
      )}

      {/* Catalogue heading (only when hero is hidden) */}
      {hideHero && catalogueHeading ? (
        <section className="mb-2 mt-2 text-center">
          <h2 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            {catalogueHeading.title}
          </h2>
          {catalogueHeading.subtitle ? (
            <p className="mx-auto mt-3 max-w-2xl text-white/75">
              {catalogueHeading.subtitle}
            </p>
          ) : null}
        </section>
      ) : null}

      {/* Filters */}
      {visibleCategories.length > 0 || visibleTags.length > 0 ? (
        <section className="mt-12 space-y-3">
          {visibleCategories.length > 0 ? (
            <FilterRow
              label={isHe ? "קטגוריות" : "Categories"}
              items={[
                { id: "all", label: isHe ? "הכל" : "All", color_hex: null },
                ...visibleCategories.map((c) => ({
                  id: c.id,
                  label: isHe ? c.name_he : c.name_en || c.name_he,
                  color_hex: c.color_hex,
                })),
              ]}
              selected={selectedCategory}
              onSelect={(v) =>
                startTransition(() => setSelectedCategory(v as string))
              }
            />
          ) : null}
          {visibleTags.length > 0 ? (
            <FilterRow
              label={isHe ? "תגיות" : "Tags"}
              items={[
                { id: "all", label: isHe ? "הכל" : "All", color_hex: null },
                ...visibleTags.map((t) => ({
                  id: t.id,
                  label: isHe ? t.name_he : t.name_en || t.name_he,
                  color_hex: t.color_hex,
                })),
              ]}
              selected={selectedTag}
              onSelect={(v) =>
                startTransition(() => setSelectedTag(v as string))
              }
              isTagRow
            />
          ) : null}
        </section>
      ) : null}

      {/* Grid */}
      <section className="mt-10">
        {filtered.length === 0 ? (
          <div className="mx-auto max-w-lg rounded-3xl border border-white/10 bg-white/5 p-10 text-center backdrop-blur">
            <p className="text-white/80">
              {isHe
                ? "אין משחקים התואמים את הסינון. נסו לאפס את הסינון."
                : "No games match the current filter. Try clearing it."}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(({ game }) => (
              <GameCard
                key={game.id}
                locale={locale}
                game={game}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function FilterRow({
  label,
  items,
  selected,
  onSelect,
  isTagRow = false,
}: {
  label: string;
  items: { id: string; label: string; color_hex: string | null }[];
  selected: string;
  onSelect: (id: string) => void;
  isTagRow?: boolean;
}) {
  return (
    <div>
      <p className={`mb-2 text-xs font-semibold uppercase tracking-wide ${isTagRow ? "text-white" : "text-white/60"}`}>
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {items.map((it) => {
          const isActive = selected === it.id;
          return (
            <button
              type="button"
              key={it.id}
              onClick={() => onSelect(it.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition ${
                isActive
                  ? "border-white/40 bg-white/20 text-white"
                  : isTagRow
                    ? "border-white/30 bg-white/10 text-white hover:bg-white/15"
                    : "border-white/15 bg-white/5 text-white/75 hover:bg-white/10"
              }`}
            >
              {it.color_hex ? (
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: it.color_hex }}
                />
              ) : null}
              {it.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// 2026-05-20 — Wrapped in React.memo so cards that stay in the grid
// (between filter changes) skip re-renders. `locale` and `game` are
// stable references when the parent re-renders for a filter change
// (cards array identity is preserved, individual game objects too).
const GameCard = memo(function GameCardImpl({
  locale,
  game,
}: {
  locale: string;
  game: GameCardData["game"];
}) {
  const isHe = locale === "he";
  const title = isHe ? game.title_he : game.title_en || game.title_he;
  const desc = isHe
    ? game.short_desc_he
    : game.short_desc_en || game.short_desc_he;
  // Currency symbol on the visual LEFT with a space, isolated LTR so it
  // doesn't get reordered by the surrounding RTL flow ("₪ 127", not "127₪").
  // U+2066 = LRI (Left-to-Right Isolate), U+2069 = PDI (Pop Directional Isolate).
  const priceLabel =
    isHe && game.price_ils != null
      ? `⁦₪ ${Number(game.price_ils).toFixed(0)}⁩`
      : game.price_usd != null
        ? `⁦$ ${Number(game.price_usd).toFixed(0)}⁩`
        : null;

  return (
    /* 2026-05-20 — `backdrop-blur` REMOVED from catalog card below.
       backdrop-filter forces compositor readback on every paint
       (including every scroll tick) — compounds with 3-30+ cards
       to produce measurable scroll jank. Solid alpha background
       gives the same dark glassy feel at zero readback cost. */
    <Link
      href={`/mioshy-sex/${game.slug}`}
      className="group block overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 shadow-xl transition hover:border-fuchsia-300/40 hover:from-white/20"
    >
      <div className="relative aspect-[5/3] overflow-hidden bg-gradient-to-br from-fuchsia-500/30 to-violet-500/20 sm:aspect-[4/3]">
        {game.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={game.cover_image_url}
            alt={title}
            className="h-full w-full object-cover transition group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-white/40">
            <Heart className="h-12 w-12" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 to-transparent" />

        {/* Flags */}
        <div className="absolute top-3 end-3 flex flex-col gap-1">
          {game.is_new ? (
            <span className="rounded-full bg-emerald-500/90 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-white shadow">
              {isHe ? "חדש" : "New"}
            </span>
          ) : null}
          {game.is_popular ? (
            <span className="rounded-full bg-amber-500/90 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-white shadow">
              {isHe ? "פופולרי" : "Popular"}
            </span>
          ) : null}
        </div>
      </div>

      <div className="p-5">
        {/* Card title - Frank Ruhl Libre directly (not the `font-heading`
            token) so the typeface stays SERIF in BOTH locales. The token
            resolves to IBM Plex Sans Hebrew in RTL, which is sans-serif
            and breaks visual continuity with every other heading on the
            site. Mobile size bumped +20% (text-xl → text-2xl); desktop
            keeps text-xl since the catalogue grid renders multiple cards
            per row and a bigger title there throws off the rhythm. */}
        <h3
          className="text-2xl text-white group-hover:text-fuchsia-100 sm:text-xl"
          style={{ fontFamily: "'Frank Ruhl Libre', serif", fontWeight: 700 }}
        >
          {title}
        </h3>
        {desc ? (
          <p className="mt-2 line-clamp-2 text-[18px] leading-[1.5] text-white/75 sm:text-sm sm:leading-normal">{desc}</p>
        ) : null}

        {/* Level badges */}
        <div className="mt-4 flex items-center gap-3 text-xs text-white/70">
          <LevelBadge
            icon={<Heart className="h-3.5 w-3.5 text-rose-300" />}
            label={isHe ? "אינטימיות" : "Intimacy"}
            level={game.intimacy_level}
          />
          <LevelBadge
            icon={
              <MessageCircleHeart className="h-3.5 w-3.5 text-sky-300" />
            }
            label={isHe ? "תקשורת" : "Talk"}
            level={game.communication_level}
          />
          <LevelBadge
            icon={<Flame className="h-3.5 w-3.5 text-orange-300" />}
            label={isHe ? "חום" : "Heat"}
            level={game.heat_level}
          />
        </div>

        <div className="mt-5 flex items-center justify-between">
          <span className="text-sm text-fuchsia-200 group-hover:text-white">
            {isHe ? "לצפייה במשחק" : "Open game"} →
          </span>
          {priceLabel ? (
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">
              {priceLabel}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
});

function LevelBadge({
  icon,
  label,
  level,
}: {
  icon: React.ReactNode;
  label: string;
  level: number;
}) {
  return (
    <div
      className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-xs ring-1 ring-white/10"
      title={`${label}: ${level}/5`}
    >
      {icon}
      <span className="font-semibold text-white/85">{level}/5</span>
    </div>
  );
}
