"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/navigation";
import { GameLayout } from "./GameLayout";
import { QuestionCard } from "./QuestionCard";
import { Wheel, type WheelApi } from "./Wheel";
import {
  pickRandomQuestion,
  shouldBlockSpin,
  type Question,
} from "@/lib/game-engine";
import { MOCK_QUESTIONS } from "@/lib/mock-data";

export function TruthOrDareClient() {
  const t = useTranslations("game");
  const locale = useLocale();
  const router = useRouter();
  const wheelRef = useRef<WheelApi>(null);

  const [completedSpins, setCompletedSpins] = useState(0);
  const [current, setCurrent] = useState<Question | null>(null);
  const [spinSoundOn, setSpinSoundOn] = useState(true);

  const options = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => ({
        type: i % 2 === 0 ? ("truth" as const) : ("dare" as const),
        label: i % 2 === 0 ? t("truth") : t("dare"),
      })),
    [t],
  );

  const textFor = useCallback(
    (q: Question) => (locale === "he" ? q.text_he : q.text_en),
    [locale],
  );

  const handleSpinClick = () => {
    if (shouldBlockSpin(completedSpins)) {
      router.push("/paywall");
      return;
    }
    wheelRef.current?.spin();
  };

  const handleSettled = useCallback(
    ({ type }: { index: number; type: "truth" | "dare" }) => {
      const q = pickRandomQuestion(type, MOCK_QUESTIONS);
      setCurrent(q);
      setCompletedSpins((c) => c + 1);
    },
    [],
  );

  const handleNext = () => {
    if (shouldBlockSpin(completedSpins)) {
      router.push("/paywall");
      return;
    }
    setCurrent(null);
  };

  return (
    <GameLayout title={t("pageTitle")}>
      <div className="flex min-h-0 w-full max-w-lg flex-1 flex-col items-center gap-6">
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

        {!current ? (
          <>
            <Wheel
              ref={wheelRef}
              options={options}
              onSettled={handleSettled}
              disabled={shouldBlockSpin(completedSpins)}
              isSpinSoundEnabled={spinSoundOn}
            />

            <button
              type="button"
              onClick={handleSpinClick}
              disabled={shouldBlockSpin(completedSpins)}
              className="rounded-full bg-gradient-to-r from-fuchsia-500 to-rose-500 px-10 py-4 text-lg font-semibold text-white shadow-lg shadow-fuchsia-900/40 transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("spin")}
            </button>
          </>
        ) : (
          <div className="flex w-full flex-1 flex-col items-center justify-center gap-6">
            <QuestionCard
              type={current.type}
              text={textFor(current)}
              labelTruth={t("resultTruth")}
              labelDare={t("resultDare")}
            />
            <button
              type="button"
              onClick={handleNext}
              className="w-full max-w-md rounded-2xl border border-white/25 bg-white/10 py-3 text-sm font-semibold text-white backdrop-blur hover:bg-white/20"
            >
              {t("next")}
            </button>
          </div>
        )}
      </div>
    </GameLayout>
  );
}
