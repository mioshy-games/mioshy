"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  saveTrialSettings,
  type TrialSettingsFormValues,
} from "@/app/dashboard/actions/trial-settings";

type Row = TrialSettingsFormValues["rows"][number];

// Stable identity + Hebrew label for each eligible package.
const PACKAGES: Array<{ product: "games" | "journey"; coaching: boolean; label: string; hint: string }> = [
  { product: "games",   coaching: false, label: "משחקים",           hint: "מנוי המשחקים" },
  { product: "journey", coaching: true,  label: "המסע — עם ליווי",  hint: "מנוי המסע כולל ליווי מומחה" },
  { product: "journey", coaching: false, label: "המסע — בלי ליווי", hint: "מנוי המסע ללא ליווי" },
];

function keyOf(r: { product: string; coaching: boolean }) {
  return `${r.product}:${r.coaching}`;
}

export function TrialSettingsForm({ initial }: { initial: Row[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<Row[]>(() =>
    PACKAGES.map((p) => {
      const found = initial.find((r) => r.product === p.product && r.coaching === p.coaching);
      return { product: p.product, coaching: p.coaching, enabled: found?.enabled ?? false };
    }),
  );

  function toggle(k: string, enabled: boolean) {
    setRows((prev) => prev.map((r) => (keyOf(r) === k ? { ...r, enabled } : r)));
  }

  async function onSave() {
    setSaving(true);
    try {
      const res = await saveTrialSettings({ rows });
      if (res?.ok) {
        toast.success("הגדרות הטריאל נשמרו");
        router.refresh();
      } else {
        const msg = res?.error?._root?.[0] ?? "שמירה נכשלה";
        toast.error(msg);
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
        {PACKAGES.map((p) => {
          const k = keyOf(p);
          const row = rows.find((r) => keyOf(r) === k)!;
          return (
            <div key={k} className="flex items-center justify-between gap-4 p-4">
              <div>
                <div className="font-medium">{p.label}</div>
                <div className="text-sm text-muted-foreground">{p.hint}</div>
              </div>
              <Switch
                checked={row.enabled}
                onCheckedChange={(checked: boolean) => toggle(k, checked)}
                aria-label={`הפעל טריאל ל${p.label}`}
              />
            </div>
          );
        })}
      </div>

      <p className="text-sm text-muted-foreground">
        כשטריאל מופעל לחבילה, כפתור ההרשמה שלה הופך ל־&ldquo;7 ימי ניסיון חינם&rdquo; —
        הלקוח מזין כרטיס (מאומת בלבד, ללא חיוב וללא hold) ומחויב בפעם הראשונה רק ביום ה־7.
      </p>

      <Button onClick={onSave} disabled={saving}>
        {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
        שמירה
      </Button>
    </div>
  );
}
