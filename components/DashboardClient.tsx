"use client";

import { FormEvent, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Question } from "@/lib/game-engine";
import { MOCK_QUESTIONS } from "@/lib/mock-data";

export function DashboardClient() {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const [items, setItems] = useState<Question[]>(() => [...MOCK_QUESTIONS]);
  const [he, setHe] = useState("");
  const [en, setEn] = useState("");

  const textFor = useMemo(
    () => (q: Question) => (locale === "he" ? q.text_he : q.text_en),
    [locale],
  );

  function add(type: "truth" | "dare") {
    if (!he.trim() && !en.trim()) return;
    const id = `local-${Date.now()}`;
    setItems((prev) => [
      ...prev,
      {
        id,
        type,
        text_he: he.trim() || en.trim(),
        text_en: en.trim() || he.trim(),
      },
    ]);
    setHe("");
    setEn("");
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <p className="text-center text-sm text-white/60">{t("note")}</p>

      <section>
        <h2 className="text-lg font-semibold text-white">{t("listTitle")}</h2>
        <ul className="mt-4 space-y-2">
          {items.length === 0 ? (
            <li className="text-white/60">{t("empty")}</li>
          ) : (
            items.map((q) => (
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

      <section>
        <h2 className="text-lg font-semibold text-white">{t("addTitle")}</h2>
        <form onSubmit={onSubmit} className="mt-4 space-y-2">
          <textarea
            value={he}
            onChange={(e) => setHe(e.target.value)}
            placeholder={t("questionHe")}
            rows={2}
            className="w-full rounded-2xl border border-white/15 bg-black/20 px-4 py-3 text-white placeholder:text-white/40 focus:border-fuchsia-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/40"
          />
          <textarea
            value={en}
            onChange={(e) => setEn(e.target.value)}
            placeholder={t("questionEn")}
            rows={2}
            className="w-full rounded-2xl border border-white/15 bg-black/20 px-4 py-3 text-white placeholder:text-white/40 focus:border-fuchsia-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/40"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => add("truth")}
              className="rounded-full bg-cyan-500/80 px-5 py-2 text-sm font-semibold text-white"
            >
              {t("addTruth")}
            </button>
            <button
              type="button"
              onClick={() => add("dare")}
              className="rounded-full bg-fuchsia-600/80 px-5 py-2 text-sm font-semibold text-white"
            >
              {t("addDare")}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
