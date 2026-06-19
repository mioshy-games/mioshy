"use client";

/**
 * InquiriesTable — admin overview inquiries list. Rows come from the existing
 * pending-replies source of truth (getPendingExpertMessages, via the server).
 * "Pending only" filter (default on) + newest-first sort. Two actions per row:
 *   • Profile + assessment → /dashboard/users/[id]  (unified profile screen)
 *   • Reply               → /dashboard/my-clients/[coupleId]  (couple workspace),
 *                            or the solo expert-messages thread when no couple.
 */

import Link from "next/link";
import { useMemo, useState } from "react";
import { t } from "@/lib/admin/i18n";
import type { AdminLocale } from "@/lib/admin/locale";

export interface InquiryTableRow {
  userId: string;
  coupleId: string | null;
  displayName: string;
  inquiryAt: string; // ISO
  assessmentDone: boolean;
  replyPending: boolean;
}

export function InquiriesTable({
  rows,
  locale,
}: {
  rows: InquiryTableRow[];
  locale: AdminLocale;
}) {
  const [pendingOnly, setPendingOnly] = useState(true);

  const visible = useMemo(
    () =>
      rows
        .filter((r) => !pendingOnly || r.replyPending)
        .sort((a, b) => b.inquiryAt.localeCompare(a.inquiryAt)),
    [rows, pendingOnly],
  );

  const fmt = (iso: string) => {
    try {
      return new Date(iso).toLocaleString(locale === "he" ? "he-IL" : "en-US", {
        dateStyle: "short",
        timeStyle: "short",
      });
    } catch {
      return iso;
    }
  };

  const replyHref = (r: InquiryTableRow) =>
    r.coupleId
      ? `/dashboard/my-clients/${r.coupleId}#general`
      : `/dashboard/journey/expert-messages?user=${r.userId}`;

  return (
    <div className="space-y-3">
      <label className="text-muted-foreground inline-flex cursor-pointer items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={pendingOnly}
          onChange={(e) => setPendingOnly(e.target.checked)}
          className="size-3.5"
        />
        {t(locale, "overview.inq.pending_only")}
      </label>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="text-muted-foreground border-b text-xs">
            <tr>
              <th className="px-3 py-2 text-start font-medium">{t(locale, "overview.inq.col_name")}</th>
              <th className="px-3 py-2 text-start font-medium">{t(locale, "overview.inq.col_time")}</th>
              <th className="px-3 py-2 text-start font-medium">{t(locale, "overview.inq.col_assess")}</th>
              <th className="px-3 py-2 text-start font-medium">{t(locale, "overview.inq.col_reply")}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {visible.length ? (
              visible.map((r) => (
                <tr key={r.userId} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium">{r.displayName}</td>
                  <td className="text-muted-foreground px-3 py-2 tabular-nums">{fmt(r.inquiryAt)}</td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        "rounded-full px-2 py-0.5 text-[11px] " +
                        (r.assessmentDone
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-muted text-muted-foreground")
                      }
                    >
                      {t(locale, r.assessmentDone ? "overview.inq.assess_done" : "overview.inq.assess_todo")}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-400">
                      {t(locale, "overview.inq.reply_pending")}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/dashboard/users/${r.userId}`}
                        className="hover:bg-accent rounded-md border px-2.5 py-1 text-xs whitespace-nowrap"
                      >
                        {t(locale, "overview.inq.btn_profile")}
                      </Link>
                      <Link
                        href={replyHref(r)}
                        className="bg-primary text-primary-foreground rounded-md px-2.5 py-1 text-xs whitespace-nowrap hover:brightness-110"
                      >
                        {t(locale, "overview.inq.btn_reply")}
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="text-muted-foreground h-20 text-center">
                  {t(locale, "overview.inq.empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
