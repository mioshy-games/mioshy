"use client";

import { motion } from "framer-motion";
import type { QuestionType } from "@/lib/game-engine";

type QuestionCardProps = {
  type: QuestionType;
  text: string;
  labelTruth: string;
  labelDare: string;
};

export function QuestionCard({
  type,
  text,
  labelTruth,
  labelDare,
}: QuestionCardProps) {
  const isTruth = type === "truth";
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      className="mx-auto w-full max-w-md rounded-3xl border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-md"
    >
      <p
        className={`mb-3 text-center text-xs font-semibold uppercase tracking-widest ${
          isTruth ? "text-cyan-200" : "text-fuchsia-200"
        }`}
      >
        {isTruth ? labelTruth : labelDare}
      </p>
      <p className="text-center text-lg font-medium leading-relaxed text-white sm:text-xl">
        {text}
      </p>
    </motion.div>
  );
}
