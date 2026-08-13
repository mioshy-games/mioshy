"use client";

/**
 * The article's one conversion point.
 *
 * The mockup pointed at the absolute https://mioshy.com/he/survey; here it is
 * an internal `next/link` so the click is a client-side navigation and does not
 * leave and re-enter the site. Emits `research_cta_click`.
 */

import Link from "next/link";
import { track } from "@/lib/analytics";
import styles from "./research.module.css";

export function ResearchCta({ locale }: { locale: string }) {
  return (
    <Link
      href={`/${locale}/survey`}
      className={styles.ctabtn}
      onClick={() => track("research_cta_click")}
    >
      לאבחון הזוגי · חינם
    </Link>
  );
}
