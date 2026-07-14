"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface AdminQuestion {
  id: string;
  text: string;
  optionA: string;
  optionB: string;
  orderIndex: number;
  domain: string | null;
  priorA: number;
  priorB: number;
  isActive: boolean;
  countA: number;
  countB: number;
  pctA: number;
  pctB: number;
  totalVotes: number;
}

/**
 * Admin: poll questions — CSV import (§9), reorder (§9), activate/deactivate,
 * and per-question live distribution (§9 distributions dashboard, lite).
 * Internal tool — dark, functional styling.
 */
export function PollAdmin({ questions }: { questions: AdminQuestion[] }) {
  const router = useRouter();
  const [list, setList] = useState<AdminQuestion[]>(questions);
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [dirtyOrder, setDirtyOrder] = useState(false);

  const post = async (url: string, body: unknown) => {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return { ok: r.ok, data: await r.json().catch(() => ({})) };
  };

  const runImport = async () => {
    if (!csv.trim()) return;
    setBusy(true); setMsg(null);
    const { ok, data } = await post("/api/admin/poll/import", { csv });
    setBusy(false);
    setMsg(ok ? `נוספו ${data.inserted}, דילוג (קיים) ${data.skipped}${data.errors?.length ? ` · שגיאות: ${data.errors.length}` : ""}` : `שגיאה: ${data.error ?? "import failed"}`);
    if (ok) { setCsv(""); router.refresh(); }
  };

  const onFile = (f: File | null) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result ?? ""));
    reader.readAsText(f, "utf-8");
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    setList(next);
    setDirtyOrder(true);
  };

  const saveOrder = async () => {
    setBusy(true);
    const { ok } = await post("/api/admin/poll/reorder", { order: list.map((q) => q.id) });
    setBusy(false);
    if (ok) { setDirtyOrder(false); setMsg("הסדר נשמר"); router.refresh(); }
  };

  const toggle = async (q: AdminQuestion) => {
    setBusy(true);
    const { ok } = await post("/api/admin/poll/toggle", { questionId: q.id, isActive: !q.isActive });
    setBusy(false);
    if (ok) { setList((l) => l.map((x) => (x.id === q.id ? { ...x, isActive: !x.isActive } : x))); router.refresh(); }
  };

  // Download an example CSV in the exact import format (round-trips through
  // "ייצוא CSV" → edit → re-import). Built client-side, no server needed.
  const downloadTemplate = () => {
    const tpl =
      "text,option_a,option_b,order_index,domain,prior_a,prior_b,prior_weight,insight_line\r\n" +
      '"מי בדרך כלל אומר ""לילה טוב"" אחרון אצלכם?","אני, כמעט תמיד","בן או בת הזוג",1,"תקשורת",61,39,100,""\r\n';
    const blob = new Blob(["﻿" + tpl], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "poll-questions-template.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[#140d16] text-white p-6" style={{ fontFamily: "var(--font-assistant), sans-serif" }}>
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-extrabold mb-1">ניהול סקר הזוגיות של ישראל</h1>
        <p className="text-white/50 text-sm mb-6">ייבוא CSV · סדר שאלות · הפעלה/כיבוי · התפלגויות חיות</p>

        {/* CSV import */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5 mb-6">
          <div className="text-sm font-bold mb-2">ייבוא שאלות מ-CSV</div>
          <p className="text-white/50 text-xs mb-3">
            עמודות: text, option_a, option_b, order_index, domain, prior_a, prior_b, prior_weight, insight_line · דילוג אוטומטי על שאלה שכבר קיימת (לפי הטקסט).
          </p>
          {/* Download → edit → re-import round-trip. "ייצוא CSV" pulls all
              existing questions in the exact import format; the template is a
              one-row example. */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <a
              href="/api/admin/poll/export"
              className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/15"
            >
              ⬇ ייצוא CSV (כל השאלות)
            </a>
            <button
              type="button"
              onClick={downloadTemplate}
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
            >
              הורדת תבנית לדוגמה
            </button>
          </div>
          <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0] ?? null)} className="mb-3 text-sm" />
          <textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            placeholder="או הדביקו כאן את תוכן ה-CSV…"
            className="w-full h-32 rounded-xl bg-black/30 border border-white/10 p-3 text-sm text-white/90 outline-none"
          />
          <div className="flex items-center gap-3 mt-3">
            <button onClick={runImport} disabled={busy || !csv.trim()} className="rounded-xl bg-gradient-to-l from-[#b83c4d] via-[#ec4899] to-[#f59e0b] px-5 py-2.5 font-extrabold text-sm disabled:opacity-50">
              ייבוא
            </button>
            {msg && <span className="text-sm text-white/70">{msg}</span>}
          </div>
        </section>

        {/* questions + distributions */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-bold">שאלות ({list.length})</div>
            {dirtyOrder && (
              <button onClick={saveOrder} disabled={busy} className="rounded-lg bg-emerald-500/90 px-4 py-1.5 text-sm font-bold disabled:opacity-50">
                שמירת הסדר
              </button>
            )}
          </div>

          <div className="space-y-2">
            {list.map((q, i) => (
              <div key={q.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-start gap-3">
                  <div className="flex flex-col gap-1 pt-1">
                    <button onClick={() => move(i, -1)} disabled={i === 0} className="w-7 h-6 rounded bg-white/10 text-xs disabled:opacity-30">↑</button>
                    <button onClick={() => move(i, 1)} disabled={i === list.length - 1} className="w-7 h-6 rounded bg-white/10 text-xs disabled:opacity-30">↓</button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white/40 text-xs">#{i + 1}</span>
                      {q.domain && <span className="text-[10px] rounded-full bg-white/10 px-2 py-0.5 text-white/60">{q.domain}</span>}
                      {!q.isActive && <span className="text-[10px] rounded-full bg-rose-500/30 px-2 py-0.5 text-rose-200">כבוי</span>}
                    </div>
                    <div className="font-semibold mt-1 leading-snug">{q.text}</div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-white/5 px-2 py-1.5">
                        <div className="text-white/60">{q.optionA}</div>
                        <div className="font-extrabold">{q.pctA}% <span className="text-white/40 font-normal">({q.countA})</span></div>
                      </div>
                      <div className="rounded-lg bg-white/5 px-2 py-1.5">
                        <div className="text-white/60">{q.optionB}</div>
                        <div className="font-extrabold">{q.pctB}% <span className="text-white/40 font-normal">({q.countB})</span></div>
                      </div>
                    </div>
                    <div className="text-white/40 text-[11px] mt-1.5">
                      prior {q.priorA}/{q.priorB} · {q.totalVotes.toLocaleString("he-IL")} הצבעות אמיתיות
                    </div>
                  </div>
                  <button onClick={() => toggle(q)} disabled={busy} className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold ${q.isActive ? "bg-white/10" : "bg-emerald-500/80"}`}>
                    {q.isActive ? "כבה" : "הפעל"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
