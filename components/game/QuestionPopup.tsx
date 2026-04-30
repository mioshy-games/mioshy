"use client";

import { motion, AnimatePresence } from "framer-motion";
import { RotateCw, Sparkles, X } from "lucide-react";
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
  hidden:  { opacity: 0, scale: 0.9, y: 24 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 320, damping: 28, mass: 0.9 },
  },
  exit: {
    opacity: 0,
    scale: 0.94,
    y: 16,
    transition: { duration: 0.22, ease: "easeIn" as const },
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * QuestionPopup - same visual language as the marketing /games hero
 * "live taste" card: warm cream surface, bold serif-italic question
 * text, accent badge, and a gradient "Spin again" CTA. Backdrop stays
 * a dark blurred overlay so the card pops off any game background.
 *
 * Typography:
 *   • Category label  - Heebo / system uppercase, accent color
 *   • Question        - Frank Ruhl Libre 700 italic, ink color
 *   • CTA             - gradient (accent → accent-deep), white text
 */
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
          style={{
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            background: "rgba(14,8,16,0.72)",
          }}
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
            className="relative w-full max-w-[520px] overflow-hidden rounded-[24px] border border-[#E9C4CA]/40 bg-[#FBF5F2] p-6 text-[#170E14] shadow-[0_32px_80px_rgba(14,8,16,0.55)] sm:p-8"
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}  // don't close when clicking card
          >

            {/* ── Accent ribbon at top - uses slice color ──────────────── */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-1.5"
              style={{ background: question.accentColor }}
            />

            {/* ── Close (X) - matches hero popup ────────────────────── */}
            <button
              type="button"
              onClick={onClose}
              aria-label={labelClose}
              className="absolute end-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#EAE0E3] bg-[#FBF5F2] text-[#4A3A45] transition hover:border-[#B83C4D]/40 hover:bg-[#FBE9EC] hover:text-[#B83C4D]"
            >
              <X size={16} strokeWidth={2.5} />
            </button>

            {/* ── Header row: category badge + small "live" tag ─────── */}
            <div className="flex items-center gap-3 pe-12">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white"
                style={{ background: question.accentColor }}
              >
                <Sparkles className="h-3 w-3" />
                {question.categoryLabel}
              </span>
            </div>

            {/* ── Question text - bold serif italic ─────────────────── */}
            <p
              className="mt-5 text-[24px] leading-[1.35] text-[#170E14] sm:text-[28px]"
              style={{
                fontFamily: "'Frank Ruhl Libre', serif",
                fontStyle: "italic",
                fontWeight: 700,
              }}
            >
              {question.text}
            </p>

            {/* Decorative hairline */}
            <div className="mx-auto my-6 h-px w-16 rounded-full bg-[#B83C4D]/30" />

            {/* ── Spin-again CTA - wine gradient, white text ─────────── */}
            <motion.button
              type="button"
              onClick={onClose}
              whileHover={{ filter: "brightness(1.08)" }}
              whileTap={{ scale: 0.98 }}
              className="group inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-full px-6 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-[#B83C4D]/30"
              style={{
                background:
                  "linear-gradient(110deg,#B83C4D 0%,#8B2638 55%,#3D1F3D 100%)",
              }}
            >
              <RotateCw className="h-4 w-4 transition duration-500 group-hover:rotate-180" />
              <span>{labelSpinAgain}</span>
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
