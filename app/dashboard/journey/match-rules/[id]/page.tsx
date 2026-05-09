/**
 * /dashboard/journey/match-rules/[id]
 *
 * Edit a single rule's user-facing copy + activation. The matcher
 * itself (kind + args) is not editable in Layer 1 — those fields are
 * surfaced read-only so an admin can see what produced this rule
 * without being able to break the underlying engine.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth/admin";
import { getMatchRule } from "@/lib/journey-content/match-rules";
import { MatchRuleForm } from "@/components/dashboard/journey/MatchRuleForm";

export const dynamic = "force-dynamic";

export default async function EditMatchRulePage({
  params,
}: {
  params: { id: string };
}) {
  await requireAdmin();
  const rule = await getMatchRule({ id: params.id });
  if (!rule) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/dashboard/journey/match-rules"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" />
          Back to match rules
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          {rule.label_he}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          <code className="font-mono text-xs">{rule.slug}</code> ·{" "}
          Kind: <code className="font-mono text-xs">{rule.matcher_kind}</code>
          {Object.keys(rule.matcher_args).length > 0 ? (
            <>
              {" "}· Args:{" "}
              <code className="font-mono text-xs">
                {JSON.stringify(rule.matcher_args)}
              </code>
            </>
          ) : null}
        </p>
      </div>

      <MatchRuleForm
        ruleId={rule.id}
        defaults={{
          label_he:     rule.label_he,
          label_en:     rule.label_en,
          rationale_he: rule.rationale_he,
          rationale_en: rule.rationale_en,
          priority:     rule.priority,
          is_active:    rule.is_active,
        }}
      />
    </div>
  );
}
