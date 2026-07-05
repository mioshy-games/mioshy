import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { User360 } from "@/lib/dashboard/user-360";

/**
 * User360Sections — the six "360" cards on the admin user detail page
 * (docs/admin-user-360-spec.md). Server component, display-only. Hebrew-first
 * (the operator reads Hebrew). SLA colors on pending replies: amber > 12h,
 * red > 24h — matching the upgraded /dashboard/journey/replies screen.
 */

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("he-IL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

/** SLA tone for a wait duration (hours). */
function waitTone(hours: number): { label: string; cls: string } {
  const label = hours >= 24 ? `${Math.floor(hours / 24)} ימים` : `${hours} שעות`;
  const cls =
    hours >= 24
      ? "bg-red-100 text-red-700 border-red-300"
      : hours >= 12
        ? "bg-amber-100 text-amber-800 border-amber-300"
        : "bg-muted text-muted-foreground";
  return { label, cls };
}

export function User360Sections({ data }: { data: User360 }) {
  const { identity, partner, payment, assessment, engagement, communication } = data;

  return (
    <div dir="rtl" className="flex flex-col gap-6">
      {/* 1 — זהות */}
      <Card>
        <CardHeader>
          <CardTitle>זהות</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <Field label="שם" value={identity.fullName} />
          <Field label="מייל" value={identity.email} />
          <Field label="טלפון" value={identity.phone} />
          <Field label="מגדר" value={identity.genderHe} />
        </CardContent>
      </Card>

      {/* 2 — בן/בת זוג */}
      <Card>
        <CardHeader>
          <CardTitle>בן/בת זוג</CardTitle>
          <CardDescription>
            {partner.coupleId
              ? partner.role === "owner"
                ? "המשתמש הוא בעל/ת המנוי"
                : "המשתמש הוזמן על ידי בעל/ת המנוי"
              : "לא במסגרת זוגית"}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          {!partner.coupleId ? (
            <p className="text-muted-foreground">אין זוג.</p>
          ) : partner.ownerOnly || !partner.partner ? (
            <p className="text-muted-foreground">עדיין אין פרטנר. המשתמש פתח זוג אך אף אחד לא הצטרף עם ה-pair code.</p>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <Field label="פרטנר" value={partner.partner.name ?? partner.partner.email} />
              <Badge variant="secondary">{partner.partner.name ? partner.partner.email ?? "" : ""}</Badge>
              <Badge variant={partner.partner.didAssessment ? "default" : "outline"}>
                אבחון: {partner.partner.didAssessment ? "בוצע" : "לא בוצע"}
              </Badge>
              <Badge variant="secondary">רשום</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3 — תשלום ומנוי */}
      <Card>
        <CardHeader>
          <CardTitle>תשלום ומנוי</CardTitle>
          {payment.viaOwner ? <CardDescription>גישה דרך המנוי של בעל/ת המסגרת</CardDescription> : null}
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3 text-sm">
          {!payment.hasSub ? (
            <p className="text-muted-foreground">אין מנוי פעיל.</p>
          ) : (
            <>
              <Badge variant="default">{payment.plan ?? ""} · {payment.status ?? ""}</Badge>
              <Badge variant={payment.coaching ? "default" : "outline"}>
                {payment.coaching ? "עם ליווי" : "בלי ליווי"}
              </Badge>
              {payment.trialing ? (
                <Badge variant="secondary">
                  בתקופת ניסיון · נגמר {fmtDate(payment.trialEndsAt)}
                  {payment.introAmount != null ? ` · חיוב ראשון ${payment.introAmount} ${payment.currency ?? "₪"}` : ""}
                </Badge>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      {/* 4 — אבחון + תוצאות */}
      <Card>
        <CardHeader>
          <CardTitle>אבחון ותוצאות</CardTitle>
          <CardDescription>
            <Badge variant={assessment.shortDone ? "default" : "outline"} className="ml-1">קצר {assessment.shortDone ? "✓" : "—"}</Badge>
            <Badge variant={assessment.fullDone ? "default" : "outline"}>מלא {assessment.fullDone ? "✓" : "—"}</Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          {assessment.narrative ? <p dir="auto">{assessment.narrative}</p> : null}
          <div className="flex flex-wrap gap-2 text-xs">
            {assessment.friendship != null ? <Badge variant="secondary">חברות {assessment.friendship}/100</Badge> : null}
            {assessment.conflict != null ? <Badge variant="secondary">בריאות הקונפליקט {assessment.conflict}/100</Badge> : null}
            {assessment.passionRisk != null ? <Badge variant="secondary">סיכון תשוקה {assessment.passionRisk}/100</Badge> : null}
            {assessment.topGap ? <Badge variant="secondary">פער עיקרי {assessment.topGap}</Badge> : null}
          </div>
          {assessment.domains.length ? (
            <div>
              <div className="mb-1 text-xs text-muted-foreground">סדר התחומים המותאם (מהאבחון), עם הציון:</div>
              <ol className="flex flex-col gap-1">
                {assessment.domains.map((d, i) => (
                  <li key={i} className="flex items-center justify-between rounded border px-3 py-1.5">
                    <span>{i + 1}. {d.label}</span>
                    <Badge variant="outline">{d.score}/100</Badge>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* 5 — מעורבות בתוכן */}
      <Card>
        <CardHeader>
          <CardTitle>מעורבות בתוכן ({engagement.length} פרקים)</CardTitle>
          <CardDescription>נפתח = seen · הגיב = responded (מתוך journey_scheduled_items).</CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          {!engagement.length ? (
            <p className="text-muted-foreground">אין פרקים שסופקו עדיין.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {engagement.map((c, i) => (
                <li key={i} className="flex items-center justify-between gap-3 rounded border px-3 py-1.5">
                  <span className="min-w-0 flex-1 truncate" dir="auto">{c.title ?? "פרק"}</span>
                  <Badge variant={c.opened ? "default" : "outline"}>נפתח {c.opened ? `· ${fmtDate(c.openedAt)}` : "—"}</Badge>
                  <Badge variant={c.responded ? "default" : "outline"}>הגיב {c.responded ? "✓" : "—"}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* 6 — תקשורת עם המומחה */}
      <Card>
        <CardHeader>
          <CardTitle>תקשורת עם המומחה</CardTitle>
          <CardDescription>כל השיחות בציר זמן אחד. הודעת משתמש שאין אחריה מענה מסומנת ״ממתין למענה״ עם משך ההמתנה.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          {communication.pending.length ? (
            <div className="flex flex-wrap gap-2">
              {communication.pending.map((p, i) => {
                const t = waitTone(p.waitHours);
                return (
                  <span key={i} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${t.cls}`}>
                    ממתין למענה · {t.label} · {p.context}
                  </span>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground">אין הודעות שממתינות למענה.</p>
          )}

          {communication.timeline.length ? (
            <ol className="flex flex-col gap-2">
              {communication.timeline.map((m) => (
                <li
                  key={m.id}
                  className={`rounded-lg border px-3 py-2 ${m.authorKind === "expert" ? "bg-muted/50" : ""}`}
                >
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant={m.authorKind === "expert" ? "secondary" : "default"}>
                      {m.authorKind === "expert" ? "מומחה" : "משתמש"}
                    </Badge>
                    <span>{m.context}</span>
                    <span>·</span>
                    <span>{fmtDate(m.createdAt)}</span>
                  </div>
                  <div dir="auto" className="mt-1 whitespace-pre-wrap text-foreground/90">{m.body}</div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-muted-foreground">אין שיחות עם המומחה.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium" dir="auto">{value ?? "-"}</div>
    </div>
  );
}
