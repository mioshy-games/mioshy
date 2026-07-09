"use client";

import { useState } from "react";

type ApiResult =
  | { ok: true; waMessageId: string; to: string; template: string }
  | { ok: false; status?: number; errorCode?: string; message?: string; error?: string; to?: string; template?: string };

const TEMPLATES = [
  { value: "coach_welcome", label: "coach_welcome (utility)" },
  { value: "intro_price_expiry_reminder", label: "intro_price_expiry_reminder (marketing)" },
] as const;

/**
 * Admin-only browser form for POST /api/whatsapp/test-send — lets Itzik send an
 * approved template to any number without curl. All logic/security lives in the
 * endpoint; this is a thin client.
 */
export function WhatsAppTestForm() {
  const [to, setTo] = useState("972545215193");
  const [template, setTemplate] = useState<(typeof TEMPLATES)[number]["value"]>("coach_welcome");
  const [name, setName] = useState("");
  const [expertName, setExpertName] = useState("");
  const [category, setCategory] = useState("");
  const [expiryLabel, setExpiryLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);

  const isCoach = template === "coach_welcome";

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/whatsapp/test-send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          to,
          template,
          name: name || undefined,
          expertName: isCoach ? expertName || undefined : undefined,
          category: isCoach ? category || undefined : undefined,
          expiryLabel: !isCoach ? expiryLabel || undefined : undefined,
        }),
      });
      const json = (await res.json().catch(() => null)) as ApiResult | null;
      setResult(json ?? { ok: false, message: `HTTP ${res.status}` });
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : "Network error" });
    } finally {
      setBusy(false);
    }
  }

  const labelCls = "block text-sm font-semibold text-slate-700 mb-1";
  const inputCls =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500";

  return (
    <div className="mx-auto max-w-lg px-4 py-10" dir="rtl">
      <h1 className="mb-1 text-2xl font-bold text-slate-900">בדיקת שליחת WhatsApp</h1>
      <p className="mb-6 text-sm text-slate-500">
        שולח תבנית מאושרת למספר לבחירה. משתמש בטוקן שכבר ב-Vercel. גם טריגר ידני
        לבדיקות (בלי להמתין 24 שעות).
      </p>

      <form onSubmit={send} className="space-y-4">
        <div>
          <label className={labelCls} htmlFor="wa-to">מספר יעד</label>
          <input
            id="wa-to"
            className={inputCls}
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="972545215193 / 0545215193 / +972..."
            dir="ltr"
            required
          />
        </div>

        <div>
          <label className={labelCls} htmlFor="wa-template">תבנית</label>
          <select
            id="wa-template"
            className={inputCls}
            value={template}
            onChange={(e) => setTemplate(e.target.value as typeof template)}
          >
            {TEMPLATES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls} htmlFor="wa-name">שם ({"{{"}1{"}}"}) — ברירת מחדל: איציק</label>
          <input
            id="wa-name"
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="איציק"
          />
        </div>

        {isCoach ? (
          <>
            <div>
              <label className={labelCls} htmlFor="wa-expert">שם המומחה ({"{{"}2{"}}"}) — ברירת מחדל: יצחק ברלב</label>
              <input
                id="wa-expert"
                className={inputCls}
                value={expertName}
                onChange={(e) => setExpertName(e.target.value)}
                placeholder="יצחק ברלב"
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="wa-category">קטגוריה נבחרת ({"{{"}3{"}}"}) — ברירת מחדל: זוגיות</label>
              <input
                id="wa-category"
                className={inputCls}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="זוגיות"
              />
            </div>
          </>
        ) : (
          <div>
            <label className={labelCls} htmlFor="wa-expiry">תווית תפוגה ({"{{"}2{"}}"})</label>
            <input
              id="wa-expiry"
              className={inputCls}
              value={expiryLabel}
              onChange={(e) => setExpiryLabel(e.target.value)}
              placeholder="מחר בשעה 21:00"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
        >
          {busy ? "שולח…" : "שלח"}
        </button>
      </form>

      {result && (
        <pre
          dir="ltr"
          className={`mt-6 overflow-x-auto rounded-lg border p-4 text-xs ${
            result.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-900"
          }`}
        >
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
