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
    label: "חלון אישי (48 שעות)",
    hint: "מחיר ההיכרות נאכף בצד השרת רק 48 שעות מסיום האבחון הקצר. ברירת המחדל.",
  },
  {
    value: "campaign_timer",
    label: "טיימר קמפיין",
    hint: "הטיימר הקיים, לדדליין חג משותף לכולם.",
  },
];

export function PromoModeForm({ initial }: { initial: Mode }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initial);
  const [saving, setSaving] = useState(false);

  async function onSave() {
    setSaving(true);
    try {
      const res = await savePromoMode({ promo_mode: mode });
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
      <Button onClick={onSave} disabled={saving}>
        {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
        שמירה
      </Button>
    </div>
  );
}
