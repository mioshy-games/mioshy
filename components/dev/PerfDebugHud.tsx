"use client";

/**
 * PerfDebugHud — opt-in performance diagnostic overlay.
 *
 * Activated by appending `?perfdebug=1` to ANY URL on the site (the flag
 * is sticky for the tab via sessionStorage, so it survives client-side
 * navigations until the tab is closed). When inactive, this component
 * returns null and registers zero listeners — it is safe to leave
 * mounted in production.
 *
 * What it measures (all sampled on a 1s tick, so the HUD itself never
 * runs on the animation hot-path):
 *
 *   • FPS                          — rAF-based, clamped 0-60
 *   • Long tasks                   — count + worst duration in last 5s
 *                                     via PerformanceObserver('longtask')
 *   • Active CSS/Web animations    — `document.getAnimations().length`
 *                                     This is the single most useful
 *                                     number for diagnosing animation-
 *                                     storm pages: every CSS @keyframes
 *                                     declaration on a mounted element
 *                                     shows up here while running.
 *   • DOM size                     — total nodes
 *   • GPU-heavy element census     — counts of elements with `filter:
 *                                     blur`, `backdrop-filter`, `mix-
 *                                     blend-mode`, and `will-change`.
 *                                     Each is a candidate compositing
 *                                     bottleneck; high counts on idle
 *                                     pages are the usual cause of the
 *                                     "scrolling feels heavy" symptom.
 *   • Render counter               — increments every render of this
 *                                     component (one per parent re-render
 *                                     since props are empty).
 *   • Supabase realtime channels   — best-effort count via
 *                                     window.__mioshyRealtimeChannels
 *                                     (registered by lib/supabase/client
 *                                     when in debug mode). 0 if unset.
 *
 * Logs every sample to console under [perf] so you can grep the
 * Chrome devtools console for a longer history than the HUD shows.
 */

import { useEffect, useRef, useState } from "react";

type Sample = {
  fps: number;
  longTasks5s: number;
  worstLongTaskMs: number;
  animations: number;
  domNodes: number;
  blurredEls: number;
  backdropEls: number;
  mixBlendEls: number;
  willChangeEls: number;
  realtimeChannels: number;
  renders: number;
  heapMb: number | null;
};

const STORAGE_KEY = "mioshy_perfdebug";

function isPerfDebugOn(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("perfdebug") === "1") {
      sessionStorage.setItem(STORAGE_KEY, "1");
      return true;
    }
    if (sp.get("perfdebug") === "0") {
      sessionStorage.removeItem(STORAGE_KEY);
      return false;
    }
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function PerfDebugHud() {
  const [active, setActive] = useState(false);
  const [sample, setSample] = useState<Sample | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const renderCount = useRef(0);

  // Increment on every render of this component.
  renderCount.current += 1;

  useEffect(() => {
    setActive(isPerfDebugOn());
  }, []);

  useEffect(() => {
    if (!active) return;

    // ── FPS via rAF -------------------------------------------------
    let frames = 0;
    let lastFpsTick = performance.now();
    let currentFps = 0;
    let rafId = 0;
    const rafLoop = () => {
      frames += 1;
      const now = performance.now();
      if (now - lastFpsTick >= 1000) {
        currentFps = Math.round((frames * 1000) / (now - lastFpsTick));
        frames = 0;
        lastFpsTick = now;
      }
      rafId = requestAnimationFrame(rafLoop);
    };
    rafId = requestAnimationFrame(rafLoop);

    // ── Long tasks via PerformanceObserver --------------------------
    let longTasks: { t: number; d: number }[] = [];
    let po: PerformanceObserver | null = null;
    try {
      po = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          longTasks.push({ t: entry.startTime, d: entry.duration });
          // eslint-disable-next-line no-console
          console.warn(
            `[perf] longtask ${Math.round(entry.duration)}ms @ ${Math.round(
              entry.startTime,
            )}`,
          );
        }
      });
      po.observe({ entryTypes: ["longtask"] });
    } catch {
      /* longtask not supported in this browser */
    }

    // ── Sample tick (1Hz) -------------------------------------------
    const sampleTick = window.setInterval(() => {
      const now = performance.now();
      longTasks = longTasks.filter((t) => now - t.t < 5000);
      const worst = longTasks.reduce((m, t) => (t.d > m ? t.d : m), 0);

      const animations =
        typeof document.getAnimations === "function"
          ? document.getAnimations().length
          : -1;

      const domNodes = document.getElementsByTagName("*").length;

      // Census of GPU-heavy CSS. We sample every element once and check
      // its computed style. This is O(N) where N=DOM size, but at 1Hz
      // on pages that already churn at <30fps it's negligible.
      let blurredEls = 0;
      let backdropEls = 0;
      let mixBlendEls = 0;
      let willChangeEls = 0;
      const all = document.getElementsByTagName("*");
      for (let i = 0; i < all.length; i++) {
        const el = all[i] as HTMLElement;
        // Skip elements that browsers don't expose computed style for.
        const cs = window.getComputedStyle(el);
        if (!cs) continue;
        const f = cs.filter;
        if (f && f !== "none" && /blur\(/.test(f)) blurredEls++;
        const bf =
          cs.backdropFilter ||
          // @ts-expect-error - non-standard webkit prefix
          cs.webkitBackdropFilter ||
          "";
        if (bf && bf !== "none") backdropEls++;
        if (cs.mixBlendMode && cs.mixBlendMode !== "normal") mixBlendEls++;
        if (cs.willChange && cs.willChange !== "auto") willChangeEls++;
      }

      const realtimeChannels =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__mioshyRealtimeChannels?.size ??
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__mioshyRealtimeChannels?.length ??
        0;

      // performance.memory is Chrome-only; bytes → MB.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mem = (performance as any).memory;
      const heapMb = mem
        ? Math.round((mem.usedJSHeapSize / 1024 / 1024) * 10) / 10
        : null;

      const next: Sample = {
        fps: currentFps,
        longTasks5s: longTasks.length,
        worstLongTaskMs: Math.round(worst),
        animations,
        domNodes,
        blurredEls,
        backdropEls,
        mixBlendEls,
        willChangeEls,
        realtimeChannels,
        renders: renderCount.current,
        heapMb,
      };
      setSample(next);

      // eslint-disable-next-line no-console
      console.log("[perf]", next);
    }, 1000);

    return () => {
      cancelAnimationFrame(rafId);
      po?.disconnect();
      window.clearInterval(sampleTick);
    };
  }, [active]);

  if (!active) return null;

  const s = sample;
  const danger = (n: number, t: number) => (n >= t ? "#ff5470" : "#9aa3b2");

  return (
    <div
      data-perfdebug
      style={{
        position: "fixed",
        bottom: 12,
        left: 12,
        zIndex: 2147483647,
        fontFamily:
          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        fontSize: 11,
        lineHeight: 1.4,
        color: "#e6e8ec",
        background: "rgba(10,10,15,0.92)",
        border: "1px solid #333",
        borderRadius: 8,
        padding: collapsed ? "6px 10px" : "10px 12px",
        minWidth: collapsed ? 0 : 260,
        boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
        pointerEvents: "auto",
        userSelect: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: collapsed ? 0 : 6,
        }}
      >
        <strong style={{ color: "#fff" }}>perf hud</strong>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          style={{
            background: "transparent",
            color: "#aaa",
            border: "1px solid #444",
            borderRadius: 4,
            fontSize: 10,
            padding: "2px 6px",
            cursor: "pointer",
          }}
        >
          {collapsed ? "+" : "—"}
        </button>
      </div>
      {collapsed || !s ? null : (
        <table style={{ borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={{ paddingRight: 10, color: "#9aa3b2" }}>fps</td>
              <td style={{ color: s.fps < 45 ? "#ff5470" : "#7af0a0" }}>
                {s.fps}
              </td>
            </tr>
            <tr>
              <td style={{ paddingRight: 10, color: "#9aa3b2" }}>
                longtasks/5s
              </td>
              <td style={{ color: danger(s.longTasks5s, 1) }}>
                {s.longTasks5s} (worst {s.worstLongTaskMs}ms)
              </td>
            </tr>
            <tr>
              <td style={{ paddingRight: 10, color: "#9aa3b2" }}>
                animations
              </td>
              <td style={{ color: danger(s.animations, 12) }}>
                {s.animations < 0 ? "n/a" : s.animations}
              </td>
            </tr>
            <tr>
              <td style={{ paddingRight: 10, color: "#9aa3b2" }}>filter:blur</td>
              <td style={{ color: danger(s.blurredEls, 5) }}>
                {s.blurredEls}
              </td>
            </tr>
            <tr>
              <td style={{ paddingRight: 10, color: "#9aa3b2" }}>
                backdrop-filter
              </td>
              <td style={{ color: danger(s.backdropEls, 1) }}>
                {s.backdropEls}
              </td>
            </tr>
            <tr>
              <td style={{ paddingRight: 10, color: "#9aa3b2" }}>mix-blend</td>
              <td style={{ color: danger(s.mixBlendEls, 3) }}>
                {s.mixBlendEls}
              </td>
            </tr>
            <tr>
              <td style={{ paddingRight: 10, color: "#9aa3b2" }}>
                will-change
              </td>
              <td style={{ color: danger(s.willChangeEls, 8) }}>
                {s.willChangeEls}
              </td>
            </tr>
            <tr>
              <td style={{ paddingRight: 10, color: "#9aa3b2" }}>dom nodes</td>
              <td style={{ color: danger(s.domNodes, 1500) }}>{s.domNodes}</td>
            </tr>
            <tr>
              <td style={{ paddingRight: 10, color: "#9aa3b2" }}>
                supabase ch
              </td>
              <td style={{ color: danger(s.realtimeChannels, 2) }}>
                {s.realtimeChannels}
              </td>
            </tr>
            <tr>
              <td style={{ paddingRight: 10, color: "#9aa3b2" }}>renders</td>
              <td style={{ color: danger(s.renders, 50) }}>{s.renders}</td>
            </tr>
            {s.heapMb !== null ? (
              <tr>
                <td style={{ paddingRight: 10, color: "#9aa3b2" }}>heap</td>
                <td style={{ color: danger(s.heapMb, 200) }}>{s.heapMb}MB</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      )}
    </div>
  );
}
