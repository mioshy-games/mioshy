/**
 * POST /api/debug/mobile-bar
 *
 * Diagnostic-only endpoint. The <MobileServicesBar /> client component
 * fires a fetch to here when scrolled near the bottom of the page, with
 * a snapshot of every measurement that could explain why the bar
 * floats off the bottom edge on iOS (Safari / Chrome). The handler
 * just stamps the payload into Vercel function logs so we can compare
 * sessions without needing a remote inspector.
 *
 * Gated by `?debug_bar=1` on the page URL — see MobileServicesBar
 * for the trigger. Without the query param the client never POSTs,
 * so this endpoint is dormant in normal user sessions and adds zero
 * cost to the regular request budget.
 *
 * Lifecycle: enable temporarily while investigating bar-positioning
 * regressions; remove the route + the client-side fetch when the
 * issue is resolved. Keep this file as the audit trail.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SnapshotPayload {
  ts?: number;
  sessionId?: string;
  url?: string;
  ua?: string;
  /** What triggered the snapshot: "mount" | "scroll-near-bottom" | "footer-visible" | "vv-resize" */
  reason?: string;
  /** window.innerHeight at sample time */
  innerHeight?: number;
  /** window.scrollY (how far the user has scrolled) */
  scrollY?: number;
  /** document scroll height */
  scrollHeight?: number;
  /** Distance from current scroll position to bottom of document */
  bottomDistance?: number;
  /** window.visualViewport.height (visual viewport — shrinks/grows with browser chrome) */
  vvHeight?: number;
  /** window.visualViewport.offsetTop */
  vvOffsetTop?: number;
  /** Computed --mobile-bar-vv-offset CSS variable (px) */
  vvOffsetCssVar?: string;
  /** The nav element's getBoundingClientRect() */
  navRect?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
    width: number;
    height: number;
  };
  /** Whether the footer is currently intersecting */
  footerVisible?: boolean;
  /** Computed transform on the nav element */
  navTransform?: string;
  /** safe-area-inset-bottom value (resolved px if browser provides it) */
  safeAreaInsetBottom?: string;
}

export async function POST(req: Request) {
  let body: SnapshotPayload;
  try {
    body = (await req.json()) as SnapshotPayload;
  } catch {
    return new Response("bad json", { status: 400 });
  }

  // Single-line JSON log so Vercel's log view groups it cleanly and a
  // grep on the `mobile-bar:` prefix surfaces every sample.
  console.log(
    "mobile-bar:snapshot",
    JSON.stringify({
      ts: body.ts ?? Date.now(),
      session_id: body.sessionId ?? null,
      url: body.url ?? null,
      ua: body.ua ?? null,
      reason: body.reason ?? null,
      inner_height: body.innerHeight ?? null,
      scroll_y: body.scrollY ?? null,
      scroll_height: body.scrollHeight ?? null,
      bottom_distance: body.bottomDistance ?? null,
      vv_height: body.vvHeight ?? null,
      vv_offset_top: body.vvOffsetTop ?? null,
      vv_offset_css_var: body.vvOffsetCssVar ?? null,
      nav_rect: body.navRect ?? null,
      footer_visible: body.footerVisible ?? null,
      nav_transform: body.navTransform ?? null,
      safe_area_inset_bottom: body.safeAreaInsetBottom ?? null,
    }),
  );

  return new Response("ok", { status: 200 });
}
