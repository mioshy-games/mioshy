import { CheckCircle2, ExternalLink, UserRound } from "lucide-react";
import Link from "next/link";
import {
  getPartnerDetailsForCouple,
  HE_LABELS,
  type PartnerDetail,
} from "@/lib/experts/partner-detail";
import { PRIORITY_LABELS_HE } from "@/lib/journey/priorities";
import { Badge } from "@/components/ui/badge";

/**
 * Side-by-side per-partner panel for the expert couple-detail page.
 * Renders the two members of the couple as two columns with each
 * member's:
 *   • identity (name, email, gender, role)
 *   • demographic snapshot (relationship type/years, kids, employment, work)
 *   • diagnostic axes (latest journey_analysis row)
 *   • per-partner audience-filtered scheduled-item progress
 *   • last 8 activity events
 *
 * The audience filter is keyed on `couple_members.role` (not gender), so
 * the column header makes that explicit.
 */
export async function PartnersSplit({ coupleId }: { coupleId: string }) {
  const partners = await getPartnerDetailsForCouple(coupleId).catch((e) => {
    console.error("[PartnersSplit] load failed", e);
    return [];
  });

  if (partners.length === 0) {
    return (
      <div className="border-border bg-muted/30 text-muted-foreground rounded-lg border p-4 text-sm">
        No partners in this couple yet — wait for the invitee to redeem the
        pair code.
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {partners.map((p) => (
        <PartnerColumn key={p.userId} partner={p} />
      ))}
      {partners.length === 1 ? (
        <div className="border-dashed border-border text-muted-foreground rounded-lg border p-6 text-sm">
          The other partner hasn&apos;t joined yet.
        </div>
      ) : null}
    </div>
  );
}

function PartnerColumn({ partner: p }: { partner: PartnerDetail }) {
  const pct =
    p.scheduledTotal > 0
      ? Math.round((p.scheduledCompleted / p.scheduledTotal) * 100)
      : 0;

  const demoEntries = Object.entries(p.demographics).filter(([, v]) => !!v);

  return (
    <article className="border-border bg-card flex flex-col gap-4 rounded-xl border p-5">
      {/* Header: name + role + gender */}
      <header className="flex items-start gap-3">
        <div className="border-border flex size-11 shrink-0 items-center justify-center rounded-full border bg-background">
          <UserRound className="text-muted-foreground size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-semibold">
              {p.fullName || p.email || p.userId.slice(0, 8)}
            </span>
            <Badge variant="outline" className="text-[10px]">
              {p.coupleRole === "owner" ? "Owner / partner A" : "Partner B"}
            </Badge>
            {p.gender ? (
              <Badge variant="secondary" className="text-[10px]">
                {HE_LABELS.gender?.[p.gender] ?? p.gender}
              </Badge>
            ) : null}
          </div>
          <div className="text-muted-foreground mt-0.5 text-xs">
            {p.email ?? p.userId.slice(0, 8)}
          </div>
        </div>
        <Link
          href={`/dashboard/users/${p.userId}`}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Open user record"
        >
          <ExternalLink className="size-4" />
        </Link>
      </header>

      {/* Demographics */}
      <section>
        <div className="text-muted-foreground mb-1.5 text-[11px] font-semibold uppercase tracking-wide">
          Demographics
        </div>
        {demoEntries.length === 0 ? (
          <div className="text-muted-foreground text-xs italic">
            No demographic answers yet
          </div>
        ) : (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            {demoEntries.map(([k, v]) => (
              <div key={k} className="flex flex-col">
                <dt className="text-muted-foreground">{prettyKey(k)}</dt>
                <dd className="font-medium">
                  {v ? HE_LABELS[k]?.[v] ?? v : "—"}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      {/* Priority ranking — what the partner declared as most important */}
      <section>
        <div className="text-muted-foreground mb-1.5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide">
          <span>Priority ranking</span>
          {p.priorityRankingUpdatedAt ? (
            <span className="text-muted-foreground/80 font-normal normal-case tracking-normal">
              {relativeTime(p.priorityRankingUpdatedAt)}
            </span>
          ) : null}
        </div>
        {!p.priorityRanking ? (
          <div className="text-muted-foreground text-xs italic">
            לא דורגו עדיין
          </div>
        ) : (
          <ol className="space-y-1 text-xs">
            {p.priorityRanking.map((key, idx) => (
              <li key={key} className="flex items-center gap-2">
                <span
                  className={[
                    "inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums",
                    idx === 0
                      ? "bg-rose-500 text-white"
                      : "bg-muted text-muted-foreground",
                  ].join(" ")}
                >
                  {idx + 1}
                </span>
                <span
                  className={
                    idx === 0 ? "font-semibold" : "text-foreground/85"
                  }
                >
                  {PRIORITY_LABELS_HE[key]}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Analysis */}
      <section>
        <div className="text-muted-foreground mb-1.5 text-[11px] font-semibold uppercase tracking-wide">
          Diagnostic
        </div>
        {!p.analysis ? (
          <div className="text-muted-foreground text-xs italic">
            Assessment not yet completed
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 text-xs">
            <Stat
              label="Friendship"
              value={fmt(p.analysis.friendshipScore)}
              tone={tone(p.analysis.friendshipScore)}
            />
            <Stat
              label="Conflict"
              value={fmt(p.analysis.conflictHealth)}
              tone={tone(p.analysis.conflictHealth)}
            />
            <Stat
              label="Passion risk"
              value={fmt(p.analysis.passionRisk)}
              tone={toneInverse(p.analysis.passionRisk)}
            />
            <Stat
              label="Love language"
              value={p.analysis.primaryLoveLanguage ?? "—"}
              wide
            />
            <Stat label="Top gap" value={p.analysis.topGap ?? "—"} wide />
            {p.analysis.fourHorsemenFlag ? (
              <Stat label="4 horsemen" value="⚠" tone="warn" />
            ) : null}
          </div>
        )}
      </section>

      {/* Items they see (audience-filtered) */}
      <section>
        <div className="text-muted-foreground mb-1.5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide">
          <span>Items in their feed</span>
          <span className="text-muted-foreground/80 font-normal normal-case tracking-normal">
            audience: <code>both</code> + <code>{p.coupleRole}</code>
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <CheckCircle2 className="text-emerald-500 size-4" />
          <span className="font-semibold">
            {p.scheduledCompleted}/{p.scheduledTotal}
          </span>
          <span className="text-muted-foreground text-xs">
            ({pct}% done)
          </span>
        </div>
      </section>

      {/* Activity */}
      <section>
        <div className="text-muted-foreground mb-1.5 text-[11px] font-semibold uppercase tracking-wide">
          Recent activity
        </div>
        {p.recentActivity.length === 0 ? (
          <div className="text-muted-foreground text-xs italic">
            No timeline activity yet
          </div>
        ) : (
          <ul className="space-y-1 text-xs">
            {p.recentActivity.map((e) => (
              <li
                key={e.id}
                className="flex items-baseline justify-between gap-2"
              >
                <span className="truncate">
                  <span className="text-muted-foreground">{e.verb}</span>
                  {e.itemTitle ? (
                    <span className="ms-1 font-medium">{e.itemTitle}</span>
                  ) : null}
                </span>
                <time className="text-muted-foreground shrink-0 text-[10px]">
                  {new Date(e.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}

function Stat({
  label,
  value,
  tone,
  wide,
}: {
  label: string;
  value: string | number;
  tone?: "good" | "warn" | "bad";
  wide?: boolean;
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "warn"
        ? "text-amber-600 dark:text-amber-400"
        : tone === "bad"
          ? "text-rose-600 dark:text-rose-400"
          : "";
  return (
    <div className={wide ? "col-span-3" : ""}>
      <div className="text-muted-foreground text-[10px] uppercase tracking-wide">
        {label}
      </div>
      <div className={`text-sm font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}

function fmt(n: number | null): string {
  if (n === null) return "—";
  return (Math.round(n * 100) / 100).toString();
}

function tone(n: number | null): "good" | "warn" | "bad" | undefined {
  if (n === null) return undefined;
  if (n >= 0.6) return "good";
  if (n >= 0.4) return "warn";
  return "bad";
}

function toneInverse(n: number | null): "good" | "warn" | "bad" | undefined {
  if (n === null) return undefined;
  if (n <= 0.3) return "good";
  if (n <= 0.6) return "warn";
  return "bad";
}

function prettyKey(k: string): string {
  return k
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}

/** "ranked 3 days ago" / "דורג לפני 3 ימים" — short form, Hebrew default
 *  matches the rest of this surface. */
function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "ממש עכשיו";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `לפני ${minutes} דק׳`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `לפני ${hours} שע׳`;
  const days = Math.round(hours / 24);
  if (days < 7) return `לפני ${days} ימים`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
