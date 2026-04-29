"use client";

import { useState, useRef, useTransition, useEffect } from "react";
import { toast } from "sonner";
import Image from "next/image";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { SiteSettingsRow } from "@/lib/types/database";
import { saveHomepageSettings } from "./actions";
import {
  HOMEPAGE_LINK_OPTIONS,
  CTA_STYLE_OPTIONS,
  HERO_TEMPLATE_OPTIONS,
  type HomepageSettingsPayload,
} from "./constants";
import {
  Upload,
  Trash2,
  ImageIcon,
  Loader2,
  ExternalLink,
  Check,
} from "lucide-react";

// ─── helpers ──────────────────────────────────────────────────────────────────

function str(v: string | null | undefined) {
  return v ?? "";
}

const BUCKET = "backgrounds";
const FOLDER = "homepage";

// ─── ImageUploader ─────────────────────────────────────────────────────────────
// Reusable component: shows current image, lets admin upload/replace/delete.

type ImageUploaderProps = {
  label: string;
  description?: string;
  currentUrl: string;
  onUrlChange: (url: string) => void;
  storageKey: string; // e.g. "hero", "expert", "article-0"
  aspect?: "hero" | "square" | "article";
};

function ImageUploader({
  label,
  description,
  currentUrl,
  onUrlChange,
  storageKey,
  aspect = "article",
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const aspectClass =
    aspect === "hero"
      ? "aspect-[21/9]"
      : aspect === "square"
        ? "aspect-square"
        : "aspect-[16/10]";

  async function handleFile(file: File) {
    if (!file) return;
    setUploading(true);
    try {
      const client = createBrowserSupabaseClient();
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${FOLDER}/${storageKey}-${Date.now()}.${ext}`;
      const { error } = await client.storage
        .from(BUCKET)
        .upload(path, file, { upsert: true, cacheControl: "86400" });
      if (error) throw error;
      const { data } = client.storage.from(BUCKET).getPublicUrl(path);
      onUrlChange(data.publicUrl);
      toast.success("Image uploaded — remember to Save all changes.");
    } catch (err: unknown) {
      toast.error(`Upload failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploading(false);
    }
  }

  async function handleClear() {
    if (!currentUrl) return;
    setClearing(true);
    onUrlChange("");
    setClearing(false);
    toast.info("Image cleared — remember to Save all changes.");
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {description && (
        <p className="text-muted-foreground text-xs">{description}</p>
      )}

      {/* Preview */}
      <div
        className={`relative w-full overflow-hidden rounded-xl border border-dashed border-border bg-muted ${aspectClass}`}
      >
        {currentUrl ? (
          <>
            <Image
              src={currentUrl}
              alt={label}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, 640px"
              unoptimized
            />
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity hover:opacity-100">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="mr-1 h-4 w-4" />
                Replace
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={handleClear}
                disabled={clearing}
              >
                <Trash2 className="mr-1 h-4 w-4" />
                Remove
              </Button>
            </div>
          </>
        ) : (
          <button
            type="button"
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : (
              <ImageIcon className="h-8 w-8" />
            )}
            <span className="text-sm font-medium">
              {uploading ? "Uploading…" : "Click to upload"}
            </span>
            <span className="text-xs">PNG, JPG, WebP, GIF</span>
          </button>
        )}
      </div>

      {/* Hidden file input — works on desktop AND mobile */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />

      {/* URL text field (manual paste / clear) */}
      <div className="flex gap-2">
        <Input
          value={currentUrl}
          onChange={(e) => onUrlChange(e.target.value)}
          placeholder="https://… or leave empty"
          className="flex-1 font-mono text-xs"
        />
        {currentUrl && (
          <a
            href={currentUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
        {currentUrl && (
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={handleClear}
            disabled={clearing}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
        <Button
          type="button"
          size="icon"
          variant="secondary"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── LinkSelect ────────────────────────────────────────────────────────────────

function LinkSelect({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  const known = HOMEPAGE_LINK_OPTIONS.find((o) => o.value === value);
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={(v) => v && onChange(v)}>
        <SelectTrigger>
          <SelectValue placeholder="Choose a link…" />
        </SelectTrigger>
        <SelectContent>
          {HOMEPAGE_LINK_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {/* Manual override */}
      {!known && (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Custom path…"
          className="font-mono text-xs"
        />
      )}
      {!known && value && (
        <p className="text-muted-foreground text-xs">Custom link (not in preset list)</p>
      )}
    </div>
  );
}

// ─── StyleSelect ───────────────────────────────────────────────────────────────

function StyleSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>Button style</Label>
      <Select value={value} onValueChange={(v) => v && onChange(v)}>
        <SelectTrigger>
          <SelectValue placeholder="Choose style…" />
        </SelectTrigger>
        <SelectContent>
          {CTA_STYLE_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ─── Bilingual pair ────────────────────────────────────────────────────────────

function BilingualField({
  label,
  heValue,
  enValue,
  onHeChange,
  onEnChange,
  placeholder,
  multiline,
}: {
  label: string;
  heValue: string;
  enValue: string;
  onHeChange: (v: string) => void;
  onEnChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs font-medium">🇮🇱 עברית</p>
          {multiline ? (
            <textarea
              dir="rtl"
              value={heValue}
              onChange={(e) => onHeChange(e.target.value)}
              placeholder={placeholder}
              rows={3}
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            />
          ) : (
            <Input
              dir="rtl"
              value={heValue}
              onChange={(e) => onHeChange(e.target.value)}
              placeholder={placeholder}
            />
          )}
        </div>
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs font-medium">🇺🇸 English</p>
          {multiline ? (
            <textarea
              value={enValue}
              onChange={(e) => onEnChange(e.target.value)}
              placeholder={placeholder}
              rows={3}
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            />
          ) : (
            <Input
              value={enValue}
              onChange={(e) => onEnChange(e.target.value)}
              placeholder={placeholder}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function HomepageAdminClient({
  settings,
}: {
  settings: SiteSettingsRow;
}) {
  const [isPending, startTransition] = useTransition();

  // ── Images state ───────────────────────────────────────────────────────────
  const [heroBgType, setHeroBgType] = useState<"gradient" | "image">(
    settings.home_hero_bg_type,
  );
  const [heroBgValue, setHeroBgValue] = useState(str(settings.home_hero_bg_value));
  const [expertUrl, setExpertUrl] = useState(str(settings.expert_photo_url));
  const [articleImg0, setArticleImg0] = useState(str(settings.home_article_img_0));
  const [articleImg1, setArticleImg1] = useState(str(settings.home_article_img_1));
  const [articleImg2, setArticleImg2] = useState(str(settings.home_article_img_2));

  // ── Hero text state ────────────────────────────────────────────────────────
  const [headlineHe, setHeadlineHe] = useState(str(settings.hero_headline_he));
  const [headlineEn, setHeadlineEn] = useState(str(settings.hero_headline_en));
  const [subHe, setSubHe] = useState(str(settings.hero_sub_he));
  const [subEn, setSubEn] = useState(str(settings.hero_sub_en));

  // ── CTA primary state ──────────────────────────────────────────────────────
  const [ctaPrimaryTextHe, setCtaPrimaryTextHe] = useState(str(settings.cta_primary_text_he));
  const [ctaPrimaryTextEn, setCtaPrimaryTextEn] = useState(str(settings.cta_primary_text_en));
  const [ctaPrimaryHref, setCtaPrimaryHref] = useState(
    str(settings.cta_primary_href) || "/games/truth-or-dare",
  );
  const [ctaPrimaryStyle, setCtaPrimaryStyle] = useState(
    str(settings.cta_primary_style) || "gradient",
  );

  // ── CTA secondary state ────────────────────────────────────────────────────
  const [ctaSecondaryTextHe, setCtaSecondaryTextHe] = useState(str(settings.cta_secondary_text_he));
  const [ctaSecondaryTextEn, setCtaSecondaryTextEn] = useState(str(settings.cta_secondary_text_en));
  const [ctaSecondaryHref, setCtaSecondaryHref] = useState(
    str(settings.cta_secondary_href) || "#games",
  );

  // ── Social proof state ─────────────────────────────────────────────────────
  const [couplesCount, setCouplesCount] = useState(
    String(settings.social_proof_couples_count ?? 0),
  );
  const [ratingValue, setRatingValue] = useState(
    String(settings.rating_value ?? 4.9),
  );
  const [ratingCount, setRatingCount] = useState(
    String(settings.rating_count ?? 0),
  );

  // ── Hero template state (E6) ───────────────────────────────────────────────
  const [heroTemplate, setHeroTemplate] = useState<
    "classic-dark" | "light-gradient"
  >(settings.hero_template === "light-gradient" ? "light-gradient" : "classic-dark");
  const [heroSideImageUrl, setHeroSideImageUrl] = useState(
    str(settings.hero_side_image_url),
  );

  // ── Save all ───────────────────────────────────────────────────────────────
  function handleSaveAll() {
    const payload: HomepageSettingsPayload = {
      home_hero_bg_type: heroBgType,
      home_hero_bg_value: heroBgType === "gradient" ? "default" : heroBgValue,
      expert_photo_url: expertUrl,
      home_article_img_0: articleImg0,
      home_article_img_1: articleImg1,
      home_article_img_2: articleImg2,
      hero_headline_he: headlineHe,
      hero_headline_en: headlineEn,
      hero_sub_he: subHe,
      hero_sub_en: subEn,
      cta_primary_text_he: ctaPrimaryTextHe,
      cta_primary_text_en: ctaPrimaryTextEn,
      cta_primary_href: ctaPrimaryHref,
      cta_primary_style: ctaPrimaryStyle,
      cta_secondary_text_he: ctaSecondaryTextHe,
      cta_secondary_text_en: ctaSecondaryTextEn,
      cta_secondary_href: ctaSecondaryHref,
      social_proof_couples_count: Number(couplesCount),
      rating_value: Number(ratingValue),
      rating_count: Number(ratingCount),

      hero_template: heroTemplate,
      hero_side_image_url: heroSideImageUrl,
    };

    startTransition(async () => {
      const res = await saveHomepageSettings(payload);
      if (res.ok) {
        toast.success("Homepage settings saved!");
      } else {
        toast.error(`Save failed: ${res.error}`);
      }
    });
  }

  // ── Tab config ────────────────────────────────────────────────────────────
  const TAB_CONFIG = [
    { value: "template", emoji: "🎨", label: "Template" },
    { value: "images",   emoji: "🖼",  label: "Images" },
    { value: "hero",     emoji: "✏️",  label: "Hero text" },
    { value: "buttons",  emoji: "🔘", label: "Buttons" },
    { value: "social",   emoji: "📊", label: "Social proof" },
  ] as const;

  const VALID_TABS = new Set(TAB_CONFIG.map((t) => t.value));

  // ── Active tab with URL persistence ───────────────────────────────────────
  const [activeTab, setActiveTab] = useState<string>("template");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab && VALID_TABS.has(tab as (typeof TAB_CONFIG)[number]["value"])) {
      setActiveTab(tab);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleTabChange(tab: string) {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState(null, "", url.toString());
  }

  return (
    <div className="space-y-6">
      {/* ── Sticky save bar ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 flex items-center justify-between rounded-xl border bg-card p-4 shadow-md">
        <p className="text-muted-foreground text-sm">
          Changes are applied to both 🇮🇱 Hebrew and 🇺🇸 English homepages.
        </p>
        <Button onClick={handleSaveAll} disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save all changes"
          )}
        </Button>
      </div>

      {/* flex-col forces the list above the panels — Base UI sets data-orientation="horizontal",
          not data-horizontal, so the component's own data-horizontal:flex-col never fires */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-col">
        {/* ── Tab navigation bar ──────────────────────────────────────────
            • Horizontal scroll on mobile so labels never truncate
            • Active tab: fuchsia bottom border + foreground text
            • Inactive: muted text, no background pill
        ─────────────────────────────────────────────────────────────────── */}
        <div className="overflow-x-auto border-b border-border">
          <TabsList className="inline-flex h-auto w-max min-w-full items-stretch justify-start gap-0 rounded-none bg-transparent p-0">
            {TAB_CONFIG.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className={[
                  // Base
                  "relative flex h-11 shrink-0 items-center gap-1.5 rounded-none",
                  "px-4 text-sm font-medium whitespace-nowrap",
                  // Colours — Base UI uses data-active (not data-[state=active])
                  "text-muted-foreground hover:text-foreground",
                  "data-active:text-foreground",
                  // Active indicator — bottom border
                  "border-b-2 border-transparent",
                  "data-active:border-fuchsia-500",
                  // Remove default active shadow/bg
                  "data-active:shadow-none data-active:bg-transparent",
                  // Smooth colour transition
                  "transition-colors duration-150",
                ].join(" ")}
              >
                <span aria-hidden="true">{tab.emoji}</span>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* ════════════════════ TEMPLATE TAB (E6) ═══════════════════════ */}
        <TabsContent value="template" className="mt-6 outline-none">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left: template picker */}
            <Card>
              <CardHeader>
                <CardTitle>Hero template</CardTitle>
                <CardDescription>
                  Choose the homepage hero layout. The text, CTAs and images you
                  set in the other tabs are shared by both templates.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  {HERO_TEMPLATE_OPTIONS.map((opt) => {
                    const isActive = heroTemplate === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setHeroTemplate(opt.value)}
                        className={`group relative flex flex-col overflow-hidden rounded-2xl border-2 text-left transition ${
                          isActive
                            ? "border-fuchsia-500 ring-2 ring-fuchsia-200"
                            : "border-border hover:border-fuchsia-300"
                        }`}
                      >
                        {/* Mini-preview */}
                        <div
                          className={`relative flex h-32 items-center justify-center ${opt.preview}`}
                        >
                          <div className="relative z-10 text-center">
                            <p className="text-sm font-bold">Mioshy</p>
                            <span
                              className={`mt-2 inline-flex rounded-full bg-gradient-to-r ${opt.accent} px-3 py-1 text-[10px] font-semibold text-white`}
                            >
                              Start now
                            </span>
                          </div>
                          {isActive ? (
                            <span className="absolute end-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-fuchsia-500 text-white shadow">
                              <Check className="h-3.5 w-3.5" />
                            </span>
                          ) : null}
                        </div>
                        <div className="space-y-1 bg-background p-3">
                          <p className="text-sm font-semibold">{opt.label}</p>
                          <p className="text-muted-foreground text-xs">
                            {opt.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="text-muted-foreground text-xs">
                  Selected:{" "}
                  <span className="font-semibold text-foreground">
                    {
                      HERO_TEMPLATE_OPTIONS.find((o) => o.value === heroTemplate)
                        ?.label
                    }
                  </span>{" "}
                  — press <em>Save all changes</em> to publish.
                </p>
              </CardContent>
            </Card>

            {/* Right: side image (always visible; dimmed when not applicable) */}
            <Card className={heroTemplate !== "classic-dark" ? "opacity-50 pointer-events-none select-none" : ""}>
              <CardHeader>
                <CardTitle>Side image</CardTitle>
                <CardDescription>
                  {heroTemplate === "classic-dark"
                    ? "Optional circular image shown alongside the hero copy. When empty, a rotating gradient wheel placeholder is rendered. Recommended: square image, 512×512px."
                    : "Only used by the Classic dark template. Switch template to enable."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ImageUploader
                  label="Hero side image"
                  description="Appears on the start-side column in the classic-dark template."
                  currentUrl={heroSideImageUrl}
                  onUrlChange={setHeroSideImageUrl}
                  storageKey="hero-side"
                  aspect="square"
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ════════════════════ IMAGES TAB ════════════════════ */}
        <TabsContent value="images" className="mt-6 space-y-6 outline-none">

          {/* Row 1: Hero background + Expert photo */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Hero background</CardTitle>
                <CardDescription>
                  The full-width background of the homepage hero section.
                  Upload an image or keep the default purple gradient.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant={heroBgType === "gradient" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setHeroBgType("gradient")}
                  >
                    Gradient (default)
                  </Button>
                  <Button
                    type="button"
                    variant={heroBgType === "image" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setHeroBgType("image")}
                  >
                    Custom image
                  </Button>
                </div>
                {heroBgType === "image" && (
                  <ImageUploader
                    label="Hero background image"
                    description="Recommended: at least 1920×1080px. Will be darkened with overlay."
                    currentUrl={heroBgValue}
                    onUrlChange={setHeroBgValue}
                    storageKey="hero-bg"
                    aspect="hero"
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Expert photo</CardTitle>
                <CardDescription>
                  The photo shown in the &ldquo;Meet the expert&rdquo; section.
                  Recommended: 400×500px portrait.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ImageUploader
                  label="Expert photo"
                  description="400×500px portrait recommended. Shows in the Expert section."
                  currentUrl={expertUrl}
                  onUrlChange={setExpertUrl}
                  storageKey="expert-photo"
                  aspect="square"
                />
              </CardContent>
            </Card>
          </div>

          {/* Row 2: Article card images — 3 columns */}
          <Card>
            <CardHeader>
              <CardTitle>Article card images</CardTitle>
              <CardDescription>
                The three preview images shown in the homepage Articles section.
                Recommended: 640×400px, 16:10 ratio.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 sm:grid-cols-3">
                <ImageUploader
                  label="Article card 1"
                  description="640×400px recommended."
                  currentUrl={articleImg0}
                  onUrlChange={setArticleImg0}
                  storageKey="article-card-0"
                  aspect="article"
                />
                <ImageUploader
                  label="Article card 2"
                  description="640×400px recommended."
                  currentUrl={articleImg1}
                  onUrlChange={setArticleImg1}
                  storageKey="article-card-1"
                  aspect="article"
                />
                <ImageUploader
                  label="Article card 3"
                  description="640×400px recommended."
                  currentUrl={articleImg2}
                  onUrlChange={setArticleImg2}
                  storageKey="article-card-2"
                  aspect="article"
                />
              </div>
            </CardContent>
          </Card>

        </TabsContent>

        {/* ════════════════════ HERO TEXT TAB ════════════════════ */}
        <TabsContent value="hero" className="mt-6 space-y-6 outline-none">
          <Card>
            <CardHeader>
              <CardTitle>Hero headline</CardTitle>
              <CardDescription>
                The big headline in the hero section. Leave empty to use the
                default from the language file.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <BilingualField
                label="Headline"
                heValue={headlineHe}
                enValue={headlineEn}
                onHeChange={setHeadlineHe}
                onEnChange={setHeadlineEn}
                placeholder="Leave empty to use default…"
              />
              <BilingualField
                label="Subtitle / subheadline"
                heValue={subHe}
                enValue={subEn}
                onHeChange={setSubHe}
                onEnChange={setSubEn}
                placeholder="Leave empty to use default…"
                multiline
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ════════════════════ BUTTONS TAB ════════════════════ */}
        <TabsContent value="buttons" className="mt-6 outline-none">
          <div className="grid gap-6 lg:grid-cols-2">

          {/* Primary CTA */}
          <Card>
            <CardHeader>
              <CardTitle>Primary CTA button</CardTitle>
              <CardDescription>
                The main action button in the hero. Recommended: link to a
                game or the games page.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <BilingualField
                label="Button text"
                heValue={ctaPrimaryTextHe}
                enValue={ctaPrimaryTextEn}
                onHeChange={setCtaPrimaryTextHe}
                onEnChange={setCtaPrimaryTextEn}
                placeholder="e.g. Play for free"
              />
              <LinkSelect
                label="Link destination"
                value={ctaPrimaryHref}
                onChange={setCtaPrimaryHref}
              />
              <StyleSelect
                value={ctaPrimaryStyle}
                onChange={setCtaPrimaryStyle}
              />
              {/* Live preview */}
              <div className="space-y-1.5">
                <Label>Preview</Label>
                <div className="rounded-xl border border-dashed p-4">
                  <button
                    type="button"
                    className={`inline-flex min-h-[52px] items-center justify-center rounded-full px-8 text-sm font-semibold text-white transition ${
                      ctaPrimaryStyle === "gradient"
                        ? "bg-gradient-to-r from-fuchsia-500 via-purple-500 to-pink-500"
                        : ctaPrimaryStyle === "gradient-rose"
                          ? "bg-gradient-to-r from-rose-500 to-pink-500"
                          : ctaPrimaryStyle === "gradient-purple"
                            ? "bg-gradient-to-r from-purple-700 to-indigo-600"
                            : ctaPrimaryStyle === "solid-white"
                              ? "bg-white text-black"
                              : "border border-purple-400/60 bg-purple-500/20"
                    }`}
                  >
                    {ctaPrimaryTextHe || "כפתור ראשי"}
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Secondary CTA */}
          <Card>
            <CardHeader>
              <CardTitle>Secondary CTA button</CardTitle>
              <CardDescription>
                The outline button next to the primary. Usually links to the
                games section (#games) or games page.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <BilingualField
                label="Button text"
                heValue={ctaSecondaryTextHe}
                enValue={ctaSecondaryTextEn}
                onHeChange={setCtaSecondaryTextHe}
                onEnChange={setCtaSecondaryTextEn}
                placeholder="e.g. Discover the games"
              />
              <LinkSelect
                label="Link destination"
                value={ctaSecondaryHref}
                onChange={setCtaSecondaryHref}
              />
              {/* Preview */}
              <div className="space-y-1.5">
                <Label>Preview</Label>
                <div className="rounded-xl border border-dashed bg-slate-900 p-4">
                  <button
                    type="button"
                    className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-purple-400/30 bg-purple-500/10 px-8 text-sm font-semibold text-white/90 backdrop-blur-md"
                  >
                    {ctaSecondaryTextHe || "גלו את המשחקים"}
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          </div>
        </TabsContent>

        {/* ════════════════════ SOCIAL PROOF TAB ════════════════════ */}
        <TabsContent value="social" className="mt-6 space-y-6 outline-none">
          <Card>
            <CardHeader>
              <CardTitle>Social proof numbers</CardTitle>
              <CardDescription>
                Numbers shown in the social proof bar and star-rating block on
                the homepage.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Couples count</Label>
                <Input
                  type="number"
                  min={0}
                  value={couplesCount}
                  onChange={(e) => setCouplesCount(e.target.value)}
                  placeholder="0"
                />
                <p className="text-muted-foreground text-xs">
                  Shown as &ldquo;X+ couples already using Mioshy&rdquo;
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Rating value</Label>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  step={0.1}
                  value={ratingValue}
                  onChange={(e) => setRatingValue(e.target.value)}
                  placeholder="4.9"
                />
                <p className="text-muted-foreground text-xs">
                  Star rating out of 5 (e.g. 4.9)
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Rating count</Label>
                <Input
                  type="number"
                  min={0}
                  value={ratingCount}
                  onChange={(e) => setRatingCount(e.target.value)}
                  placeholder="0"
                />
                <p className="text-muted-foreground text-xs">
                  Number of reviews (shown next to stars)
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      {/* Bottom save button */}
      <div className="flex justify-end pt-4">
        <Button
          size="lg"
          onClick={handleSaveAll}
          disabled={isPending}
          className="min-w-[200px]"
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Saving…
            </>
          ) : (
            "💾 Save all changes"
          )}
        </Button>
      </div>
    </div>
  );
}
