"use client";

/**
 * components/dashboard/OpensAtField.tsx
 *
 * Work-order 2026-06-15, part D — admin control for a game's scheduled open
 * time (opens_at). Shared by GameForm (public.games) and ExperienceGameForm
 * (experience_games).
 *
 *   · Empty            → immediate: the game opens as soon as it's published.
 *   · A datetime       → the game stays locked behind a countdown until then,
 *                         and opens automatically (live-computed, no flag).
 *
 * Controlled: `value` is an ISO string or null; `onChange` emits the same. The
 * <input type="datetime-local"> shows/reads LOCAL time; we convert to/from ISO
 * so storage stays UTC.
 */

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** ISO (UTC) → "YYYY-MM-DDTHH:mm" in the admin's local time for the input. */
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/** "YYYY-MM-DDTHH:mm" (local) → ISO (UTC), or null when cleared. */
function localInputToIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function OpensAtField({
  value,
  onChange,
  id = "opens_at",
}: {
  value: string | null;
  onChange: (next: string | null) => void;
  id?: string;
}) {
  const scheduled = !!value;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Opens at (scheduled launch)</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="datetime-local"
          value={isoToLocalInput(value)}
          onChange={(e) => onChange(localInputToIso(e.target.value))}
          className="h-10 max-w-[260px]"
        />
        {scheduled ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(null)}
          >
            Make immediate
          </Button>
        ) : null}
      </div>
      <p className="text-muted-foreground text-xs">
        {scheduled
          ? "Locked with a countdown in the catalogue until this time, then opens automatically."
          : "Empty = immediate — opens as soon as it’s published."}
      </p>
    </div>
  );
}
