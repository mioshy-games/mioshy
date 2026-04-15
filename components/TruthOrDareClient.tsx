"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/navigation";
import { GameLayout } from "./GameLayout";
import { Wheel, type WheelApi } from "./Wheel";
import { type Question, type QuestionType } from "@/lib/game-engine";
import type { GameRow, QuestionRow, WheelConfigRow } from "@/lib/types/database";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { hasActiveSubscription } from "@/lib/subscriptions";
import {
  getAndMaybeResetUserSpins,
  getGuestSpins,
  getGuestLockUntilMs,
  getRateLimitUntilMs,
  setSpinRateLimit,
  clearSpinRateLimit,
  incrementUserSpins,
  lockGuestUntilTomorrow,
  setGuestSpins,
} from "@/lib/spins";
import { RegistrationModal } from "@/components/RegistrationModal";
import { SubscriptionModal } from "@/components/SubscriptionModal";
import { stopSpinSound } from "@/lib/sounds";
import { QuestionPopup } from "@/components/game/QuestionPopup";

export function TruthOrDareClient({
  game,
  wheel,
  questions,
  transparent = false,
}: {
  game: GameRow;
  wheel: WheelConfigRow;
  questions: QuestionRow[];
  /** When true, GameLayout renders without its own background image (parent supplies the bg). */
  transparent?: boolean;
}) {
  const t = useTranslations("game");
  const locale = useLocale();
  const wheelRef = useRef<WheelApi>(null);

  const [completedSpins, setCompletedSpins] = useState(0);
  const [current, setCurrent] = useState<Question | null>(null);
  const [spinSoundOn, setSpinSoundOn] = useState(true);
  const [players, setPlayers] = useState<string[]>([]);
  const [playerStarted, setPlayerStarted] = useState(false);
  const [playerDraft, setPlayerDraft] = useState("");

  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [regOpen, setRegOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [subLocked, setSubLocked] = useState(false);
  const [leadCaptured, setLeadCaptured] = useState(false);
  const [rateLimitMs, setRateLimitMs] = useState<number | null>(null);
  const [rateLimitSecs, setRateLimitSecs] = useState(0);
  const authWaiterRef = useRef<{
    resolve: (uid: string | null) => void;
  } | null>(null);

  const options = useMemo(() => {
    const base = (wheel.slices ?? []).map((s) => ({
      type: s.question_type as QuestionType,
      label: locale === "he" ? s.label_he : s.label_en,
      color: s.color,
    }));
    if (!game.player_mode) return base;
    if (!playerStarted || players.length === 0) return [];
    const reps = (wheel.player_config as { player_repetitions?: number } | undefined)
      ?.player_repetitions ?? 8;
    const palette = [
      "#22c55e",
      "#3b82f6",
      "#f97316",
      "#a855f7",
      "#ef4444",
      "#06b6d4",
      "#eab308",
      "#ec4899",
    ];
    const perPlayer = Math.max(1, Number(reps) || 8);
    return players.flatMap((p, i) =>
      Array.from({ length: perPlayer }, () => ({
        type: p as QuestionType,
        label: p,
        color: palette[i % palette.length],
      })),
    );
  }, [wheel.slices, wheel.player_config, locale, game.player_mode, players, playerStarted]);

  const textFor = useCallback(
    (q: Question) => (locale === "he" ? q.text_he : q.text_en),
    [locale],
  );

  // ── Rate-limit countdown ticker ────────────────────────────────────────────
  useEffect(() => {
    if (!rateLimitMs) return;
    const tick = () => {
      const remaining = Math.ceil((rateLimitMs - Date.now()) / 1000);
      if (remaining <= 0) {
        setRateLimitMs(null);
        setRateLimitSecs(0);
      } else {
        setRateLimitSecs(remaining);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [rateLimitMs]);

  const handleSpinClick = () => {
    if (!authReady) return;

    // Subscribers spin freely
    if (subscribed) {
      wheelRef.current?.spin();
      return;
    }

    // ── Guest (not logged in) ────────────────────────────────────────────────
    if (!userId) {
      const used        = getGuestSpins();
      const lockedUntil = getGuestLockUntilMs();

      // Legacy day-lock (dismissed lead gate)
      if (lockedUntil && lockedUntil > Date.now()) {
        setSubLocked(false);
        setSubOpen(true);
        return;
      }

      // After 6 spins → 10-min rate limit (not hard block)
      if (used >= 6) {
        const rl = getRateLimitUntilMs();
        if (rl) {
          setRateLimitMs(rl);
          setSubLocked(false);
          setSubOpen(true);   // show plans, but user can close
          return;
        }
        // 10 min passed — allow spin
        wheelRef.current?.spin();
        return;
      }

      // Spins 4-6: require lead capture first
      if (used >= 3) {
        const existingLead =
          typeof window !== "undefined"
            ? window.localStorage.getItem("mioshy:lead_id_v1")
            : null;
        if (!existingLead && !leadCaptured) {
          setSubLocked(false);
          setSubOpen(true);
          return;
        }
        // Lead captured — allow spin
        wheelRef.current?.spin();
        return;
      }

      // Spins 1-3: free
      wheelRef.current?.spin();
      return;
    }

    // ── Logged-in non-subscriber ─────────────────────────────────────────────
    if (completedSpins >= 6) {
      const rl = getRateLimitUntilMs();
      if (rl) {
        setRateLimitMs(rl);
        setSubLocked(false);
        setSubOpen(true);
        return;
      }
      wheelRef.current?.spin();
      return;
    }

    // Logged-in free user: first 3 spins free, then show paywall
    if (completedSpins >= 3) {
      setSubLocked(false);
      setSubOpen(true);
      return;
    }

    wheelRef.current?.spin();
  };

  const lastTwoTypesRef = useRef<string[]>([]);
  const [forbiddenType, setForbiddenType] = useState<string | null>(null);

  const levels = useMemo(() => ["light", "flirty", "deep"] as const, []);
  type Level = (typeof levels)[number];

  const cycleRef = useRef<
    Map<
      string,
      {
        levelIdx: number;
        remainingByLevel: Record<Level, string[]>;
        allByLevel: Record<Level, string[]>;
        lastId: string | null;
      }
    >
  >(new Map());

  const pickNextQuestion = useCallback(
    (category: string) => {
      const pool = (questions ?? []).filter(
        (q) => q.type === category && q.is_active,
      );
      if (pool.length === 0) return null;

      const byLevel: Record<Level, string[]> = { light: [], flirty: [], deep: [] };
      for (const q of pool) {
        const lvl = (levels.includes(q.level as Level)
          ? (q.level as Level)
          : "light") as Level;
        byLevel[lvl].push(q.id);
      }

      const existing = cycleRef.current.get(category);
      const allByLevel = existing?.allByLevel ?? byLevel;
      const remainingByLevel =
        existing?.remainingByLevel ?? {
          light: [...allByLevel.light],
          flirty: [...allByLevel.flirty],
          deep: [...allByLevel.deep],
        };
      let levelIdx = existing?.levelIdx ?? 0;
      const lastId = existing?.lastId ?? null;

      // advance levels until we find one with remaining questions
      let safety = 0;
      while (
        safety < 6 &&
        levelIdx < levels.length &&
        remainingByLevel[levels[levelIdx]].length === 0
      ) {
        levelIdx += 1;
        safety += 1;
      }

      // if all levels exhausted, reset cycle
      if (levelIdx >= levels.length) {
        remainingByLevel.light = [...allByLevel.light];
        remainingByLevel.flirty = [...allByLevel.flirty];
        remainingByLevel.deep = [...allByLevel.deep];
        levelIdx = 0;
      }

      const lvl = levels[levelIdx];
      let remaining = remainingByLevel[lvl];
      if (remaining.length === 0) {
        // nothing in this level; recurse by advancing next tick
        cycleRef.current.set(category, {
          levelIdx: levelIdx + 1,
          remainingByLevel,
          allByLevel,
          lastId,
        });
        return pickNextQuestion(category);
      }

      // avoid immediate repeat when possible
      let candidates = remaining;
      if (lastId && remaining.length > 1) {
        const filtered = remaining.filter((id) => id !== lastId);
        if (filtered.length) candidates = filtered;
      }

      const chosenId =
        candidates[Math.floor(Math.random() * candidates.length)];
      remaining = remaining.filter((id) => id !== chosenId);
      remainingByLevel[lvl] = remaining;

      cycleRef.current.set(category, {
        levelIdx,
        remainingByLevel,
        allByLevel,
        lastId: chosenId,
      });

      const row = pool.find((q) => q.id === chosenId)!;
      return {
        id: row.id,
        type: row.type as QuestionType,
        text_he: row.text_he,
        text_en: row.text_en,
      } satisfies Question;
    },
    [questions, levels],
  );

  const handleSettled = useCallback(
    ({ type }: { index: number; type: QuestionType }) => {
      const actualType = String(type);
      lastTwoTypesRef.current = [...lastTwoTypesRef.current.slice(-1), actualType];
      if (
        lastTwoTypesRef.current.length === 2 &&
        lastTwoTypesRef.current[0] === lastTwoTypesRef.current[1]
      ) {
        setForbiddenType(lastTwoTypesRef.current[0]);
      } else {
        setForbiddenType(null);
      }

      // Show question matching the slice where the wheel stopped.
      const category = game.player_mode ? "custom" : actualType;
      const q = pickNextQuestion(category) ?? pickNextQuestion(actualType);
      if (!q) return;
      setCurrent(q);
      setCompletedSpins((c) => c + 1);

      // Persist spins
      if (!subscribed) {
        if (!userId) {
          const next = getGuestSpins() + 1;
          setGuestSpins(next);
          if (next >= 6) {
            // Set 10-min rate limit after 6th spin
            setSpinRateLimit();
            setRateLimitMs(getRateLimitUntilMs());
            setSubLocked(false);
            setSubOpen(true);   // show plans, but user can close
          } else if (next >= 3) {
            const existingLead =
              typeof window !== "undefined"
                ? window.localStorage.getItem("mioshy:lead_id_v1")
                : null;
            if (!existingLead && !leadCaptured) {
              setSubLocked(false);
              setSubOpen(true);
            }
          }
        } else {
          const nextSpins = completedSpins + 1;
          void incrementUserSpins(createBrowserSupabaseClient(), userId, nextSpins);
          if (nextSpins >= 6) {
            setSpinRateLimit();
            setRateLimitMs(getRateLimitUntilMs());
            setSubLocked(false);
            setSubOpen(true);
          } else if (nextSpins >= 3) {
            setSubLocked(false);
            setSubOpen(true);
          }
        }
      }
    },
    [completedSpins, game.player_mode, pickNextQuestion, subscribed, userId, leadCaptured],
  );

  const handleNext = () => setCurrent(null);

  // Stop sound whenever a question is revealed (spin ended → card shows)
  useEffect(() => {
    if (current) stopSpinSound();
  }, [current]);

  // Stop sound on unmount (user navigates away mid-spin)
  useEffect(() => {
    return () => { stopSpinSound(); };
  }, []);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      const uid = user?.id ?? null;
      setUserId(uid);
      if (uid) {
        const active = await hasActiveSubscription(supabase, uid);
        if (!cancelled) setSubscribed(active);
        const spins = await getAndMaybeResetUserSpins(supabase, uid);
        if (!cancelled) setCompletedSpins(spins.spins_used ?? 0);
      } else {
        setCompletedSpins(getGuestSpins());
      }
      setAuthReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <GameLayout
      title={(locale === "he" ? game.name_he : game.name_en) || t("pageTitle")}
      backgroundSrc={transparent ? false : undefined}
      showVignette={!transparent}
    >
      <div className="flex min-h-0 w-full max-w-lg flex-1 flex-col items-center gap-6 px-2 sm:px-0">
        <div className="flex w-full shrink-0 items-center justify-between gap-2 px-1">
          <Link
            href="/products"
            className="rounded-full bg-white/15 px-4 py-2 text-sm font-medium text-white backdrop-blur hover:bg-white/25"
          >
            {t("back")}
          </Link>
          <button
            type="button"
            onClick={() => setSpinSoundOn((m) => !m)}
            className="rounded-full bg-white/15 px-4 py-2 text-xs font-medium text-white backdrop-blur hover:bg-white/25"
          >
            {spinSoundOn ? t("spinSoundOn") : t("spinSoundOff")}
          </button>
        </div>

        {game.player_mode && !playerStarted ? (
          <div className="w-full max-w-md rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur">
            <p className="text-sm font-semibold text-white">Enter player names</p>
            <p className="mt-1 text-xs text-white/70">Add at least 2 players.</p>
            <div className="mt-3 flex gap-2">
              <input
                value={playerDraft}
                onChange={(e) => setPlayerDraft(e.target.value)}
                className="w-full rounded-2xl border border-white/20 bg-black/20 px-4 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/40"
                placeholder="Name"
              />
              <button
                type="button"
                className="min-h-[44px] rounded-2xl bg-white/15 px-4 text-sm font-semibold text-white"
                onClick={() => {
                  const n = playerDraft.trim();
                  if (!n) return;
                  setPlayers((p) => [...p, n]);
                  setPlayerDraft("");
                }}
              >
                Add
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {players.map((p) => (
                <span key={p} className="rounded-full bg-white/10 px-3 py-1 text-xs text-white">
                  {p}
                </span>
              ))}
            </div>
            <button
              type="button"
              disabled={players.length < 2}
              className="mt-4 min-h-[44px] w-full rounded-full bg-gradient-to-r from-fuchsia-500 to-rose-500 px-6 py-3 text-base font-semibold text-white disabled:opacity-50"
              onClick={() => setPlayerStarted(true)}
            >
              Start
            </button>
          </div>
        ) : (
          <Wheel
            ref={wheelRef}
            options={options}
            onSettled={handleSettled}
            disabled={!authReady || !!rateLimitMs}
            isSpinSoundEnabled={spinSoundOn}
            pointerColor={wheel.pointer_color}
            borderColor={wheel.border_color}
            innerCircle={wheel.inner_circle}
            innerCircleColor={wheel.inner_circle_color}
            innerCircleBorderColor={wheel.inner_circle_border_color}
            dividerColor={wheel.divider_color}
            dividerEnabled={wheel.divider_enabled ?? wheel.show_divider ?? true}
            dividerWidth={wheel.divider_width ?? 2}
            markerConfig={wheel.marker_config ?? {}}
            forbiddenType={forbiddenType}
            wheelSizeRem={
              typeof (wheel.marker_config as Record<string, unknown>)?.wheel_size_rem === "number"
                ? (wheel.marker_config as Record<string, number>).wheel_size_rem
                : 22
            }
            labelRadiusFraction={
              typeof (wheel.marker_config as Record<string, unknown>)?.label_radius_fraction === "number"
                ? (wheel.marker_config as Record<string, number>).label_radius_fraction
                : 0.72
            }
          />
        )}

        <div className="w-full max-w-md space-y-3">
          <button
            type="button"
            onClick={handleSpinClick}
            disabled={!authReady || !!current}
            className="min-h-[44px] w-full rounded-full bg-gradient-to-r from-fuchsia-500 to-rose-500 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-fuchsia-900/40 transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:text-lg"
            style={{ fontFamily: "var(--font-heading-hebrew), var(--font-heading-latin), system-ui" }}
          >
            {rateLimitMs
              ? `${Math.floor(rateLimitSecs / 60)}:${String(rateLimitSecs % 60).padStart(2, "0")}`
              : t("spin")}
          </button>
          {rateLimitMs && !subOpen && (
            <p className="text-center text-xs text-white/60">
              {locale === "he"
                ? "הסיבוב הבא יהיה זמין בעוד כמה דקות — או שדרג למנוי ללא הגבלה"
                : "Next spin available soon — or subscribe for unlimited play"}
            </p>
          )}
        </div>
      </div>

      {/* ── Question popup — rendered fixed over everything ── */}
      {(() => {
        const sliceColor =
          options.find((o) => o.type === current?.type)?.color ??
          (wheel.category_colors as Record<string, string> | undefined)?.[current?.type ?? ""] ??
          "#c084fc";
        const categoryLabel =
          options.find((o) => o.type === current?.type)?.label ??
          current?.type ??
          "";
        return (
          <QuestionPopup
            question={
              current
                ? {
                    type: current.type,
                    text: textFor(current),
                    categoryLabel,
                    accentColor: sliceColor,
                  }
                : null
            }
            onClose={handleNext}
            labelSpinAgain={t("spinAgain")}
            labelClose={t("closePopup")}
            isRtl={locale === "he"}
          />
        );
      })()}

      <RegistrationModal
        open={regOpen}
        onOpenChange={(v) => setRegOpen(v)}
        onSuccess={async () => {
          const supabase = createBrowserSupabaseClient();
          const {
            data: { user },
          } = await supabase.auth.getUser();
          const uid = user?.id ?? null;
          setUserId(uid);
          if (uid) {
            const spins = await getAndMaybeResetUserSpins(supabase, uid);
            setCompletedSpins(spins.spins_used ?? 0);
          }
          authWaiterRef.current?.resolve(uid);
          authWaiterRef.current = null;
          setRegOpen(false);
        }}
      />

      <SubscriptionModal
        open={subOpen}
        onOpenChange={(v) => {
          setSubOpen(v);
          if (!v) {
            // If user didn't provide lead details at the lead-gate, lock them until tomorrow.
            if (!userId && getGuestSpins() >= 3 && getGuestSpins() < 6) {
              const existingLead =
                typeof window !== "undefined"
                  ? window.localStorage.getItem("mioshy:lead_id_v1")
                  : null;
              if (!existingLead && !leadCaptured) {
                lockGuestUntilTomorrow();
              }
            }
            // If they dismissed paywall at >=6 spins, keep it locked.
            if (getGuestSpins() >= 6) setSubLocked(true);
          }
        }}
        locked={subLocked}
        userId={userId}
        onRequireAuth={async () => {
          if (userId) return userId;
          setRegOpen(true);
          return await new Promise<string | null>((resolve) => {
            authWaiterRef.current = { resolve };
          });
        }}
        onSubscribed={() => {
          setSubscribed(true);
          setSubLocked(false);
          setSubOpen(false);
          setRateLimitMs(null);
          clearSpinRateLimit();
        }}
        mode={userId || getGuestSpins() >= 6 ? "paywall" : "lead"}
        onLeadSaved={(_, newUserId) => {
          setLeadCaptured(true);
          setSubOpen(false);
          // If registration created a new user, promote to logged-in state
          if (newUserId && !userId) {
            setUserId(newUserId);
            // Carry over guest spins (3) to the new account
            void incrementUserSpins(createBrowserSupabaseClient(), newUserId, 3);
            setCompletedSpins(3);
          }
        }}
      />
    </GameLayout>
  );
}
