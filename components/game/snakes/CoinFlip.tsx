"use client";

import { motion } from "framer-motion";
import type { CoinResult } from "@/lib/snakes/types";
import { cn } from "@/lib/utils";
import { useCmsText } from "@/hooks/useCmsText";
import { CmsText } from "@/components/cms/CmsText";

export function CoinFlip({
  onFlip,
  disabled,
  result,
  playerColor,
}: {
  onFlip: () => void;
  disabled?: boolean;
  result: CoinResult | null;
  playerColor: string;
}) {
  // Raw-string slot for aria-label (HTML attribute), so we use useCmsText
  // directly for the result/idle label; JSX children below render via <CmsText>.
  const heads = useCmsText("snakesGame.coinFlip.heads").text;
  const tails = useCmsText("snakesGame.coinFlip.tails").text;
  const flipLabel = useCmsText("snakesGame.coinFlip.flipLabel").text;
  const ariaLabel =
    result === "heads" ? heads : result === "tails" ? tails : flipLabel;

  return (
    <div className="flex flex-col items-center gap-3">
      <motion.button
        type="button"
        disabled={disabled}
        onClick={onFlip}
        whileHover={disabled ? undefined : { scale: 1.02 }}
        whileTap={disabled ? undefined : { scale: 0.98 }}
        className={cn(
          "relative flex h-20 w-20 items-center justify-center rounded-full border",
          "bg-[rgba(15,23,42,0.55)] backdrop-blur",
          "disabled:opacity-50 disabled:cursor-not-allowed",
        )}
        style={{ borderColor: `${playerColor}88` }}
        aria-label={ariaLabel}
      >
        <motion.div
          key={result ?? "idle"}
          initial={{ rotateY: 0 }}
          animate={{ rotateY: result ? 720 : 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          className="text-3xl"
        >
          🪙
        </motion.div>
      </motion.button>
      <div className="text-sm font-semibold text-slate-200">{ariaLabel}</div>
      <CmsText
        cmsKey={
          result === "heads"
            ? "snakesGame.coinFlip.headsRule"
            : result === "tails"
              ? "snakesGame.coinFlip.tailsRule"
              : "snakesGame.coinFlip.turnHint"
        }
        as="div"
        className="text-xs text-slate-300/80"
      />
    </div>
  );
}
