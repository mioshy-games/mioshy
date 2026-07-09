"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Mail,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Eye,
  X,
  ChevronLeft,
  FileText,
  CircleCheck,
  CircleSlash,
} from "lucide-react";
import type { EmailStat } from "@/lib/admin/email-stats";
import type { FlowStopVerification } from "@/lib/admin/email-flow-verify";

export interface EmailCardVM {
  key: string;
  order: number;
  timingLabel: string;
  gatesHe: string[];
  subject: string;
  html: string;
  senderName: string | null;
  active: boolean;
  stats: EmailStat | null;
}

export interface FlowVM {
  id: string;
  nameHe: string;
  segmentHe: string;
  descriptionHe: string;
  stopConditionHe: string;
  built: boolean;
  emails: EmailCardVM[];
}

function pct(part: number, whole: number): string {
  if (!whole) return "0%";
  return `${Math.round((part / whole) * 100)}%`;
}

function StatBlock({ stats }: { stats: EmailStat | null }) {
  if (!stats) {
    return <span className="text-slate-400">נתונים לא זמינים</span>;
  }
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      <span>
        נשלחו <b className="tabular-nums">{stats.sent}</b>
      </span>
      <span>
        נמסרו <b className="tabular-nums">{stats.delivered}</b>
      </span>
      <span>
        נפתחו <b className="tabular-nums">{stats.opened}</b>{" "}
        <span className="text-slate-500">({pct(stats.opened, stats.sent)})</span>
      </span>
      {stats.clicked > 0 && (
        <span>
          הוקלקו <b className="tabular-nums">{stats.clicked}</b>
        </span>
      )}
    </div>
  );
}

function EmailCard({
  email,
  onPreview,
}: {
  email: EmailCardVM;
  onPreview: (e: EmailCardVM) => void;
}) {
  return (
    <div className="flex w-[300px] shrink-0 flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white">
            {email.order}
          </span>
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">
            {email.key}
          </code>
        </div>
        {email.active ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
            <CircleCheck className="h-3 w-3" /> פעיל
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
            <CircleSlash className="h-3 w-3" /> inert
          </span>
        )}
      </div>

      <p className="mb-2 line-clamp-2 min-h-[2.5rem] text-sm font-semibold text-slate-900">
        {email.subject}
      </p>

      <div className="mb-2 flex items-center gap-1.5 text-xs text-slate-600">
        <Clock className="h-3.5 w-3.5 shrink-0" />
        <span>{email.timingLabel}</span>
      </div>

      <div className="mb-3 flex flex-wrap gap-1">
        {email.gatesHe.map((g) => (
          <span
            key={g}
            className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-700 ring-1 ring-amber-200"
          >
            {g}
          </span>
        ))}
      </div>

      <div className="mb-3 border-t border-slate-100 pt-2">
        <StatBlock stats={email.stats} />
      </div>

      <button
        onClick={() => onPreview(email)}
        className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
      >
        <Eye className="h-4 w-4" /> צפייה בתוכן
      </button>
    </div>
  );
}

function VerificationBanner({ v }: { v: FlowStopVerification }) {
  const good = v.ok;
  return (
    <div
      className={`rounded-xl border p-4 ${
        good
          ? "border-emerald-200 bg-emerald-50"
          : "border-rose-200 bg-rose-50"
      }`}
    >
      <div className="mb-1 flex items-center gap-2">
        {good ? (
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
        ) : (
          <ShieldAlert className="h-5 w-5 text-rose-600" />
        )}
        <h3 className="font-semibold text-slate-900">
          עצירת הפלואו בעת רכישת מנוי journey — {good ? "מאומת ✓" : "נכשל ✗"}
        </h3>
      </div>
      <p className="mb-2 text-sm text-slate-700">{v.note}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg bg-white/70 p-2 text-sm ring-1 ring-slate-200">
          <div className="font-medium text-slate-800">מנוי journey פעיל</div>
          {v.subscriber ? (
            <div className="text-slate-600">
              משתמש <code>{v.subscriber.userId.slice(0, 8)}</code> →{" "}
              {v.subscriber.stopped ? (
                <b className="text-emerald-700">נעצר (skip_purchased) ✓</b>
              ) : (
                <b className="text-rose-700">לא נעצר ✗</b>
              )}
            </div>
          ) : (
            <div className="text-slate-400">אין דגימה כרגע</div>
          )}
        </div>
        <div className="rounded-lg bg-white/70 p-2 text-sm ring-1 ring-slate-200">
          <div className="font-medium text-slate-800">קונה ללא journey</div>
          {v.nonSubscriber ? (
            <div className="text-slate-600">
              משתמש <code>{v.nonSubscriber.userId.slice(0, 8)}</code> →{" "}
              {v.nonSubscriber.stopped ? (
                <b className="text-rose-700">נעצר בטעות ✗</b>
              ) : (
                <b className="text-emerald-700">ממשיך בפלואו ✓</b>
              )}
            </div>
          ) : (
            <div className="text-slate-400">אין דגימה כרגע</div>
          )}
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        נבדק ב-{new Date(v.checkedAt).toLocaleString("he-IL")} · בדיקה חיה מול
        אותה קריאה שה-cron מבצע ב-Gate-2 (hasActiveSubscription(uid, &quot;journey&quot;)).
      </p>
    </div>
  );
}

export function EmailSequencesDashboard({
  flows,
  verification,
}: {
  flows: FlowVM[];
  verification: FlowStopVerification;
}) {
  const [selected, setSelected] = useState<string>(
    flows.find((f) => f.built)?.id ?? flows[0]?.id ?? "",
  );
  const [preview, setPreview] = useState<EmailCardVM | null>(null);
  const flow = flows.find((f) => f.id === selected) ?? flows[0];

  return (
    <div dir="rtl" className="mx-auto flex max-w-[1400px] gap-6 p-4 sm:p-6">
      {/* Side rail */}
      <aside className="hidden w-48 shrink-0 lg:block">
        <div className="sticky top-6 rounded-xl border border-slate-200 bg-white p-3">
          <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            אדמין
          </div>
          <nav className="flex flex-col gap-1 text-sm">
            <Link
              href="/admin/content"
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-slate-600 hover:bg-slate-100"
            >
              <FileText className="h-4 w-4" /> תוכן (CMS)
            </Link>
            <span className="flex items-center gap-2 rounded-lg bg-slate-800 px-2 py-1.5 font-medium text-white">
              <Mail className="h-4 w-4" /> סדרות מיילים
            </span>
          </nav>
        </div>
      </aside>

      {/* Main */}
      <main className="min-w-0 flex-1">
        <header className="mb-5">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Mail className="h-6 w-6" /> מעקב סדרות מיילים
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            צפייה בלבד · תרשים הפלואו, תזמונים, שערים, ונתוני שליחה/פתיחה (Brevo).
          </p>
        </header>

        {/* Segment filter */}
        <div className="mb-5 flex flex-wrap gap-2">
          {flows.map((f) => (
            <button
              key={f.id}
              disabled={!f.built}
              onClick={() => f.built && setSelected(f.id)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                f.id === selected
                  ? "bg-slate-800 text-white"
                  : f.built
                    ? "bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
                    : "cursor-not-allowed bg-slate-50 text-slate-400 ring-1 ring-slate-200"
              }`}
            >
              {f.nameHe}
              {!f.built && <span className="mr-1 text-xs">· בקרוב</span>}
            </button>
          ))}
        </div>

        {flow && (
          <div className="space-y-5">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="font-semibold text-slate-900">{flow.nameHe}</h2>
              <p className="mt-1 text-sm text-slate-600">{flow.segmentHe}</p>
              <p className="mt-1 text-sm text-slate-500">{flow.descriptionHe}</p>
            </div>

            {flow.id === "post_assessment_no_journey" && (
              <VerificationBanner v={verification} />
            )}

            {flow.built && flow.emails.length > 0 ? (
              <>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <b>עצירת הפלואו:</b> {flow.stopConditionHe}
                </div>

                {/* Flow chart — email 1 → 2 → 3 → 4 */}
                <div className="flex items-stretch gap-2 overflow-x-auto pb-3">
                  {flow.emails.map((e, i) => (
                    <div key={e.key} className="flex items-center gap-2">
                      <EmailCard email={e} onPreview={setPreview} />
                      {i < flow.emails.length - 1 && (
                        <ChevronLeft className="h-6 w-6 shrink-0 text-slate-300" />
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-400">
                הפלואו הזה עדיין לא נבנה.
              </div>
            )}
          </div>
        )}
      </main>

      {/* Preview modal */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setPreview(null)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2 border-b border-slate-200 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">
                    {preview.key}
                  </code>
                  {preview.senderName && (
                    <span className="text-xs text-slate-500">
                      From: {preview.senderName}
                    </span>
                  )}
                </div>
                <p className="mt-1 truncate font-semibold text-slate-900">
                  {preview.subject}
                </p>
              </div>
              <button
                onClick={() => setPreview(null)}
                className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                aria-label="סגור"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <iframe
              title={`preview-${preview.key}`}
              srcDoc={preview.html}
              className="h-[70vh] w-full flex-1 border-0 bg-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}
