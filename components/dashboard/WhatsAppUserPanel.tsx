import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircle } from "lucide-react";
import type {
  WhatsAppRecipientState,
  WhatsAppLogRow,
} from "@/lib/whatsapp/admin";

/**
 * Read-only WhatsApp panel on the admin user-detail page (spec §5.1).
 * Shows the mobile, opt-in state, the 24h service-window indicator, and the
 * last few outbound/inbound WhatsApp messages with delivery status.
 */

function StatusPill({ status, isHe }: { status: string; isHe: boolean }) {
  const map: Record<string, { he: string; en: string; cls: string }> = {
    sent: { he: "נשלח", en: "sent", cls: "bg-sky-500/15 text-sky-200 border-sky-400/25" },
    delivered: { he: "נמסר", en: "delivered", cls: "bg-emerald-500/15 text-emerald-200 border-emerald-400/25" },
    read: { he: "נקרא", en: "read", cls: "bg-emerald-500/20 text-emerald-100 border-emerald-400/30" },
    failed: { he: "נכשל", en: "failed", cls: "bg-rose-500/15 text-rose-200 border-rose-400/25" },
    received: { he: "התקבל", en: "received", cls: "bg-white/10 text-foreground/70 border-white/15" },
    queued: { he: "בתור", en: "queued", cls: "bg-white/10 text-foreground/60 border-white/15" },
  };
  const m = map[status] ?? { he: status, en: status, cls: "bg-white/10 text-foreground/60 border-white/15" };
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] ${m.cls}`}>
      {isHe ? m.he : m.en}
    </span>
  );
}

export function WhatsAppUserPanel({
  state,
  messages,
  configured,
  isHe,
}: {
  state: WhatsAppRecipientState;
  messages: WhatsAppLogRow[];
  configured: boolean;
  isHe: boolean;
}) {
  const optInLabel = state.optedOut
    ? isHe ? "הוסר (opt-out)" : "Opted out"
    : state.optIn
      ? isHe ? "אישר/ה" : "Opted in"
      : isHe ? "לא אישר/ה" : "Not opted in";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageCircle className="size-4 text-emerald-400" />
          WhatsApp
        </CardTitle>
        <CardDescription>
          {configured
            ? isHe
              ? "מצב הנמען לשליחת WhatsApp."
              : "Recipient state for WhatsApp sends."
            : isHe
              ? "WhatsApp עדיין לא מוגדר בסביבה הזו — הנתונים לקריאה בלבד."
              : "WhatsApp is not configured in this environment — read-only."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm" dir={isHe ? "rtl" : "ltr"}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className="text-muted-foreground">
            {isHe ? "נייד:" : "Mobile:"}{" "}
            <span dir="ltr" className="font-mono text-foreground/90">
              {state.mobile || (isHe ? "אין" : "none")}
            </span>
          </span>
          <span className="text-muted-foreground">
            {isHe ? "אישור:" : "Opt-in:"}{" "}
            <Badge variant={state.eligible ? "default" : "outline"}>{optInLabel}</Badge>
          </span>
          <span className="text-muted-foreground">
            {isHe ? "חלון:" : "Window:"}{" "}
            {state.windowOpen ? (
              <Badge variant="default">
                {isHe ? "פתוח — טקסט חופשי" : "open — free text"}
              </Badge>
            ) : (
              <Badge variant="outline">
                {isHe ? "סגור — תבנית בלבד" : "closed — template only"}
              </Badge>
            )}
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {isHe ? "הודעות אחרונות" : "Recent messages"}
          </span>
          {messages.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              {isHe ? "אין עדיין הודעות WhatsApp." : "No WhatsApp messages yet."}
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {messages.map((m) => {
                const preview =
                  m.payload?.body ?? m.payload?.text ?? m.template_name ?? "";
                return (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-2 rounded border px-2.5 py-1.5"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {m.direction === "inbound"
                          ? isHe ? "נכנס" : "in"
                          : isHe ? "יוצא" : "out"}
                      </Badge>
                      <span dir="auto" className="truncate text-foreground/80">
                        {preview || (isHe ? "(ללא תוכן)" : "(no content)")}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <StatusPill status={m.status} isHe={isHe} />
                      <time className="text-[10px] text-muted-foreground">
                        {new Date(m.created_at).toLocaleDateString(
                          isHe ? "he-IL" : "en-US",
                          { day: "numeric", month: "short" },
                        )}
                      </time>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
