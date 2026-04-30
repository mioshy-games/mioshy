"use client";

/**
 * TemplateEditor - interactive editor for a single message template.
 *
 * Left: form for channel/subject/body (he + en) + activation toggle.
 * Right: live preview rendered with {{vars}} replaced by demo values.
 * Save → PATCH /api/admin/templates/[id]. Delete → DELETE.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

type Template = {
  id: string;
  key: string;
  channel: string;
  subject_he: string | null;
  subject_en: string | null;
  body_he: string;
  body_en: string;
  variables: string[] | null;
  trigger_axis: string | null;
  is_active: boolean;
};

const DEMO_VARS: Record<string, string | number> = {
  first_name: "דנה",
  friendship_score: 72,
  conflict_health: 58,
  passion_risk: 41,
  primary_love_language: "quality_time",
  top_gap: "turn_toward",
  language: "he",
};

function render(body: string, vars: Record<string, string | number | null | undefined>) {
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key) => {
    const v = vars[key];
    return v === undefined || v === null ? `{{${key}}}` : String(v);
  });
}

export function TemplateEditor({ template }: { template: Template }) {
  const router = useRouter();
  const [form, setForm] = useState<Template>(template);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [previewLocale, setPreviewLocale] = useState<"he" | "en">("he");

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/templates/${form.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          channel: form.channel,
          subject_he: form.subject_he,
          subject_en: form.subject_en,
          body_he: form.body_he,
          body_en: form.body_en,
          trigger_axis: form.trigger_axis,
          is_active: form.is_active,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(payload.error ?? "Save failed");
        return;
      }
      toast.success("Saved");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!confirm(`Delete template ${form.key}?`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/templates/${form.id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Delete failed");
        return;
      }
      toast.success("Deleted");
      router.push("/dashboard/templates");
    } finally {
      setDeleting(false);
    }
  }

  const subjectPreview = previewLocale === "he" ? form.subject_he ?? "" : form.subject_en ?? "";
  const bodyPreview = previewLocale === "he" ? form.body_he : form.body_en;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {form.key}
              <Badge variant={form.is_active ? "default" : "outline"}>
                {form.is_active ? "active" : "paused"}
              </Badge>
            </CardTitle>
            <CardDescription>Edit the template. Key is immutable after creation.</CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onDelete} disabled={deleting} aria-label="delete">
            <Trash2 className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Channel</Label>
              <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v ?? "" })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Trigger axis</Label>
              <Input
                value={form.trigger_axis ?? ""}
                onChange={(e) => setForm({ ...form, trigger_axis: e.target.value || null })}
                placeholder="(none)"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Subject (en)</Label>
            <Input
              value={form.subject_en ?? ""}
              onChange={(e) => setForm({ ...form, subject_en: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>נושא (he)</Label>
            <Input
              dir="rtl"
              value={form.subject_he ?? ""}
              onChange={(e) => setForm({ ...form, subject_he: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Body (en)</Label>
            <Textarea
              rows={8}
              value={form.body_en}
              onChange={(e) => setForm({ ...form, body_en: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>גוף (he)</Label>
            <Textarea
              rows={8}
              dir="rtl"
              value={form.body_he}
              onChange={(e) => setForm({ ...form, body_he: e.target.value })}
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={form.is_active}
                onCheckedChange={(c) => setForm({ ...form, is_active: c })}
              />
              Active
            </label>
            <Button onClick={save} disabled={saving}>
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>Rendered with demo variables. Values: {Object.entries(DEMO_VARS).map(([k, v]) => `${k}=${v}`).join(", ")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={previewLocale === "he" ? "default" : "outline"}
              onClick={() => setPreviewLocale("he")}
            >
              עברית
            </Button>
            <Button
              size="sm"
              variant={previewLocale === "en" ? "default" : "outline"}
              onClick={() => setPreviewLocale("en")}
            >
              English
            </Button>
          </div>
          <div
            dir={previewLocale === "he" ? "rtl" : "ltr"}
            className="rounded border bg-muted/50 p-4"
          >
            {form.channel === "email" && subjectPreview ? (
              <div className="mb-2 border-b pb-2 font-semibold">
                {render(subjectPreview, DEMO_VARS)}
              </div>
            ) : null}
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              {render(bodyPreview, DEMO_VARS)}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
