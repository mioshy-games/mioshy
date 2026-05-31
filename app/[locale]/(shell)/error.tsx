"use client";

/**
 * Shell-wide error boundary.
 *
 * Next.js renders this whenever a server or client error bubbles up from
 * any (shell)/* route. Without it the user sees a generic "Application
 * error: a server-side exception has occurred" with no detail, and no
 * trace gets surfaced anywhere we can read it.
 *
 * What this boundary does:
 *   1. Logs the full error + digest to the browser console so anyone
 *      with DevTools can read it instantly.
 *   2. Sends a structured row to /api/observability/client-error so the
 *      same stack ends up in Vercel server logs (filter by
 *      `scope=client.error`). That way Itzik can spot client crashes
 *      without asking the user to send a screenshot.
 *   3. Renders a small, on-brand reset surface inside the shell — the
 *      sidebar + mobile tabs stay visible because layout.tsx is above
 *      this boundary in the tree.
 *
 * Added 2026-05-31 (Itzik: "logs that help us locate every issue").
 */

import { useEffect } from "react";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ShellError({ error, reset }: Props) {
  useEffect(() => {
    // 1. Loud console error so devs see it instantly.
    // eslint-disable-next-line no-console
    console.error("[shell.error]", {
      message: error.message,
      stack: error.stack,
      digest: error.digest,
      path: typeof window !== "undefined" ? window.location.pathname : null,
    });

    // 2. Best-effort POST to the server-side log endpoint. We don't
    //    await — failure here must not block the user. The endpoint
    //    receives JSON and re-emits it as a server log row.
    try {
      fetch("/api/observability/client-error", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: error.message,
          stack: error.stack?.slice(0, 4000) ?? null,
          digest: error.digest ?? null,
          path: window.location.pathname,
          ua: navigator.userAgent,
          at: new Date().toISOString(),
        }),
        keepalive: true,
      }).catch(() => {
        // Network failure swallowed — the console.error above is the
        // backup record.
      });
    } catch {
      /* ignore */
    }
  }, [error]);

  return (
    <div
      className="mx-auto flex w-full max-w-[640px] flex-col gap-4 px-5 py-12 text-center"
      role="alert"
      aria-live="assertive"
    >
      <div
        className="rounded-[16px] border p-6"
        style={{
          background: "rgba(184,60,77,0.08)",
          borderColor: "rgba(184,60,77,0.28)",
        }}
      >
        <h1
          className="m-0 text-[22px] font-extrabold"
          style={{ color: "var(--shell-text-1)" }}
        >
          משהו השתבש בעמוד הזה
        </h1>
        <p
          className="m-0 mt-2 text-[15px] leading-relaxed"
          style={{ color: "var(--shell-text-2)" }}
        >
          קרתה שגיאה לא צפויה. השגיאה תועדה אצלנו אוטומטית. אפשר לנסות
          לטעון מחדש, ואם הבעיה חוזרת, פשוט תכתוב לנו ונבדוק.
        </p>

        <button
          type="button"
          onClick={reset}
          className="mt-5 inline-flex h-11 items-center justify-center rounded-full px-6 text-[15px] font-bold text-white transition hover:opacity-90"
          style={{ background: "var(--shell-cta-grad)" }}
        >
          לטעון מחדש
        </button>

        {/* Digest is the Vercel-generated id for this error instance.
            When the user reports a bug they can copy this short string
            so we can correlate to a specific Vercel log row. */}
        {error.digest ? (
          <p
            className="m-0 mt-4 text-[12px] font-mono opacity-60"
            style={{ color: "var(--shell-text-3)" }}
          >
            error id: {error.digest}
          </p>
        ) : null}
      </div>
    </div>
  );
}
