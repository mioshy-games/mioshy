"use client";

/**
 * Share row for /he/research.
 *
 * Client-side because of the clipboard button and because each control emits
 * `research_share_click` with the channel it represents — the same shape as
 * `partner_invite_shared` in components/between-us/PartnerShareCard.tsx.
 *
 * Share targets are built from SHARE_URL rather than `window.location` so a
 * preview deploy still shares the production URL. The mockup hardcoded the same
 * absolute address in every href; keeping one constant means the five links
 * cannot drift apart.
 */

import { useCallback, useState } from "react";
import { track } from "@/lib/analytics";
import styles from "./research.module.css";

const SHARE_URL = "https://mioshy.com/he/research";
const SHARE_TITLE = "מחקר הזוגיות הישראלי 2026";

const WHATSAPP_HREF = `https://wa.me/?text=${encodeURIComponent(
  `${SHARE_TITLE} | ${SHARE_URL}`,
)}`;
const MAIL_HREF = `mailto:?subject=${encodeURIComponent(
  SHARE_TITLE,
)}&body=${encodeURIComponent(`שווה קריאה: ${SHARE_URL}`)}`;
const FACEBOOK_HREF = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
  SHARE_URL,
)}`;
const LINKEDIN_HREF = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
  SHARE_URL,
)}`;

export function ShareRow() {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    track("research_share_click", { channel: "copy" });
    try {
      await navigator.clipboard.writeText(SHARE_URL);
      setCopied(true);
    } catch {
      // Clipboard can be unavailable (insecure context, denied permission).
      // The label stays unchanged rather than claiming a copy that never
      // happened.
    }
  }, []);

  return (
    <div className={styles.sbtns}>
      <a
        className={`${styles.sbtn} ${styles.sbtnWa}`}
        href={WHATSAPP_HREF}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track("research_share_click", { channel: "whatsapp" })}
      >
        ואטסאפ
      </a>
      <a
        className={styles.sbtn}
        href={MAIL_HREF}
        onClick={() => track("research_share_click", { channel: "mail" })}
      >
        מייל
      </a>
      <a
        className={styles.sbtn}
        href={FACEBOOK_HREF}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track("research_share_click", { channel: "facebook" })}
      >
        פייסבוק
      </a>
      <a
        className={styles.sbtn}
        href={LINKEDIN_HREF}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track("research_share_click", { channel: "linkedin" })}
      >
        לינקדאין
      </a>
      <button type="button" className={styles.sbtn} onClick={handleCopy}>
        {copied ? "הועתק ✓" : "העתקת קישור"}
      </button>
    </div>
  );
}
