"use client";

import { motion } from "framer-motion";
import { useLocale } from "next-intl";
import { cn } from "@/lib/utils";
import { CmsText } from "@/components/cms/CmsText";

export type GameType = "wheel" | "snakes";

export function GameTypeSelector({
  value,
  onChange,
}: {
  value: GameType | null;
  onChange: (v: GameType) => void;
}) {
  // useLocale() kept available for future locale-conditional UX (e.g.,
  // sort order, direction) — strings themselves come from CMS via
  // gameTypeSelector.* keys.
  void useLocale();

  const Card = ({
    type,
    titleKey,
    descKey,
    badgeKey,
    accent,
    icon,
  }: {
    type: GameType;
    titleKey: string;
    descKey: string;
    badgeKey: string;
    accent: "purple" | "cyan";
    icon: string;
  }) => {
    const active = value === type;
    const ring =
      accent === "purple"
        ? "hover:border-purple-400/50 hover:shadow-[0_0_0_1px_rgba(192,132,252,0.35),0_0_30px_rgba(192,132,252,0.12)]"
        : "hover:border-cyan-300/50 hover:shadow-[0_0_0_1px_rgba(96,165,250,0.35),0_0_30px_rgba(96,165,250,0.12)]";
    const activeRing =
      accent === "purple"
        ? "border-purple-400/60 shadow-[0_0_0_1px_rgba(192,132,252,0.35),0_0_40px_rgba(192,132,252,0.16)]"
        : "border-cyan-300/60 shadow-[0_0_0_1px_rgba(96,165,250,0.35),0_0_40px_rgba(96,165,250,0.16)]";

    return (
      <motion.button
        type="button"
        onClick={() => onChange(type)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.99 }}
        className={cn(
          "text-start rounded-3xl border bg-[rgba(15,23,42,0.65)] p-6 backdrop-blur-md transition",
          "border-slate-700/60 hover:bg-[rgba(15,23,42,0.8)]",
          ring,
          active && activeRing,
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{icon}</span>
            <div>
              <CmsText
                cmsKey={titleKey}
                as="div"
                className="text-lg font-bold text-slate-100"
              />
              <CmsText
                cmsKey={descKey}
                as="div"
                className="mt-1 text-sm text-slate-300"
              />
            </div>
          </div>
          <CmsText
            cmsKey={badgeKey}
            className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200"
          />
        </div>
      </motion.button>
    );
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card
        type="wheel"
        icon="🎡"
        titleKey="gameTypeSelector.wheelTitle"
        descKey="gameTypeSelector.wheelDesc"
        badgeKey="gameTypeSelector.wheelBadge"
        accent="purple"
      />
      <Card
        type="snakes"
        icon="🐍🌈"
        titleKey="gameTypeSelector.snakesTitle"
        descKey="gameTypeSelector.snakesDesc"
        badgeKey="gameTypeSelector.snakesBadge"
        accent="cyan"
      />
    </div>
  );
}
