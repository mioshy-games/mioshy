"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function PlayerToken({
  avatar,
  color,
  size = "sm",
  className,
}: {
  avatar: string;
  color: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const s = size === "md" ? "h-8 w-8 text-base" : "h-6 w-6 text-sm";
  return (
    <motion.div
      layout
      transition={{ type: "spring", stiffness: 500, damping: 35 }}
      className={cn(
        "inline-flex items-center justify-center rounded-full border text-white shadow-sm",
        "bg-[rgba(2,6,23,0.55)] backdrop-blur",
        s,
        className,
      )}
      style={{ borderColor: `${color}88` }}
      title={avatar}
    >
      <span aria-hidden>{avatar}</span>
    </motion.div>
  );
}

