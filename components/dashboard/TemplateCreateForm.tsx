"use client";

/**
 * Inline creation form for new message templates.
 * Posts to /api/admin/templates. On success, navigates to the editor for
 * the newly-created template.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const AXES = [
  "",
  "love_map",
  "fondness",
  "turn_toward",
  "positive_sentiment",
  "accept_influence",
  "solve_solvable",
  "overcome_gridlock",
  "shared_meaning",
  "criticism",
  "contempt",
  "defensiveness",
  "stonewalling",
  "words_of_affirmation",
  "quality_time",
  "acts_of_service",
  "gifts",
  "physical_touch",
  "autonomy",
  "anticipation",
  "play",
];

export function TemplateCreateForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    key: "",
    channel: "email",
    subject_he: "",
    subject_en: "",
    body_he: "",
    body_en: "",
    trigger_axis: "",
  });
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/templates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          trigger_axis: form.trigger_axis || null,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(payload.error ?? "Failed to create");
        return;
      }
      toast.success("Template created");
      router.push(`/dashboard/templates/${payload.template.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div className="space-y-1.5">
        <Label>Key</Label>
        <Input
          required
          value={form.key}
          onChange={(e) => setForm({ ...form, key: e.target.value })}
          placeholder="w00_welcome_personalized"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Channel</Label>
        <Select
          value={form.channel}
          // Radix Select's onValueChange types `v` as string | null (null when
          // the value is cleared). The form state holds `channel` as a plain
          // string, so coerce: empty string == "no value".
          onValueChange={(v) => setForm({ ...form, channel: v ?? "" })}
        >
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
        <Label>Trigger axis (optional)</Label>
        <Select
          value={form.trigger_axis}
          onValueChange={(v) => setForm({ ...form, trigger_axis: v ?? "" })}
        >
          <SelectTrigger>
            <SelectValue placeholder="- none -" />
          </SelectTrigger>
          <SelectContent>
            {AXES.map((a) => (
              <SelectItem key={a || "none"} value={a}>
                {a || "- none -"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Subject (en)</Label>
        <Input
          value={form.subject_en}
          onChange={(e) => setForm({ ...form, subject_en: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label>נושא (he)</Label>
        <Input
          dir="rtl"
          value={form.subject_he}
          onChange={(e) => setForm({ ...form, subject_he: e.target.value })}
        />
      </div>
      <div className="space-y-1.5 md:col-span-2">
        <Label>Body (en)</Label>
        <Textarea
          required
          rows={5}
          value={form.body_en}
          onChange={(e) => setForm({ ...form, body_en: e.target.value })}
        />
      </div>
      <div className="space-y-1.5 md:col-span-2">
        <Label>גוף (he)</Label>
        <Textarea
          required
          rows={5}
          dir="rtl"
          value={form.body_he}
          onChange={(e) => setForm({ ...form, body_he: e.target.value })}
        />
      </div>
      <div className="md:col-span-2 flex justify-end">
        <Button type="submit" disabled={submitting}>
          Create template
        </Button>
      </div>
    </form>
  );
}
