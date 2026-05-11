/**
 * CoachOverviewPanel
 *
 * Phase 8 — coach landing page content. Sits at /dashboard for any
 * non-admin expert. Replaces the games-stats view (which is admin-only)
 * with a coaching-first orientation:
 *
 *   1. Greeting + persona acknowledgement
 *   2. Onboarding checklist (one-time setup milestones)
 *   3. Today's queue summary (recurring attention items)
 *   4. Quick navigation to the 4 main coach surfaces
 *
 * Server component — pulls everything via getCoachReadiness.
 */

import Link from "next/link";
import {
  Check,
  Circle,
  HeartHandshake,
  BookOpenText,
  UserCog,
  Stethoscope,
  AlertCircle,
  Clock,
  HeartPulse,
  Sparkles,
  ArrowLeft,
} from "lucide-react";
import { getCoachReadiness } from "@/lib/journey/coach-readiness";
import { Badge } from "@/components/ui/badge";

export async function CoachOverviewPanel({ expertId }: { expertId: string }) {
  const readiness = await getCoachReadiness(expertId);
  const greeting = readiness.displayName
    ? `שלום ${readiness.displayName.split(" ")[0]}`
    : "שלום";

  return (
    <div className="space-y-6" dir="rtl">
      {/* Greeting */}
      <header>
        <h1 className="text-3xl font-bold tracking-tight">{greeting}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {readiness.queue.totalCouples > 0 ? (
            <>
              יש לכם{" "}
              <strong className="text-foreground">
                {readiness.queue.totalCouples}
              </strong>{" "}
              {readiness.queue.totalCouples === 1 ? "זוג" : "זוגות"} בליווי.
              {readiness.queue.urgentMessages > 0 ? (
                <>
                  {" "}
                  <strong className="text-rose-600 dark:text-rose-400">
                    {readiness.queue.urgentMessages}
                  </strong>{" "}
                  הודעות דורשות התייחסות מיידית.
                </>
              ) : (
                " הכול נראה רגוע — מומלץ לעבור על הקליינטים שלכם."
              )}
            </>
          ) : (
            "עדיין לא משויכים אליכם זוגות. השלימו את ההגדרות וצרו קשר עם הצוות."
          )}
        </p>
      </header>

      {/* Today's queue — counter row */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <QueueCard
          icon={<AlertCircle className="size-5 text-rose-500" />}
          label="דחוף + מדאיג"
          value={readiness.queue.urgentMessages}
          tone={readiness.queue.urgentMessages > 0 ? "rose" : "default"}
          href="/dashboard/my-clients"
          hint="הודעות שה-AI סימן"
        />
        <QueueCard
          icon={<Clock className="size-5 text-amber-500" />}
          label="חרגו מ-SLA (48ש)"
          value={readiness.queue.slaBreaches}
          tone={readiness.queue.slaBreaches > 0 ? "amber" : "default"}
          href="/dashboard/clinician"
          hint="מחכים לתגובה"
        />
        <QueueCard
          icon={<HeartPulse className="size-5 text-amber-500" />}
          label="צריכים check-in"
          value={readiness.queue.needsCheckIn}
          tone={readiness.queue.needsCheckIn > 0 ? "amber" : "default"}
          href="/dashboard/my-clients"
          hint="במצב drift"
        />
        <QueueCard
          icon={<Stethoscope className="size-5 text-blue-500" />}
          label="threads פתוחים"
          value={readiness.queue.openThreads}
          tone="default"
          href="/dashboard/clinician"
          hint="בכל הזוגות"
        />
      </section>

      {/* Onboarding checklist */}
      {readiness.todoCount > 0 ? (
        <section className="bg-card rounded-lg border border-amber-300/30 p-4">
          <header className="mb-3 flex items-center gap-2">
            <Sparkles className="size-4 text-amber-500" />
            <h2 className="text-sm font-semibold">
              להתחלה מלאה: {readiness.todoCount} צעדי הגדרה
            </h2>
            <Badge variant="secondary" className="text-[10px]">
              חד-פעמי
            </Badge>
          </header>
          <ul className="divide-border divide-y">
            {readiness.milestones.map((m) => (
              <li key={m.key} className="py-2.5">
                {m.done ? (
                  <div className="flex items-start gap-3 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                    <div className="min-w-0 flex-1">
                      <div className="text-muted-foreground line-through">
                        {m.label_he}
                      </div>
                    </div>
                    <span className="text-emerald-600 text-[11px] dark:text-emerald-400">
                      בוצע
                    </span>
                  </div>
                ) : (
                  <Link
                    href={m.href}
                    className="hover:bg-accent/40 -m-2 flex items-start gap-3 rounded-md p-2 text-sm transition"
                  >
                    <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{m.label_he}</div>
                      <div className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                        {m.why_he}
                      </div>
                    </div>
                    <ArrowLeft className="size-3.5 self-center text-muted-foreground" />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="bg-card rounded-lg border border-emerald-300/30 p-3 text-sm">
          <span className="text-emerald-700 dark:text-emerald-300">
            ✓ כל ההגדרות שלכם הושלמו.
          </span>{" "}
          <span className="text-muted-foreground">
            תוכלו לעדכן את הפרופיל והספרייה בכל עת מהתפריט.
          </span>
        </section>
      )}

      {/* Quick navigation */}
      <section>
        <h2 className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wider">
          ניווט מהיר
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <NavCard
            icon={<HeartHandshake className="size-5" />}
            label="הזוגות שלי"
            hint="ניהול ותגובות"
            href="/dashboard/my-clients"
          />
          <NavCard
            icon={<Stethoscope className="size-5" />}
            label="התור היום"
            hint="הודעות שמחכות"
            href="/dashboard/clinician"
          />
          <NavCard
            icon={<UserCog className="size-5" />}
            label="הפרופיל שלי"
            hint="שם, ביו, תמונה"
            href="/dashboard/coach-profile"
          />
          <NavCard
            icon={<BookOpenText className="size-5" />}
            label="הספרייה שלי"
            hint="תגובות שמורות"
            href="/dashboard/coach-library"
          />
        </div>
      </section>

      {/* How the workflow works — short orientation panel */}
      <section className="bg-card rounded-lg border p-4">
        <h2 className="mb-2 text-sm font-semibold">איך זה עובד — בקצרה</h2>
        <ol className="text-muted-foreground space-y-1.5 text-[13px] leading-relaxed">
          <li>
            <strong className="text-foreground">1.</strong> בכניסה הזו —
            רואים את התור היומי וההגדרות החסרות.
          </li>
          <li>
            <strong className="text-foreground">2.</strong>{" "}
            <Link
              href="/dashboard/my-clients"
              className="text-primary hover:underline"
            >
              הזוגות שלי
            </Link>{" "}
            — לוחצים על זוג כדי לראות הכל עליהם: שני הפרטנרים, מסע, הודעות, תגובות.
          </li>
          <li>
            <strong className="text-foreground">3.</strong> בעמוד הזוג — שולחים
            תוכן, תגובות, או הודעה לזוג. ה-AI ממליץ פריטים שמתאימים.
          </li>
          <li>
            <strong className="text-foreground">4.</strong> תגובות חוזרות מסומנות
            אוטומטית — דחוף ראשון, אחר כך מדאיג, אחר כך כללי.
          </li>
        </ol>
      </section>
    </div>
  );
}

function QueueCard({
  icon,
  label,
  value,
  hint,
  href,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint?: string;
  href: string;
  tone: "default" | "rose" | "amber";
}) {
  const ring =
    tone === "rose"
      ? "border-rose-300/40 bg-rose-500/[0.03]"
      : tone === "amber"
        ? "border-amber-300/40 bg-amber-500/[0.03]"
        : "border-border bg-card";
  return (
    <Link
      href={href}
      className={`block rounded-lg border p-4 transition hover:bg-accent/30 ${ring}`}
    >
      <div className="text-muted-foreground flex items-center gap-2 text-xs uppercase tracking-wide">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
      {hint ? (
        <div className="text-muted-foreground mt-1 text-xs">{hint}</div>
      ) : null}
    </Link>
  );
}

function NavCard({
  icon,
  label,
  hint,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="bg-card hover:bg-accent/40 flex items-center gap-3 rounded-lg border p-3 transition"
    >
      <div className="text-muted-foreground">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{label}</div>
        {hint ? (
          <div className="text-muted-foreground text-[11px]">{hint}</div>
        ) : null}
      </div>
    </Link>
  );
}
