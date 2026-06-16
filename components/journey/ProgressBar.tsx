"use client";

import { motion } from "framer-motion";

interface ProgressBarProps {
  current: number;
  total: number;
  lockedAt?: number; // optional: marker showing where paywall/auth locks are
}

export function ProgressBar({ current, total, lockedAt }: ProgressBarProps) {
  const pct = Math.min(100, Math.round((current / total) * 100));
  const lockPct = lockedAt !== undefined ? Math.round((lockedAt / total) * 100) : null;

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between text-sm text-white/80">
        <span>{current} / {total}</span>
        <span>{pct}%</span>
      </div>
      {/* a11y (M10): expose progress to assistive tech. */}
      <div
        className="relative h-2 w-full overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuetext={`${current} / ${total}`}
      >
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-fuchsia-400 to-pink-300"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4 }}
        />
        {lockPct !== null ? (
          <div
            className="absolute inset-y-0 w-px bg-white/40"
            style={{ left: `${lockPct}%` }}
            aria-hidden
          />
        ) : null}
      </div>
    </div>
  );
}
