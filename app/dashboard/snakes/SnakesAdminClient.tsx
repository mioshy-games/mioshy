"use client";

import { useMemo, useState, useTransition, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { SnakesConfig } from "./components/types";
import { ConfigManager } from "./components/ConfigManager";
import { SnakeEditor } from "./components/SnakeEditor";
import { LadderEditor } from "./components/LadderEditor";
import { QuestionEditor } from "./components/QuestionEditor";
import { CoinEditor } from "./components/CoinEditor";
import { PenaltyEditor } from "./components/PenaltyEditor";
import { BoardPreview } from "./components/BoardPreview";
import { updateSnakesConfig } from "@/app/dashboard/actions/snakes";

// ─── helpers ──────────────────────────────────────────────────────────────────

function str(v: string | null | undefined) {
  return v ?? "";
}

// ─── BilingualField ────────────────────────────────────────────────────────────

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
              className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
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
              className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
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

// ─── SettingsPanel ─────────────────────────────────────────────────────────────

function SettingsPanel({ cfg }: { cfg: SnakesConfig }) {
  const [isPending, startTransition] = useTransition();

  const [slug, setSlug]             = useState(str(cfg.slug));
  const [nameHe, setNameHe]         = useState(str(cfg.game_name_he));
  const [nameEn, setNameEn]         = useState(str(cfg.game_name_en));
  const [titleHe, setTitleHe]       = useState(str(cfg.meta_title_he));
  const [titleEn, setTitleEn]       = useState(str(cfg.meta_title_en));
  const [descHe, setDescHe]         = useState(str(cfg.meta_description_he));
  const [descEn, setDescEn]         = useState(str(cfg.meta_description_en));

  // Reset fields whenever a different config is selected
  useEffect(() => {
    setSlug(str(cfg.slug));
    setNameHe(str(cfg.game_name_he));
    setNameEn(str(cfg.game_name_en));
    setTitleHe(str(cfg.meta_title_he));
    setTitleEn(str(cfg.meta_title_en));
    setDescHe(str(cfg.meta_description_he));
    setDescEn(str(cfg.meta_description_en));
  }, [cfg.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSave() {
    startTransition(async () => {
      const res = await updateSnakesConfig(cfg.id, {
        slug:                 slug.trim(),
        game_name_he:         nameHe,
        game_name_en:         nameEn,
        meta_title_he:        titleHe,
        meta_title_en:        titleEn,
        meta_description_he:  descHe,
        meta_description_en:  descEn,
      });
      if (res.ok) toast.success("Settings saved!");
      else        toast.error(`Save failed: ${res.error}`);
    });
  }

  const SaveBtn = ({ size = "default" as "default" | "lg" }) => (
    <Button onClick={handleSave} disabled={isPending} size={size}>
      {isPending ? (
        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</>
      ) : (
        "💾 Save settings"
      )}
    </Button>
  );

  return (
    <div className="space-y-6">

      {/* ── Top save bar ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between rounded-xl border bg-card p-4 shadow-sm">
        <p className="text-muted-foreground text-sm">
          Game identity &amp; SEO - 🇮🇱 Hebrew + 🇺🇸 English
        </p>
        <SaveBtn />
      </div>

      {/* ── Slug ──────────────────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <Label>Slug</Label>
        <Input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="snakes-and-ladders-couples"
          className="font-mono"
        />
        <p className="text-muted-foreground text-xs">
          URL path - lowercase, hyphens only. E.g.{" "}
          <code className="font-mono">/games/snakes-and-ladders-couples</code>
        </p>
      </div>

      {/* ── Game name ─────────────────────────────────────────────────────── */}
      <BilingualField
        label="Game name"
        heValue={nameHe}
        enValue={nameEn}
        onHeChange={setNameHe}
        onEnChange={setNameEn}
        placeholder="e.g. נחש וסולם זוגי"
      />

      {/* ── Meta title ────────────────────────────────────────────────────── */}
      <BilingualField
        label="Meta title (SEO)"
        heValue={titleHe}
        enValue={titleEn}
        onHeChange={setTitleHe}
        onEnChange={setTitleEn}
        placeholder="50–60 characters recommended"
      />

      {/* ── Meta description ──────────────────────────────────────────────── */}
      <BilingualField
        label="Meta description (SEO)"
        heValue={descHe}
        enValue={descEn}
        onHeChange={setDescHe}
        onEnChange={setDescEn}
        placeholder="120–160 characters recommended"
        multiline
      />

      {/* ── Bottom save button ────────────────────────────────────────────── */}
      <div className="flex justify-end pt-2">
        <SaveBtn size="lg" />
      </div>

    </div>
  );
}

// ─── Tab config ────────────────────────────────────────────────────────────────

// Tabs visible to admins.
//
// Snakes / Ladders / Coin / Penalties were hidden 2026-05-17: the board
// mechanics are now hardcoded in `lib/snakes/defaultConfig.ts` and the
// loader ignores any DB value for those columns. Leaving the tabs in
// would imply they affect gameplay (they don't) and would mislead the
// admin. The underlying editor components + server-action fields are
// intentionally kept in place so we can re-enable any tab in one line
// if we ever want admins to tune mechanics again.
const TAB_CONFIG = [
  { value: "settings",  emoji: "⚙️",  label: "הגדרות"    },
  { value: "preview",   emoji: "👁",   label: "Preview"   },
  { value: "questions", emoji: "❓",   label: "Questions" },
] as const;

const VALID_TABS = new Set(TAB_CONFIG.map((t) => t.value));

// ─── Main component ────────────────────────────────────────────────────────────

export function SnakesAdminClient({ configs }: { configs: SnakesConfig[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(
    configs.find((c) => c.is_active)?.id ?? configs[0]?.id ?? null,
  );

  const selected = useMemo(
    () => configs.find((c) => c.id === selectedId) ?? null,
    [configs, selectedId],
  );

  // ── Active tab with URL persistence ────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<string>("settings");

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
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Snakes &amp; Ladders</h1>
        <p className="text-muted-foreground text-sm">
          Full config editor - active config is used for new rooms.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">

        {/* ── Left: config list ─────────────────────────────────────────── */}
        <div className="rounded-2xl border p-4">
          <ConfigManager
            configs={configs}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>

        {/* ── Right: tabbed editor ──────────────────────────────────────── */}
        <div className="rounded-2xl border p-4">
          {selected ? (
            <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-col">

              {/* ── Tab navigation bar - homepage style ─────────────────
                  Horizontal scroll on mobile · fuchsia underline on active
              ──────────────────────────────────────────────────────────── */}
              <div className="overflow-x-auto border-b border-border">
                <TabsList className="inline-flex h-auto w-max min-w-full items-stretch justify-start gap-0 rounded-none bg-transparent p-0">
                  {TAB_CONFIG.map((tab) => (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className={[
                        "relative flex h-11 shrink-0 items-center gap-1.5 rounded-none",
                        "px-4 text-sm font-medium whitespace-nowrap",
                        "text-muted-foreground hover:text-foreground",
                        "data-active:text-foreground",
                        "border-b-2 border-transparent",
                        "data-active:border-fuchsia-500",
                        "data-active:shadow-none data-active:bg-transparent",
                        "transition-colors duration-150",
                      ].join(" ")}
                    >
                      <span aria-hidden="true">{tab.emoji}</span>
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              {/* ── Tab content panels ──────────────────────────────────── */}

              <TabsContent value="settings" className="mt-6 outline-none">
                <SettingsPanel cfg={selected} />
              </TabsContent>

              <TabsContent value="preview" className="mt-6 outline-none">
                <BoardPreview cfg={selected} />
              </TabsContent>

              <TabsContent value="snakes" className="mt-6 outline-none">
                <SnakeEditor cfg={selected} />
              </TabsContent>

              <TabsContent value="ladders" className="mt-6 outline-none">
                <LadderEditor cfg={selected} />
              </TabsContent>

              <TabsContent value="questions" className="mt-6 outline-none">
                <QuestionEditor cfg={selected} />
              </TabsContent>

              <TabsContent value="coin" className="mt-6 outline-none">
                <CoinEditor cfg={selected} />
              </TabsContent>

              <TabsContent value="penalty" className="mt-6 outline-none">
                <PenaltyEditor cfg={selected} />
              </TabsContent>

            </Tabs>
          ) : (
            <div className="text-muted-foreground text-sm">Select a config…</div>
          )}
        </div>

      </div>
    </div>
  );
}
