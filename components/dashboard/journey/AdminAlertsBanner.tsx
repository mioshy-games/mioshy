"use client";

// ============================================================
// AdminAlertsBanner - slice 10 surface on /dashboard/journey/health.
// Shows unread admin_pool notifications (cron failures + stuck-user
// digests) at the top of the page, with a one-click "mark all read".
// ============================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markAllAdminAlertsRead } from "@/app/actions/journey-notifications";
import type { NotificationRow } from "@/lib/journey-content/notifications-read";
import { describeNotification } from "@/lib/notifications/labels";

interface Props {
  alerts: NotificationRow[];
}

export function AdminAlertsBanner({ alerts }: Props) {
  const router = useRouter();
  const [dismissing, setDismissing] = React.useState(false);
  if (alerts.length === 0) return null;

  const failureCount = alerts.filter((a) => a.kind === "cron_failure").length;
  const digestCount = alerts.filter((a) => a.kind === "stuck_users_digest").length;

  async function handleDismissAll() {
    setDismissing(true);
    const res = await markAllAdminAlertsRead();
    setDismissing(false);
    if (res.ok) router.refresh();
  }

  return (
    <section className="rounded-lg border border-rose-300/40 bg-rose-500/10 p-4">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-rose-100">
          <AlertTriangle className="size-4" aria-hidden />
          {alerts.length} unread admin alert{alerts.length === 1 ? "" : "s"}
          {failureCount > 0 ? ` · ${failureCount} cron failure${failureCount === 1 ? "" : "s"}` : ""}
          {digestCount > 0 ? ` · ${digestCount} digest${digestCount === 1 ? "" : "s"}` : ""}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={dismissing}
          onClick={() => void handleDismissAll()}
          className="text-xs"
        >
          <X className="me-1 size-3.5" />
          Mark all read
        </Button>
      </header>
      <ul className="space-y-2">
        {alerts.slice(0, 10).map((a) => {
          const desc = describeNotification(a.kind);
          const Icon = desc.icon;
          const preview =
            typeof a.payload?.preview === "string"
              ? (a.payload.preview as string)
              : null;
          const ctx =
            typeof a.payload?.context_label === "string"
              ? (a.payload.context_label as string)
              : null;
          return (
            <li
              key={a.id}
              className="rounded-md border border-rose-300/20 bg-rose-500/[0.05] p-2 text-xs text-rose-50"
            >
              <div className="flex items-start gap-2">
                <Icon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{desc.headlineEn}</div>
                  {ctx ? <div className="text-rose-100/85">{ctx}</div> : null}
                  {/* SECURITY: `preview` is assembled server-side from
                      user-supplied profile names (see the stuck-users digest in
                      app/api/journey/reminders). It must never be injected as
                      HTML — a name like `<img src=x onerror=…>` would execute
                      in an admin's session. The only markup the digest emits is
                      a <br> line separator, so we split on it and render each
                      line as text. Audit 2026-08-05, CRITICAL #5. */}
                  {preview ? (
                    <div className="mt-1 text-rose-100/70">
                      {preview.split(/<br\s*\/?>/i).map((line, i) => (
                        <div key={i}>{line}</div>
                      ))}
                    </div>
                  ) : null}
                  <time className="mt-1 block text-[10px] text-rose-100/60">
                    {new Date(a.created_at).toLocaleString()}
                  </time>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
