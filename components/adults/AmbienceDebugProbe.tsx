"use client";

/**
 * AmbienceDebugProbe — diagnostic probe that runs after the page hydrates
 * and inspects what's ACTUALLY happening to the fog-blob layer at runtime.
 *
 * Why we're going so deep
 * ───────────────────────
 * Earlier diagnostics confirmed the fog blobs are in the DOM with the
 * right counts and the ambience container has `isolation: auto`. But
 * users still report seeing a flat-black page. That means everything
 * "exists" in the tree but something stops the colour from PAINTING.
 *
 * This probe expands on the prior version by inspecting each blob's
 * computed styles AND running `elementFromPoint()` at each blob's
 * centre — if the topmost element at that point is NOT one of the
 * blob ancestors, something opaque is sitting in front of them
 * (a non-transparent <main>, a stacking context above z-index, etc).
 *
 * Reads only — never mutates the DOM. Cheap to leave in. Removes
 * itself with one line when we're satisfied visibility is correct.
 */

import { useEffect } from "react";

export function AmbienceDebugProbe({ label }: { label: string }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    // Defer slightly so all sibling components are mounted/laid out.
    const t = window.setTimeout(() => {
      runProbe(label);
    }, 100);
    return () => window.clearTimeout(t);
  }, [label]);

  return null;
}

function runProbe(label: string) {
  const tag = `[AmbienceDebugProbe:${label}]`;
  // eslint-disable-next-line no-console
  const log = (...args: unknown[]) => console.log(tag, ...args);

  const ambience = document.querySelector(
    '[data-testid="adults-ambience"]',
  ) as HTMLElement | null;

  if (!ambience) {
    log("FAIL: no [data-testid='adults-ambience'] in the DOM");
    return;
  }

  const ambienceCS = window.getComputedStyle(ambience);
  const ambienceRect = ambience.getBoundingClientRect();

  log("ambience element", {
    found: true,
    rect: snapshotRect(ambienceRect),
    computedZIndex: ambienceCS.zIndex,
    computedIsolation: ambienceCS.isolation,
    computedOverflow: ambienceCS.overflow,
    computedDisplay: ambienceCS.display,
    computedVisibility: ambienceCS.visibility,
    computedOpacity: ambienceCS.opacity,
    computedTransform: ambienceCS.transform,
    computedFilter: ambienceCS.filter,
    computedMixBlendMode: ambienceCS.mixBlendMode,
  });

  // Walk up the parent chain — find anyone above us that introduces an
  // unexpected stacking context (transform, filter, isolation, etc).
  log("ambience ancestor chain (looking for stacking-context creators)");
  let walker: HTMLElement | null = ambience.parentElement;
  let depth = 0;
  while (walker && depth < 12) {
    const cs = window.getComputedStyle(walker);
    log(`  ${depth}: <${walker.tagName.toLowerCase()}>`, {
      classes: walker.className.slice(0, 80),
      position: cs.position,
      zIndex: cs.zIndex,
      isolation: cs.isolation,
      transform: cs.transform === "none" ? "none" : "yes",
      filter: cs.filter === "none" ? "none" : "yes",
      mixBlendMode: cs.mixBlendMode,
      overflow: cs.overflow,
      backgroundColor: cs.backgroundColor,
      opacity: cs.opacity,
    });
    walker = walker.parentElement;
    depth += 1;
  }

  const fogBlobs = Array.from(
    ambience.querySelectorAll<HTMLElement>(".mio-fog"),
  );

  log(`fog blob count: ${fogBlobs.length}`);

  fogBlobs.forEach((blob, i) => {
    const cs = window.getComputedStyle(blob);
    const rect = blob.getBoundingClientRect();
    const center = {
      x: Math.round(rect.left + rect.width / 2),
      y: Math.round(rect.top + rect.height / 2),
    };
    // Clamp the center to the viewport so elementFromPoint returns
    // something meaningful even if the blob's centre is offscreen.
    const inViewport =
      center.x >= 0 &&
      center.x <= window.innerWidth &&
      center.y >= 0 &&
      center.y <= window.innerHeight;
    const sampleX = clamp(center.x, 1, window.innerWidth - 1);
    const sampleY = clamp(center.y, 1, window.innerHeight - 1);
    const topAtCentre = document.elementFromPoint(sampleX, sampleY);
    const ancestorIsBlob = topAtCentre
      ? topAtCentre === blob || blob.contains(topAtCentre) || topAtCentre.contains(blob)
      : false;

    log(`fog #${i + 1}`, {
      rect: snapshotRect(rect),
      centerInViewport: inViewport,
      // Why this matters: if the topmost element at the blob's centre
      // is NOT the blob itself (or one of its ancestors), then some
      // opaque sibling is painting over it. That's the most common
      // cause of "the layer is in the DOM but I can't see it".
      topElementAtCenter: topAtCentre
        ? `<${topAtCentre.tagName.toLowerCase()}> ${topAtCentre.className?.toString().slice(0, 60)}`
        : "(none)",
      blobIsTopOrAncestor: ancestorIsBlob,
      computedBackground: cs.background.slice(0, 100),
      computedBackgroundColor: cs.backgroundColor,
      computedOpacity: cs.opacity,
      computedDisplay: cs.display,
      computedVisibility: cs.visibility,
      computedFilter: cs.filter, // expecting blur(100px) etc
      computedMixBlendMode: cs.mixBlendMode,
      computedZIndex: cs.zIndex,
    });
  });

  // Sample the actual painted pixels at the centre of the viewport — this
  // tells us what colour is reaching the user's eye, not just what the
  // computed styles claim. We can't read the framebuffer (CORS), but we
  // can ask elementFromPoint and walk up to find the first non-transparent
  // ancestor — that's the colour the user sees.
  const cx = Math.round(window.innerWidth / 2);
  const cy = Math.round(window.innerHeight / 2);
  let painter = document.elementFromPoint(cx, cy) as HTMLElement | null;
  let found: { tag: string; cls: string; bg: string } | null = null;
  let walks = 0;
  while (painter && walks < 12) {
    const cs = window.getComputedStyle(painter);
    if (cs.backgroundColor && cs.backgroundColor !== "rgba(0, 0, 0, 0)") {
      found = {
        tag: painter.tagName.toLowerCase(),
        cls: painter.className?.toString().slice(0, 60) ?? "",
        bg: cs.backgroundColor,
      };
      break;
    }
    painter = painter.parentElement;
    walks += 1;
  }
  log("colour at viewport centre (first non-transparent ancestor)", {
    cx,
    cy,
    found,
  });
}

function snapshotRect(r: DOMRect) {
  return {
    x: Math.round(r.x),
    y: Math.round(r.y),
    w: Math.round(r.width),
    h: Math.round(r.height),
  };
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
