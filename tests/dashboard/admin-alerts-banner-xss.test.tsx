/**
 * tests/dashboard/admin-alerts-banner-xss.test.tsx
 *
 * Audit 2026-08-05, CRITICAL #5 — layer 1 of the stored-XSS fix.
 *
 * The stuck-users digest built its `preview` by concatenating profile names
 * with <br>, and this banner rendered it with dangerouslySetInnerHTML. A user
 * who signed up as `<img src=x onerror=…>` got script execution in the session
 * of any admin who opened /dashboard/journey/health.
 *
 * The banner must now render the preview as TEXT, while still honouring the
 * one piece of markup the digest legitimately emits — the <br> line break.
 *
 * Rendered with react-dom/server (no new test dependency): if the payload
 * survives as real markup in the output HTML, the XSS is back.
 */

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/app/actions/journey-notifications", () => ({
  markAllAdminAlertsRead: vi.fn(async () => ({ ok: true })),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { AdminAlertsBanner } from "@/components/dashboard/journey/AdminAlertsBanner";

const PAYLOAD = `<img src=x onerror="alert(1)">`;

function alertWithPreview(preview: string) {
  return [
    {
      id: "n1",
      kind: "stuck_users_digest",
      created_at: "2026-08-05T08:00:00.000Z",
      read_at: null,
      recipient_kind: "admin_pool",
      recipient_user_id: null,
      payload: { preview, context_label: "2 users idle" },
    },
  ] as never;
}

describe("AdminAlertsBanner never executes a stored name", () => {
  it("escapes an injected <img> instead of emitting it as an element", () => {
    const html = renderToStaticMarkup(
      <AdminAlertsBanner alerts={alertWithPreview(`• ${PAYLOAD} - 9 days idle`)} />,
    );

    // The payload must not survive as live markup — no element, and no
    // unescaped event-handler attribute. (The escaped TEXT still contains the
    // characters "onerror=", which is exactly the point: it is inert text.)
    expect(html).not.toContain("<img");
    expect(html).not.toContain(`onerror="alert(1)"`);
    // …it is escaped and shown to the admin as text.
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("still splits the digest's <br> separators into separate lines", () => {
    const html = renderToStaticMarkup(
      <AdminAlertsBanner
        alerts={alertWithPreview("• Alice - 8 days idle<br>• Bob - 9 days idle")}
      />,
    );

    expect(html).toContain("• Alice - 8 days idle");
    expect(html).toContain("• Bob - 9 days idle");
    // The separator became structure, not a literal string or a raw <br>.
    expect(html).not.toContain("&lt;br&gt;");
    expect(html).not.toContain("idle<br>•");
  });
});
