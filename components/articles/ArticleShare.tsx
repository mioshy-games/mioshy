"use client";

import { useState } from "react";

/**
 * ArticleShare — share row for article pages. WhatsApp is FIRST (the primary
 * Israeli channel), then Facebook, then copy-link. Labels are passed in from
 * the server so the surface stays locale-correct without a client i18n bundle.
 */
export function ArticleShare({
  url,
  title,
  labels,
}: {
  url: string;
  title: string;
  labels: {
    share: string;
    whatsapp: string;
    facebook: string;
    copy: string;
    copied: string;
  };
}) {
  const [copied, setCopied] = useState(false);

  const waHref = `https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`;
  const fbHref = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure context / permissions) — no-op.
    }
  }

  const btn =
    "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-gray-500">{labels.share}</span>

      <a
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
        className={`${btn} bg-[#25D366] text-white hover:bg-[#1ebe5b]`}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
          <path d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.32 4.95L2 22l5.3-1.38a9.9 9.9 0 0 0 4.73 1.2h.01c5.46 0 9.9-4.44 9.9-9.9S17.5 2 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.14.82.84-3.06-.2-.31a8.24 8.24 0 0 1 12.8-10.2 8.2 8.2 0 0 1 2.42 5.83c0 4.54-3.7 8.23-8.03 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.7-.8-.23-.09-.4-.13-.56.12-.17.25-.64.8-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43-.14-.01-.31-.01-.48-.01a.92.92 0 0 0-.67.31c-.23.25-.88.86-.88 2.1 0 1.24.9 2.43 1.02 2.6.13.17 1.77 2.7 4.29 3.79.6.26 1.07.41 1.43.53.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.1-.23-.16-.48-.28Z" />
        </svg>
        {labels.whatsapp}
      </a>

      <a
        href={fbHref}
        target="_blank"
        rel="noopener noreferrer"
        className={`${btn} bg-[#1877F2] text-white hover:bg-[#1467d6]`}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
          <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.9h2.54V9.85c0-2.51 1.49-3.9 3.77-3.9 1.09 0 2.24.2 2.24.2v2.47h-1.26c-1.24 0-1.63.78-1.63 1.57v1.87h2.78l-.44 2.9h-2.34V22c4.78-.76 8.44-4.92 8.44-9.94Z" />
        </svg>
        {labels.facebook}
      </a>

      <button
        type="button"
        onClick={copy}
        className={`${btn} border border-gray-300 text-gray-700 hover:bg-gray-50`}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15V5a2 2 0 0 1 2-2h10" />
        </svg>
        {copied ? labels.copied : labels.copy}
      </button>
    </div>
  );
}
