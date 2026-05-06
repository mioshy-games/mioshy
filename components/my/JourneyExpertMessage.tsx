"use client";

/**
 * JourneyExpertMessage - free-text channel from the user to their
 * clinician. Phase 4 - UI scaffolding only.
 *
 * When wired up, the submission will land in the clinician's
 * /dashboard/my-clients/[coupleId] page (next to the existing
 * Inbox of journey responses).
 *
 * Tone: this is NOT chat. It's a "leave a note" surface. Clinical
 * professionalism. We don't show a thread or a history (that would
 * encourage chat-like back-and-forth, which is the wrong product
 * for clinical guidance).
 */

import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import { submitExpertMessage } from "@/lib/journey-content/user-messages";
import { track } from "@/lib/analytics";

const MAX_LEN = 4000;

export function JourneyExpertMessage({
  isHe,
}: {
  isHe: boolean;
}) {
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const remaining = MAX_LEN - text.length;
  const canSend =
    text.trim().length > 0 && text.length <= MAX_LEN && !sent && !pending;

  const submit = () => {
    if (!canSend) return;
    setError(null);
    startTransition(async () => {
      const result = await submitExpertMessage({ text });
      if (result.ok) {
        track("journey_message_to_expert_sent", { length: text.length });
        setSent(true);
      } else {
        setError(
          result.message ??
            (isHe
              ? "אירעה תקלה. נסו שוב בעוד רגע."
              : "Something went wrong. Try again."),
        );
      }
    });
  };

  return (
    <section className="rounded-2xl border border-slate-300/[0.08] bg-slate-950/40 p-5 backdrop-blur-md">
      <header className="mb-3">
        <h2 className="text-sm font-semibold tracking-wide text-white/85">
          {isHe ? "הודעה למומחים שלכם" : "Message your clinician"}
        </h2>
        <p className="mt-1 text-[12px] text-white/55">
          {isHe
            ? "משהו שעולה לכם, שאלה, או רגע מהיומיום שכדאי שנדע עליו. ההודעה תגיע ישירות למומחה הצמוד אליכם."
            : "Something on your mind, a question, or a moment from your week the team should know. Goes straight to your assigned clinician."}
        </p>
      </header>

      {sent ? (
        <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/[0.06] p-4 text-center">
          <p className="text-sm font-semibold text-emerald-100">
            {isHe ? "ההודעה נשלחה" : "Message sent"}
          </p>
          <p className="mt-1 text-[12px] text-emerald-100/75">
            {isHe
              ? "המומחה יקרא אותה במהלך היום הקרוב ויחזור אליכם בתוכן ההמשך."
              : "Your clinician will read it within the day and respond through the follow-up content."}
          </p>
          <button
            type="button"
            onClick={() => {
              setSent(false);
              setText("");
            }}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/85 hover:border-white/30 hover:text-white"
          >
            {isHe ? "לכתוב הודעה נוספת" : "Send another"}
          </button>
        </div>
      ) : (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            maxLength={MAX_LEN}
            disabled={pending}
            placeholder={
              isHe ? "מה תרצו שהמומחה ידע?" : "What would you like your clinician to know?"
            }
            className="w-full resize-y rounded-md border border-white/10 bg-slate-950/60 p-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-60"
          />
          {error ? (
            <p className="mt-2 text-[12px] text-rose-300" role="alert">
              {error}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] tabular-nums text-white/40">
              {remaining.toLocaleString()} {isHe ? "תווים" : "left"}
            </span>
            <button
              type="button"
              onClick={submit}
              disabled={!canSend}
              className={[
                "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition",
                canSend
                  ? "bg-white text-slate-950 hover:bg-white/90"
                  : "cursor-not-allowed bg-white/10 text-white/40",
              ].join(" ")}
            >
              <Send className="h-3 w-3" />
              {pending
                ? isHe ? "שולחים..." : "Sending..."
                : isHe ? "לשלוח" : "Send"}
            </button>
          </div>
          <p className="mt-2 text-[11px] italic text-white/40">
            {isHe
              ? "הודעות נקראות במהלך שעות היום, לא מיועדות למקרי חירום."
              : "Messages are read during business hours, not for emergencies."}
          </p>
        </>
      )}
    </section>
  );
}
