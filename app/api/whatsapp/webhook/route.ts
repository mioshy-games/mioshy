/**
 * WhatsApp Cloud API webhook.
 *
 *  GET  → Meta verification handshake (hub.challenge).
 *  POST → status updates (delivered/read/failed) + inbound messages + opt-out.
 *
 * Always returns 200 quickly so Meta does not retry. Signature is verified
 * against the RAW body using the App Secret.
 */

import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { verifyWebhookSignature, verifyWebhookChallenge } from "@/lib/whatsapp/verify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STOP_WORDS = ["הסר", "הסירו", "בטל", "ביטול", "stop", "unsubscribe", "cancel"];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const challenge = verifyWebhookChallenge(searchParams);
  if (challenge) {
    return new Response(challenge, { status: 200, headers: { "content-type": "text/plain" } });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get("x-hub-signature-256");

  if (!verifyWebhookSignature(raw, sig)) {
    return NextResponse.json({ ok: false, error: "bad-signature" }, { status: 401 });
  }

  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true, ignored: "bad-json" }, { status: 200 });
  }

  // Process best-effort; never fail the response.
  try {
    await handleEvent(body);
  } catch (e) {
    console.error("[whatsapp.webhook] handler error", e);
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

async function handleEvent(body: any) {
  const admin = createServiceRoleClient();
  if (!admin) return;

  const entries: any[] = body?.entry ?? [];
  for (const entry of entries) {
    const changes: any[] = entry?.changes ?? [];
    for (const change of changes) {
      const value = change?.value ?? {};

      // 1) Delivery/read/failed status updates → update the log by wamid.
      for (const status of value.statuses ?? []) {
        const wamid: string | undefined = status?.id;
        const newStatus: string | undefined = status?.status; // sent|delivered|read|failed
        if (!wamid || !newStatus) continue;

        await admin
          .from("whatsapp_messages")
          .update({
            status: newStatus,
            error: status?.errors ? { errors: status.errors } : null,
          })
          .eq("wa_message_id", wamid)
          .then(() => undefined, () => undefined);
      }

      // 2) Inbound messages → log + opt-out handling.
      for (const message of value.messages ?? []) {
        const from: string | undefined = message?.from; // sender phone, digits only
        const text: string = (message?.text?.body ?? "").trim();
        const isStop = STOP_WORDS.some((w) => text.toLowerCase() === w || text.toLowerCase().startsWith(w + " "));

        // Log the inbound message (opens 24h service window for free utility sends).
        await admin
          .from("whatsapp_messages")
          .insert({
            to_phone: from ?? null,
            direction: "inbound",
            status: "received",
            payload: { text, type: message?.type, wa_message_id: message?.id },
          })
          .then(() => undefined, () => undefined);

        // Opt-out: match the sender phone against profiles.mobile (suffix match,
        // since stored mobile may be national-form and inbound is international).
        if (isStop && from) {
          const last9 = from.slice(-9);
          await admin
            .from("profiles")
            .update({ whatsapp_opt_out_at: new Date().toISOString(), whatsapp_opt_in: false })
            .ilike("mobile", `%${last9}`)
            .then(() => undefined, () => undefined);
        }
      }
    }
  }
}
