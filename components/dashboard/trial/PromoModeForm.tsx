"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { savePromoMode } from "@/app/dashboard/actions/trial-settings";

type Mode = "off" | "personal_window" | "campaign_timer";

const OPTIONS: Array<{ value: Mode; label: string; hint: string }> = [
  { value: "off", label: "כבוי", hint: "בלי דחיפות. מחיר רגיל בכל מקום." },
  {
    value: "personal_window",
    label: "חלון אישי",
    hint: "מחיר ההיכרות נאכף בצד השרת למשך שנקבע למטה מסיום האבחון הקצר. ברירת המחדל.",
  },
  {
    value: "campaign_timer",
    label: "טיימר קמפיין",
    hint: "הטיימר הקיים, לדדליין חג משותף לכולם.",
  },
];

export function PromoModeForm({
  initial,
  initialHours = 48,
  initialDisplay = "text",
}: {
  initial: Mode;
  initialHours?: number;
  initialDisplay?: "text" | "clock";
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initial);
  const [hours, setHours] = useState<number>(initialHours);
  const [display, setDisplay] = useState<"text" | "clock">(initialDisplay);
  const [saving, setSaving] = useState(false);

  async function onSave() {
    // Guard the window length client-side (DB CHECK is 1..720).
    if (mode === "personal_window" && (!Number.isFinite(hours) || hours < 1 || hours > 720)) {
      toast.error("משך ההטבה חייב להיות בין 1 ל-720 שעות");
      return;
    }
    setSaving(true);
    try {
      const res = await savePromoMode(
        mode === "personal_window"
          ? { promo_mode: mode, personal_window_hours: hours, personal_window_display: display }
          : { promo_mode: mode },
      );
      if (res?.ok) {
        toast.success("מצב הדחיפות נשמר");
        router.refresh();
      } else {
        toast.error(res?.error?._root?.[0] ?? "שמירה נכשלה");
      }
    } catch {
      toast.error("שגיאה לא צפויה בשמירה");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div dir="rtl" className="space-y-4">
      <div className="rounded-lg border divide-y">
        {OPTIONS.map((o) => (
          <label
            key={o.value}
            className="flex cursor-pointer items-start gap-3 p-4"
          >
            <input
              type="radio"
              name="promo_mode"
              value={o.value}
              checked={mode === o.value}
              onChange={() => setMode(o.value)}
              className="mt-1"
            />
            <div>
              <div className="font-medium">{o.label}</div>
              <div className="text-sm text-muted-foreground">{o.hint}</div>
            </div>
          </label>
        ))}
      </div>

      {/* Personal-window controls — only meaningful in חלון אישי (migration 184). */}
      {mode === "personal_window" ? (
        <div className="space-y-4 rounded-lg border p-4">
          <label className="block">
            <span className="font-medium">משך ההטבה (שעות)</span>
            <input
              type="number"
              min={1}
              max={720}
              value={hours}
              onChange={(e) => setHours(parseInt(e.target.value, 10) || 0)}
              className="mt-1 block w-32 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm outline-none focus-visible:border-ring"
            />
            <span className="mt-1 block text-sm text-muted-foreground">
              נחתם בסיום האבחון הקצר (עכשיו + N שעות). חל על אבחונים חדשים; מי שכבר בתוך חלון שומר את שלו.
            </span>
          </label>

          <div>
            <span className="font-medium">תצוגה</span>
            <div className="mt-1 flex gap-4">
              {(
                [
                  { value: "text", label: "טקסט" },
                  { value: "clock", label: "שעון (ספירה לאחור)" },
                ] as const
              ).map((o) => (
                <label key={o.value} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="personal_window_display"
                    value={o.value}
                    checked={display === o.value}
                    onChange={() => setDisplay(o.value)}
                  />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <Button onClick={onSave} disabled={saving}>
        {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
        שמירה
      </Button>
    </div>
  );
}
