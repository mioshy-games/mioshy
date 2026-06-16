/**
 * lib/games/coming-soon.ts
 *
 * Work-order 2026-06-15, part D — shared "Coming Soon" schedule logic for both
 * game catalogues (public.games + experience_games). Pure + isomorphic so the
 * server (initial render / ordering) and the client countdown agree.
 *
 *   · opens_at IS NULL  → immediate (open as soon as published).
 *   · opens_at >  now() → coming-soon: locked card + countdown.
 *   · opens_at <= now() → open.
 *
 * State is always derived live from opens_at — there is no separate flag.
 */

/** True when the game is scheduled to open in the future (locked + countdown). */
export function isComingSoon(
  opensAt: string | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!opensAt) return false;
  const t = new Date(opensAt).getTime();
  return Number.isFinite(t) && t > now;
}

/**
 * Stable catalogue order: coming-soon games first (soonest opening first), then
 * everything else keeping the caller's incoming order. Does not mutate the input.
 */
export function comingSoonFirst<T>(
  items: T[],
  getOpensAt: (item: T) => string | null | undefined,
  now: number = Date.now(),
): T[] {
  const soon: T[] = [];
  const rest: T[] = [];
  for (const item of items) {
    (isComingSoon(getOpensAt(item), now) ? soon : rest).push(item);
  }
  soon.sort(
    (a, b) =>
      new Date(getOpensAt(a) as string).getTime() -
      new Date(getOpensAt(b) as string).getTime(),
  );
  return [...soon, ...rest];
}
