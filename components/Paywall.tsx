"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Link } from "@/navigation";

export function Paywall() {
  const t = useTranslations("paywall");

  // 2026-05-22 — pricing simplified to weekly-only.
  // The single/yearly tiers were removed alongside monthly; the page
  // now surfaces just the active "weekly" tier (9 ₪/week games or
  // 57 ₪/week journey depending on the surface that links here).
  const plans = [
    {
      key: "weekly",
      price: t("weeklyPrice"),
      title: t("weekly"),
      desc: t("weeklyDesc"),
      highlight: true,
    },
  ];

  return (
    <div className="mx-auto grid w-full max-w-md gap-4 px-4 py-8">
      {plans.map((p, i) => (
        <motion.div
          key={p.key}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}
          className={`flex flex-col rounded-3xl border p-6 shadow-xl backdrop-blur ${
            p.highlight
              ? "border-fuchsia-400/60 bg-fuchsia-500/20 ring-2 ring-fuchsia-300/40"
              : "border-white/15 bg-white/10"
          }`}
        >
          <h3 className="text-lg font-semibold text-white">{p.title}</h3>
          <p className="mt-2 flex items-baseline gap-1">
            <span className="text-3xl font-bold text-white">{p.price}</span>
          </p>
          <p className="mt-3 flex-1 text-sm text-white/80">{p.desc}</p>
          <button
            type="button"
            disabled
            className="mt-6 w-full rounded-2xl bg-white/90 py-3 text-sm font-semibold text-fuchsia-900 opacity-90"
          >
            {t("cta")}
          </button>
        </motion.div>
      ))}
      <p className="text-center text-sm text-white/70">
        {t("placeholder")}
      </p>
      <div className="text-center">
        <Link
          href="/games"
          className="text-sm font-medium text-white underline-offset-4 hover:underline"
        >
          {t("back")}
        </Link>
      </div>
    </div>
  );
}
