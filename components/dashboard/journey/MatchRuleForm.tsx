"use client";

/**
 * MatchRuleForm
 * ───────────────────────────────────────────────────────────
 * Edit form for a single journey_match_rules row. Layer-1 scope
 * — only label + rationale + priority + is_active are editable.
 *
 * The user-facing rationale (HE + EN) is the most important
 * field on this form. It's what gets rendered under "Why this
 * item?" on every scheduled item attributed to this rule.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { updateMatchRule } from "@/app/dashboard/actions/match-rules";

interface Defaults {
  label_he:     string;
  label_en:     string;
  rationale_he: string;
  rationale_en: string;
  priority:     number;
  is_active:    boolean;
}

export function MatchRuleForm({
  ruleId,
  defaults,
}: {
  ruleId: string;
  defaults: Defaults;
}) {
  const router = useRouter();
  const [labelHe,     setLabelHe]     = useState(defaults.label_he);
  const [labelEn,     setLabelEn]     = useState(defaults.label_en);
  const [rationaleHe, setRationaleHe] = useState(defaults.rationale_he);
  const [rationaleEn, setRationaleEn] = useState(defaults.rationale_en);
  const [priority,    setPriority]    = useState(defaults.priority);
  const [isActive,    setIsActive]    = useState(defaults.is_active);
  const [saving,      setSaving]      = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await updateMatchRule(ruleId, {
      label_he: labelHe,
      label_en: labelEn,
      rationale_he: rationaleHe,
      rationale_en: rationaleEn,
      priority,
      is_active: isActive,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(`Save failed: ${res.error}`);
      return;
    }
    toast.success("Rule saved");
    router.refresh();
  }

  return (
    <form className="space-y-6" onSubmit={(e) => void handleSubmit(e)}>
      {/* Sticky save bar */}
      <div className="bg-background/95 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-20 -mx-4 flex items-center justify-between gap-3 border-b px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-md sm:border sm:px-4">
        <div className="flex items-center gap-3">
          <Switch
            id="is_active"
            checked={isActive}
            onCheckedChange={setIsActive}
          />
          <Label htmlFor="is_active" className="cursor-pointer text-sm">
            {isActive ? "Active" : "Off"}
          </Label>
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="me-2 size-4 animate-spin" /> Saving…
            </>
          ) : (
            "Save"
          )}
        </Button>
      </div>

      {/* Labels */}
      <section className="space-y-4 rounded-md border p-4">
        <header className="space-y-1">
          <h2 className="text-sm font-semibold">Labels (admin-only)</h2>
          <p className="text-muted-foreground text-xs">
            Used in the admin list and traces. Not shown to users.
          </p>
        </header>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="label_he">Hebrew label</Label>
            <Input
              id="label_he"
              value={labelHe}
              onChange={(e) => setLabelHe(e.target.value)}
              dir="rtl"
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="label_en">English label</Label>
            <Input
              id="label_en"
              value={labelEn}
              onChange={(e) => setLabelEn(e.target.value)}
              maxLength={120}
            />
          </div>
        </div>
      </section>

      {/* Rationale - the user-facing text */}
      <section className="space-y-4 rounded-md border p-4">
        <header className="space-y-1">
          <h2 className="text-sm font-semibold">
            Rationale shown to user (Why this item?)
          </h2>
          <p className="text-muted-foreground text-xs">
            Keep under ~80 chars where possible. Warm tone, specific to
            why this item reached this user. Do not start with capital
            letters or emojis — the surrounding UI already provides
            context.
          </p>
        </header>
        <div className="space-y-1.5">
          <Label htmlFor="rationale_he">Hebrew rationale</Label>
          <Textarea
            id="rationale_he"
            value={rationaleHe}
            onChange={(e) => setRationaleHe(e.target.value)}
            dir="rtl"
            rows={3}
            maxLength={500}
          />
          <p className="text-muted-foreground text-[11px]">
            {rationaleHe.length} / 500 chars
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rationale_en">English rationale</Label>
          <Textarea
            id="rationale_en"
            value={rationaleEn}
            onChange={(e) => setRationaleEn(e.target.value)}
            rows={3}
            maxLength={500}
          />
          <p className="text-muted-foreground text-[11px]">
            {rationaleEn.length} / 500 chars
          </p>
        </div>
      </section>

      {/* Priority */}
      <section className="space-y-4 rounded-md border p-4">
        <header className="space-y-1">
          <h2 className="text-sm font-semibold">Evaluation priority</h2>
          <p className="text-muted-foreground text-xs">
            Higher priority rules win conflicts. Defaults: manual=250,
            day-1=200, expert=220, priority-top1=150, system=100.
          </p>
        </header>
        <div className="space-y-1.5">
          <Label htmlFor="priority">Priority (0-1000)</Label>
          <Input
            id="priority"
            type="number"
            min={0}
            max={1000}
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
            className="max-w-[140px]"
          />
        </div>
      </section>
    </form>
  );
}
