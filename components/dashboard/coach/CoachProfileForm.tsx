"use client";

/**
 * CoachProfileForm
 * ─────────────────────────────────────────────────────────
 * Form for editing the coach's client-facing persona.
 *
 * Three sections:
 *   1. Names — HE required, EN optional fallback
 *   2. Avatar URL — paste a Supabase storage URL (file upload
 *      is V2 — Layer 2 ships URL-only to keep scope tight)
 *   3. Short bio — two short lines clients see on first message tap
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { updateCoachPersona } from "@/app/dashboard/actions/coach-persona";

interface Defaults {
  display_name_he: string;
  display_name_en: string;
  avatar_url:      string;
  short_bio_he:    string;
  short_bio_en:    string;
}

export function CoachProfileForm({ defaults }: { defaults: Defaults }) {
  const router = useRouter();
  const [displayNameHe, setDisplayNameHe] = useState(defaults.display_name_he);
  const [displayNameEn, setDisplayNameEn] = useState(defaults.display_name_en);
  const [avatarUrl,     setAvatarUrl]     = useState(defaults.avatar_url);
  const [shortBioHe,    setShortBioHe]    = useState(defaults.short_bio_he);
  const [shortBioEn,    setShortBioEn]    = useState(defaults.short_bio_en);
  const [saving,        setSaving]        = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await updateCoachPersona({
      display_name_he: displayNameHe,
      display_name_en: displayNameEn || null,
      avatar_url:      avatarUrl || null,
      short_bio_he:    shortBioHe || null,
      short_bio_en:    shortBioEn || null,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(`Save failed: ${res.error}`);
      return;
    }
    toast.success("Saved");
    router.refresh();
  };

  return (
    <form className="space-y-6" onSubmit={(e) => void handleSubmit(e)}>
      {/* Sticky save bar */}
      <div className="bg-background/95 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-20 -mx-4 flex items-center justify-between gap-3 border-b px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-md sm:border sm:px-4">
        <div className="text-sm text-muted-foreground">
          Changes go live immediately on every client surface.
        </div>
        <Button type="submit" disabled={saving || !displayNameHe.trim()}>
          {saving ? (
            <>
              <Loader2 className="me-2 size-4 animate-spin" /> Saving…
            </>
          ) : (
            "Save"
          )}
        </Button>
      </div>

      {/* Section 1 — display names */}
      <section className="space-y-4 rounded-md border p-4">
        <header className="space-y-1">
          <h2 className="text-sm font-semibold">Display name</h2>
          <p className="text-muted-foreground text-xs">
            What clients see — first names work best. Avoid titles
            and last names; the goal is closeness, not authority.
          </p>
        </header>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="display_name_he">
              Hebrew name <span className="text-rose-400">*</span>
            </Label>
            <Input
              id="display_name_he"
              value={displayNameHe}
              onChange={(e) => setDisplayNameHe(e.target.value)}
              dir="rtl"
              maxLength={60}
              placeholder="יעל"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="display_name_en">English name</Label>
            <Input
              id="display_name_en"
              value={displayNameEn}
              onChange={(e) => setDisplayNameEn(e.target.value)}
              maxLength={60}
              placeholder="Yael"
            />
            <p className="text-muted-foreground text-[11px]">
              If empty, English-locale clients see the Hebrew name.
            </p>
          </div>
        </div>
      </section>

      {/* Section 2 — avatar URL */}
      <section className="space-y-4 rounded-md border p-4">
        <header className="space-y-1">
          <h2 className="text-sm font-semibold">Avatar URL</h2>
          <p className="text-muted-foreground text-xs">
            Paste a Supabase Storage URL (or any public image URL).
            Square photos render best at 200×200. If empty, clients
            see a colored circle with your initial.
          </p>
        </header>
        <div className="flex items-start gap-4">
          <div className="space-y-1.5 flex-1">
            <Label htmlFor="avatar_url">URL</Label>
            <Input
              id="avatar_url"
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              maxLength={800}
              placeholder="https://…"
            />
          </div>
          {/* Live preview */}
          <div className="shrink-0 pt-6">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt=""
                className="h-16 w-16 rounded-full border-2 border-white/15 object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <span
                aria-hidden
                className="flex h-16 w-16 items-center justify-center rounded-full text-[24px] font-bold text-white"
                style={{
                  background:
                    "linear-gradient(135deg, #B83C4D 0%, #6C2E40 100%)",
                }}
              >
                {(displayNameHe || displayNameEn || "?").slice(0, 1)}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Section 3 — short bio */}
      <section className="space-y-4 rounded-md border p-4">
        <header className="space-y-1">
          <h2 className="text-sm font-semibold">Short bio</h2>
          <p className="text-muted-foreground text-xs">
            Two warm lines about your approach. Clients see this once
            (on the first reveal of your profile). Keep it human — what
            you bring, not what you sell.
          </p>
        </header>
        <div className="space-y-1.5">
          <Label htmlFor="short_bio_he">Hebrew bio</Label>
          <Textarea
            id="short_bio_he"
            value={shortBioHe}
            onChange={(e) => setShortBioHe(e.target.value)}
            dir="rtl"
            rows={3}
            maxLength={280}
            placeholder="טיפלתי בזוגות 12 שנה, אוהבת תקשורת ישירה ואת הרגעים הקטנים ששוברים את הקרח."
          />
          <p className="text-muted-foreground text-[11px]">
            {shortBioHe.length} / 280
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="short_bio_en">English bio</Label>
          <Textarea
            id="short_bio_en"
            value={shortBioEn}
            onChange={(e) => setShortBioEn(e.target.value)}
            rows={3}
            maxLength={280}
            placeholder="12 years working with couples. I love direct communication and the small moments that break the ice."
          />
          <p className="text-muted-foreground text-[11px]">
            {shortBioEn.length} / 280
          </p>
        </div>
      </section>
    </form>
  );
}
