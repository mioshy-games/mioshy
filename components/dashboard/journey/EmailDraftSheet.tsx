"use client";

/**
 * components/dashboard/journey/EmailDraftSheet.tsx
 *
 * "טיוטת אימייל" — a bottom sheet that drafts a warm Hebrew email to the
 * couple from their questionnaire results, then lets the coach edit it and
 * either copy it or open it in their mail client. We only DRAFT; sending
 * stays with the coach (no endpoint/schema changes here).
 *
 * The draft generates on first open (and on demand via "רענן"). On any AI
 * failure the sheet still opens with empty, editable fields so the coach can
 * compose manually — the feature never blocks the workflow.
 */

import { useState } from "react";
import { Mail, Sparkles, Loader2, Copy, Check, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  generateEmailDraft,
  type CoupleAiDigest,
} from "@/app/dashboard/journey/clients/[ownerKey]/ai-actions";

export function EmailDraftSheet({ digest }: { digest: CoupleAiDigest }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [copied, setCopied] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const draft = await generateEmailDraft(digest);
      if (draft) {
        setSubject(draft.subject);
        setBody(draft.body);
      } else {
        toast.message("לא נוצרה טיוטה", {
          description: "אפשר לכתוב כאן ידנית.",
        });
      }
    } finally {
      setLoading(false);
      setLoadedOnce(true);
    }
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next && !loadedOnce && !loading) void generate();
  }

  async function copyAll() {
    const text = subject ? `${subject}\n\n${body}` : body;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success("הועתק");
    } catch {
      toast.error("ההעתקה נכשלה");
    }
  }

  const mailto = `mailto:?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger className="border-border hover:bg-muted inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border px-4 text-sm font-medium">
        <Mail className="size-4" />
        טיוטת אימייל
      </SheetTrigger>
      <SheetContent
        side="bottom"
        dir="rtl"
        className="max-h-[88vh] overflow-y-auto rounded-t-2xl"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-rose-600" />
            טיוטת אימייל לזוג
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-3 pb-[env(safe-area-inset-bottom)]">
          {loading && !body ? (
            <div className="text-muted-foreground flex items-center justify-center gap-2 py-10 text-sm">
              <Loader2 className="size-5 animate-spin" />
              מנסח טיוטה לפי תוצאות השאלון…
            </div>
          ) : (
            <>
              <label className="block">
                <span className="text-muted-foreground mb-1 block text-xs font-medium">
                  נושא
                </span>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="נושא האימייל"
                  className="border-input bg-background focus-visible:ring-ring h-12 w-full rounded-lg border px-3 text-base focus-visible:outline-none focus-visible:ring-2"
                />
              </label>
              <label className="block">
                <span className="text-muted-foreground mb-1 block text-xs font-medium">
                  תוכן
                </span>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={9}
                  placeholder="תוכן האימייל…"
                  className="border-input bg-background focus-visible:ring-ring w-full rounded-lg border p-3 text-base leading-relaxed focus-visible:outline-none focus-visible:ring-2"
                />
              </label>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={copyAll}
                  className="bg-primary text-primary-foreground inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-medium"
                >
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                  העתק
                </button>
                <a
                  href={mailto}
                  className="border-border hover:bg-muted inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border px-4 text-sm font-medium"
                >
                  <Mail className="size-4" />
                  פתח במייל
                </a>
                <button
                  type="button"
                  onClick={generate}
                  disabled={loading}
                  aria-label="רענן טיוטה"
                  className="border-border hover:bg-muted inline-flex size-11 items-center justify-center rounded-lg border disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="size-4" />
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
