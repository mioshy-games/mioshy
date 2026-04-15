"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Question } from "@/lib/game-engine";

export type DashboardQuestion = Question;

export function DashboardClient({ questions }: { questions: DashboardQuestion[] }) {
  const t = useTranslations("dashboard");
  const locale = useLocale();

  const textFor = useMemo(
    () => (q: Question) => (locale === "he" ? q.text_he : q.text_en),
    [locale],
  );

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <section>
        <h2 className="text-lg font-semibold text-white">{t("listTitle")}</h2>
        <ul className="mt-4 space-y-2">
          {questions.length === 0 ? (
            <li className="text-white/60">{t("empty")}</li>
          ) : (
            questions.map((q) => (
              <li
                key={q.id}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/90"
              >
                <span className="font-semibold text-fuchsia-200">
                  {t("type")}: {q.type}
                </span>
                <p className="mt-1">{textFor(q)}</p>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
