"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PopupQuestion = {
  type: string;
  text: string;
  categoryLabel: string;  // localised slice label (e.g. "🧊 שוברי קרח")
  accentColor: string;    // hex from the wheel slice colour
};

type QuestionPopupProps = {
  question: PopupQuestion | null;
  onClose: () => void;
  /** "סיבוב נוסף" / "Spin again" */
  labelSpinAgain: string;
  /** "סגור" / "Close" */
  labelClose: string;
  isRtl?: boolean;
};

// ─── Animations ───────────────────────────────────────────────────────────────

const backdropVariants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1 },
  exit:    { opacity: 0 },
};

const cardVariants = {
  hidden:  { opacity: 0, scale: 0.82, y: 40 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 320, damping: 26, mass: 0.9 },
  },
  exit: {
    opacity: 0,
    scale: 0.88,
    y: 24,
    transition: { duration: 0.22, ease: "easeIn" as const },
  },
};

const textVariants = {
  hidden:  { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { delay: 0.12, duration: 0.35, ease: "easeOut" as const },
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function QuestionPopup({
  question,
  onClose,
  labelSpinAgain,
  labelClose,
  isRtl = false,
}: QuestionPopupProps) {
  // Close on Escape key
  useEffect(() => {
    if (!question) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [question, onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    if (question) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [question]);

  return (
    <AnimatePresence>
      {question && (
        // ── Backdrop ──────────────────────────────────────────────────────
        <motion.div
          key="popup-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", background: "rgba(0,0,0,0.72)" }}
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={{ duration: 0.25 }}
          onClick={onClose}           // tap outside to close
        >
          {/* ── Card ──────────────────────────────────────────────────────── */}
          <motion.div
            key="popup-card"
            role="dialog"
            aria-modal="true"
            dir={isRtl ? "rtl" : "ltr"}
            className="relative w-full max-w-[480px] overflow-hidden rounded-[2rem] shadow-[0_32px_80px_rgba(0,0,0,0.6)]"
            style={{
              background: "linear-gradient(160deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.05) 100%)",
              border: "1px solid rgba(255,255,255,0.14)",
            }}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}  // don't close when clicking card
          >

            {/* ── Accent bar + glow ─────────────────────────────────────── */}
            <div
              className="absolute inset-x-0 top-0 h-1.5 rounded-t-[2rem]"
              style={{ background: question.accentColor }}
            />
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-48 opacity-20"
              style={{
                background: `radial-gradient(ellipse at 50% 0%, ${question.accentColor} 0%, transparent 70%)`,
              }}
            />

            {/* ── Close button ──────────────────────────────────────────── */}
            <button
              type="button"
              onClick={onClose}
              aria-label={labelClose}
              className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/70 transition hover:bg-white/20 hover:text-white active:scale-95"
              style={isRtl ? { right: "auto", left: "1rem" } : {}}
            >
              <X size={18} strokeWidth={2.5} />
            </button>

            {/* ── Content ───────────────────────────────────────────────── */}
            <div className="px-7 pb-8 pt-10">

              {/* Category label — Assistant font, small caps feel */}
              <motion.p
                variants={textVariants}
                initial="hidden"
                animate="visible"
                className="mb-5 text-center text-sm font-semibold uppercase tracking-[0.18em]"
                style={{
                  fontFamily: "var(--font-body-hebrew), var(--font-body-latin), system-ui",
                  color: question.accentColor,
                  textShadow: `0 0 20px ${question.accentColor}80`,
                }}
              >
                {question.categoryLabel}
              </motion.p>

              {/* Question text — IBM Plex Sans Hebrew, large + bold */}
              <motion.p
                variants={textVariants}
                initial="hidden"
                animate="visible"
                className="text-center font-heading text-[1.45rem] font-bold leading-snug text-white sm:text-[1.7rem]"
                style={{
                  fontFamily: "var(--font-heading-hebrew), var(--font-heading-latin), system-ui",
                  textShadow: "0 2px 20px rgba(0,0,0,0.4)",
                  lineHeight: 1.45,
                }}
              >
                {question.text}
              </motion.p>

              {/* Decorative divider */}
              <div className="mx-auto my-7 h-px w-16 rounded-full bg-white/15" />

              {/* Spin-again button */}
              <motion.button
                type="button"
                onClick={onClose}
                whileHover={{ scale: 1.03, filter: "brightness(1.1)" }}
                whileTap={{ scale: 0.97 }}
                className="w-full rounded-2xl py-4 text-base font-bold text-white shadow-lg transition-all sm:text-lg"
                style={{
                  fontFamily: "var(--font-heading-hebrew), var(--font-heading-latin), system-ui",
                  background: `linear-gradient(135deg, ${question.accentColor}cc 0%, ${question.accentColor}88 100%)`,
                  boxShadow: `0 8px 32px ${question.accentColor}44`,
                  border: `1px solid ${question.accentColor}55`,
                }}
              >
                {labelSpinAgain}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
