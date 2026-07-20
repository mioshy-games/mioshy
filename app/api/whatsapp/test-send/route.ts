/**
 * POST /api/whatsapp/test-send
 *
 * Admin-only manual test-send of an approved WhatsApp template to any number.
 * Also serves as a manual trigger so we don't have to wait 24h in QA.
 *
 * Reuses the existing infra: sendTemplate() (lib/whatsapp/client.ts) + the
 * access token already in Vercel, the approved template builders
 * (lib/whatsapp/templates.ts), and phone normalization (lib/whatsapp/phone.ts).
 *
 * Body (JSON): { to, template, name?, expertName?, category?, minutesLeft? }
 *   to           — destination number (any local/international format; normalized)
 *   template     — "coach_welcome" | "intro_price_expiry_reminder"
 *   name         — body {{1}}; default "איציק"
 *   expertName   — coach_welcome body {{2}}; default handled by the builder
 *   category     — coach_welcome body {{3}} (selected area); default "זוגיות"
 *   minutesLeft  — intro_price_expiry_reminder body {{2}}; minutes-left NUMBER
 *                  ("דקות" is fixed in the template); default "18"
 *
 * intro_price_expiry_reminder has a STATIC URL button in the approved template,
 * so only the body params are sent (no button component) — the builder is right.
 *
 * Returns the full sendTemplate result so success/failure is visible:
 *   ok=true  → { ok, waMessageId, to, template }
 *   ok=false → { ok, status, errorCode?, message, to, template }
 */

import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { getWhatsAppConfig, sendTemplate } from "@/lib/whatsapp/client";
import { normalizePhoneForWhatsApp } from "@/lib/whatsapp/phone";
import {
  coachWelcomeTemplate,
  introPriceExpiryReminderTemplate,
} from "@/lib/whatsapp/templates";
import { createServiceRoleClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEMPLATES = ["coach_welcome", "intro_price_expiry_reminder"] as const;
type TemplateKey = (typeof TEMPLATES)[number];

export async function POST(req: Request) {
  // 1) Admin gate — same convention as the other /api/admin routes (403 JSON,
  //    not requireAdmin()'s redirect, which is wrong for a fetch endpoint).
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  // 2) Config gate.
  if (!getWhatsAppConfig()) {
    return NextResponse.json(
      { ok: false, error: "not configured" },
      { status: 400 },
    );
  }

  // 3) Parse + validate input.
  const body = (await req.json().catch(() => ({}))) as {
    to?: unknown;
    template?: unknown;
    name?: unknown;
    expertName?: unknown;
    category?: unknown;
    minutesLeft?: unknown;
  };

  const toRaw = typeof body.to === "string" ? body.to : "";
  const template = body.template as TemplateKey;
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "איציק";
  const expertName =
    typeof body.expertName === "string" && body.expertName.trim()
      ? body.expertName.trim()
      : undefined;
  const category =
    typeof body.category === "string" && body.category.trim()
      ? body.category.trim()
      : "זוגיות";
  const minutesLeft =
    typeof body.minutesLeft === "string" && body.minutesLeft.trim()
      ? body.minutesLeft.trim()
      : typeof body.minutesLeft === "number"
        ? String(body.minutesLeft)
        : "18";

  if (!TEMPLATES.includes(template)) {
    return NextResponse.json(
      { ok: false, error: `template must be one of: ${TEMPLATES.join(", ")}` },
      { status: 400 },
    );
  }

  const to = normalizePhoneForWhatsApp(toRaw);
  if (!to) {
    return NextResponse.json(
      { ok: false, error: "invalid 'to' phone number" },
      { status: 400 },
    );
  }

  // 4) Build the approved template payload.
  const tpl =
    template === "coach_welcome"
      ? coachWelcomeTemplate({ name, expertName, category })
      : introPriceExpiryReminderTemplate({ name, minutesLeft });

  // 5) Send.
  const result = await sendTemplate({
    to,
    templateName: tpl.templateName,
    languageCode: tpl.languageCode,
    components: tpl.components,
  });

  // 6) Log to whatsapp_messages (best-effort — mirrors the normal outbound path
  //    in lib/whatsapp/notifications.ts). recipient_user_id is null: this is a
  //    test send to an arbitrary number, not tied to a profile.
  const admin = createServiceRoleClient();
  if (admin) {
    await admin
      .from("whatsapp_messages")
      .insert({
        recipient_user_id: null,
        to_phone: to,
        direction: "outbound",
        template_name: tpl.templateName,
        category: tpl.category,
        wa_message_id: result.ok ? result.waMessageId : null,
        status: result.ok ? "sent" : "failed",
        error: result.ok
          ? null
          : { status: result.status, code: result.errorCode, message: result.message },
        payload: { components: tpl.components, test: true, sentBy: session.user.id },
      })
      .then(
        () => undefined,
        () => undefined, // swallow log errors — never block the response
      );
  }

  // 7) Return the full result so success/failure is visible in the browser/curl.
  if (result.ok) {
    return NextResponse.json({
      ok: true,
      waMessageId: result.waMessageId,
      to,
      template: tpl.templateName,
    });
  }
  return NextResponse.json(
    {
      ok: false,
      status: result.status,
      errorCode: result.errorCode,
      message: result.message,
      to,
      template: tpl.templateName,
    },
    { status: 502 },
  );
}
