/**
 * UserWhatsAppLog — per-user WhatsApp history (campaign dashboard View 2).
 *
 * Read-only server component rendered on the admin user profile page, alongside
 * the email message history. Lists every outbound WhatsApp row for the user
 * (newest first): when, which template, delivery status, and the skip/failure
 * reason. Metadata only (no message body). Data comes from
 * getUserWhatsAppMessages() — this component does no fetching itself.
 *
 * When the unified email+whatsapp comms-log (docs/admin-profile-comms-log-spec)
 * is built, this is the WhatsApp half that folds into it.
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { t } from "@/lib/admin/i18n";
import type { AdminLocale } from "@/lib/admin/locale";
import type { UserWhatsAppRow } from "@/lib/dashboard/whatsapp-overview";

// Status → badge tone. `read` is the success end-state; `failed` is destructive;
// safe-test journal states (would_send/skipped) are muted outlines.
function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "read") return "default";
  if (status === "delivered" || status === "sent") return "secondary";
  if (status === "failed") return "destructive";
  return "outline"; // would_send / skipped / queued
}

export function UserWhatsAppLog({
  rows,
  locale,
  rtl,
}: {
  rows: UserWhatsAppRow[];
  locale: AdminLocale;
  rtl: boolean;
}) {
  const dateLocale = locale === "he" ? "he-IL" : "en-US";
  const fmt = (v: string) =>
    new Date(v).toLocaleString(dateLocale, { dateStyle: "short", timeStyle: "short" });

  // A reason key we have a translation for, else the raw string.
  const reasonLabel = (reason: string | null) => {
    if (!reason) return "";
    const key = `whatsapp.reason.${reason}`;
    const translated = t(locale, key);
    return translated === key ? reason : translated;
  };

  return (
    <Card dir={rtl ? "rtl" : "ltr"}>
      <CardHeader>
        <CardTitle>
          {t(locale, "whatsapp.profile_title")} ({rows.length})
        </CardTitle>
        <CardDescription>{t(locale, "whatsapp.profile_desc")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t(locale, "whatsapp.col_when")}</TableHead>
              <TableHead>{t(locale, "whatsapp.col_template")}</TableHead>
              <TableHead>{t(locale, "whatsapp.col_status")}</TableHead>
              <TableHead>{t(locale, "whatsapp.col_reason")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap tabular-nums" dir="ltr">
                    {fmt(r.createdAt)}
                  </TableCell>
                  <TableCell className="font-mono text-xs" dir="ltr">
                    {r.templateName ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(r.status)}>
                      {t(locale, `whatsapp.status.${r.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs" dir="auto">
                    {reasonLabel(r.reason) || "—"}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-muted-foreground h-16 text-center"
                >
                  {t(locale, "whatsapp.profile_none")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
