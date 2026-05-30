/**
 * AssessmentRow — wine-tinted card that links to the user's assessment
 * results page. Rendered at the top of /my/lessons under the section
 * "האבחונים שלכם".
 *
 * Receives a list of assessment rows so it can adapt when the user
 * eventually takes follow-up assessments. For the launch state there's
 * only one — taken once on signup — and the section header reads
 * "1 כרגע · עוד בהמשך".
 */

import { Link } from "@/navigation";
import { ChevronLeft, ChevronRight, PieChart } from "lucide-react";

export interface AssessmentRowData {
  id: string;
  /** "האבחון הראשון שלכם". */
  title: string;
  /** Localized stamp + scores summary line. */
  subtitle: string;
  /** Where the row deep-links to. Defaults to /journey/assessment. */
  href: string;
}

interface Props {
  rows: AssessmentRowData[];
  /** Localized "לפתוח" CTA label. */
  openLabel: string;
  /** True when the document direction is RTL — picks the right chevron. */
  isHe: boolean;
}

export function AssessmentRow({ rows, openLabel, isHe }: Props) {
  if (rows.length === 0) return null;
  const Chevron = isHe ? ChevronLeft : ChevronRight;
  return (
    <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
      {rows.map((row) => (
        <li key={row.id}>
          <Link
            href={row.href}
            className="flex items-center gap-3 rounded-2xl border p-4 transition hover:brightness-110"
            style={{
              background:
                "linear-gradient(140deg, var(--shell-wine-soft) 0%, var(--shell-card) 100%)",
              borderColor: "var(--shell-wine-edge)",
            }}
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] text-white"
              style={{ background: "var(--shell-wine)" }}
              aria-hidden
            >
              <PieChart className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div
                className="truncate text-[18px] font-bold"
                style={{ color: "var(--shell-text-1)" }}
              >
                {row.title}
              </div>
              <div
                className="mt-1 text-[14px]"
                style={{ color: "var(--shell-text-2)" }}
              >
                {row.subtitle}
              </div>
            </div>
            <span
              className="inline-flex shrink-0 items-center gap-1 text-[14px] font-bold"
              style={{ color: "var(--shell-pink-text)" }}
            >
              {openLabel}
              <Chevron className="h-3.5 w-3.5" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
