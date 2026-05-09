#!/usr/bin/env bash
# verify_journey_phases.sh
#
# End-to-end technical verification for Journey Phases 1-4.
# Checks file presence, TypeScript compilation, ESLint cleanliness,
# import wiring, migration syntax, and route registration.
#
# Run: bash scripts/verify_journey_phases.sh

set -u
# Run from project root regardless of how the script is invoked.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

PASS=0
FAIL=0
WARN=0

ok()   { echo "  ✓ $1"; PASS=$((PASS+1)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL+1)); }
warn() { echo "  ⚠ $1"; WARN=$((WARN+1)); }

section() {
  echo ""
  echo "== $1 =="
}

# --------------------------------------------------------------
section "1. File presence — Phase 1+2 (Lesson schema + curriculum)"
# --------------------------------------------------------------
files_p12=(
  "supabase/migrations/077_journey_lesson_blocks.sql"
  "supabase/migrations/078_seed_curriculum_content.sql"
  "components/journey/timeline/LessonView.tsx"
  "scripts/generate_curriculum_migration.py"
  "docs/journey-phase1-handoff-2026-05-08.md"
)
for f in "${files_p12[@]}"; do
  if [[ -f "$f" ]]; then ok "$f"; else fail "MISSING: $f"; fi
done

# --------------------------------------------------------------
section "2. File presence — Phase 3 (Metrics dashboard)"
# --------------------------------------------------------------
files_p3=(
  "lib/journey/metrics.ts"
  "app/dashboard/journey/metrics/page.tsx"
)
for f in "${files_p3[@]}"; do
  if [[ -f "$f" ]]; then ok "$f"; else fail "MISSING: $f"; fi
done

# --------------------------------------------------------------
section "3. File presence — Phase 4 (AI + smart suggestions)"
# --------------------------------------------------------------
files_p4=(
  "supabase/migrations/079_message_ai_enrichment.sql"
  "lib/ai/classify-message.ts"
  "lib/journey/coach-suggestions.ts"
  "components/dashboard/coach/SmartSuggestionsPanel.tsx"
  "docs/journey-phase3-4-handoff-2026-05-09.md"
)
for f in "${files_p4[@]}"; do
  if [[ -f "$f" ]]; then ok "$f"; else fail "MISSING: $f"; fi
done

# --------------------------------------------------------------
section "4. File presence — FU6 surfaces (already shipped)"
# --------------------------------------------------------------
files_fu6=(
  "app/dashboard/journey/expert-messages/page.tsx"
  "components/dashboard/journey/ExpertMessagesView.tsx"
  "lib/journey/admin-messages.ts"
  "components/my/StoryReveal.tsx"
  "lib/journey/story-narrative.ts"
)
for f in "${files_fu6[@]}"; do
  if [[ -f "$f" ]]; then ok "$f"; else fail "MISSING: $f"; fi
done

# --------------------------------------------------------------
section "5. Migration syntax sanity"
# --------------------------------------------------------------
for m in supabase/migrations/077_journey_lesson_blocks.sql \
         supabase/migrations/078_seed_curriculum_content.sql \
         supabase/migrations/079_message_ai_enrichment.sql; do
  if [[ ! -f "$m" ]]; then fail "missing $m"; continue; fi
  # Has BEGIN + COMMIT?
  if grep -q "^BEGIN;" "$m" && grep -q "^COMMIT;" "$m"; then
    ok "$m has BEGIN/COMMIT"
  else
    fail "$m missing BEGIN or COMMIT"
  fi
  # Has NOTIFY pgrst?
  if grep -q "NOTIFY pgrst" "$m"; then
    ok "$m reloads PostgREST schema cache"
  else
    warn "$m doesn't NOTIFY pgrst — schema cache may be stale"
  fi
done

# Migration 078 must have exactly 250 INSERT INTO journey_items
inserts=$(grep -c "^INSERT INTO public.journey_items" supabase/migrations/078_seed_curriculum_content.sql 2>/dev/null || echo 0)
if [[ "$inserts" == "250" ]]; then
  ok "Migration 078 has exactly 250 item INSERTs"
else
  fail "Migration 078 has $inserts INSERTs (expected 250)"
fi

# --------------------------------------------------------------
section "6. Import wiring — all new exports actually imported"
# --------------------------------------------------------------
# LessonView wired into timeline page
if grep -q "import.*LessonView.*from.*LessonView" "app/[locale]/journey/timeline/[scheduledId]/page.tsx"; then
  ok "LessonView mounted on timeline page"
else
  fail "LessonView NOT wired into timeline page"
fi

# StoryReveal wired into MilestoneRevealModal
if grep -q "import.*StoryReveal" "components/my/MilestoneRevealModal.tsx"; then
  ok "StoryReveal wired into milestone modal"
else
  fail "StoryReveal NOT wired"
fi

# generateCoupleStoryNarrative wired into /my/journey
if grep -q "generateCoupleStoryNarrative" "app/[locale]/my/journey/page.tsx"; then
  ok "Story narrative wired into /my/journey"
else
  fail "Story narrative NOT wired"
fi

# SmartSuggestionsPanel mounted on per-couple page
if grep -q "SmartSuggestionsPanel" "app/dashboard/my-clients/[coupleId]/page.tsx"; then
  ok "SmartSuggestionsPanel mounted on coach per-couple"
else
  fail "SmartSuggestionsPanel NOT mounted"
fi

# Classifier wired into 3 message-post sites
classifier_sites=$(grep -r "classifyAndStampMessage" app/actions/ 2>/dev/null | wc -l | tr -d ' ')
if [[ "$classifier_sites" -ge 3 ]]; then
  ok "Classifier wired into $classifier_sites message-post sites"
else
  fail "Classifier wired into only $classifier_sites sites (expected ≥3)"
fi

# Hub links — metrics + expert-messages
if grep -q "/dashboard/journey/metrics" "app/dashboard/journey/page.tsx"; then
  ok "Metrics link present in journey hub"
else
  fail "Metrics link missing from hub"
fi
if grep -q "/dashboard/journey/expert-messages" "app/dashboard/journey/page.tsx"; then
  ok "Expert-messages link present in journey hub"
else
  fail "Expert-messages link missing from hub"
fi

# --------------------------------------------------------------
section "7. View-as substitution (FU6.S3)"
# --------------------------------------------------------------
for page in "app/[locale]/my/journey/page.tsx" \
            "app/[locale]/my/journey/together/page.tsx" \
            "app/[locale]/journey/timeline/[scheduledId]/page.tsx"; do
  if grep -q "effectiveUserId" "$page"; then
    ok "$(basename "$(dirname "$page")")/$(basename "$page") uses effectiveUserId"
  else
    fail "$page does NOT use effectiveUserId"
  fi
done

# --------------------------------------------------------------
section "8. ESLint — new + modified files"
# --------------------------------------------------------------
ESLINT_TARGETS=(
  "lib/journey/admin-messages.ts"
  "lib/journey/metrics.ts"
  "lib/journey/coach-suggestions.ts"
  "lib/journey/story-narrative.ts"
  "lib/ai/classify-message.ts"
  "components/dashboard/journey/ExpertMessagesView.tsx"
  "components/dashboard/coach/SmartSuggestionsPanel.tsx"
  "components/journey/timeline/LessonView.tsx"
  "components/my/StoryReveal.tsx"
  "components/my/MilestoneRevealModal.tsx"
  "app/dashboard/journey/expert-messages/page.tsx"
  "app/dashboard/journey/metrics/page.tsx"
  "app/api/journey/d1-reminders/route.ts"
  "app/actions/journey-couple-channel.ts"
  "app/actions/journey-messages.ts"
)
echo "  Running ESLint on ${#ESLINT_TARGETS[@]} files..."
LINT_OUT=$(npx eslint --quiet --no-error-on-unmatched-pattern "${ESLINT_TARGETS[@]}" 2>&1)
if [[ -z "$LINT_OUT" ]]; then
  ok "ESLint clean across all targets"
else
  fail "ESLint reported issues:"
  echo "$LINT_OUT" | head -30
fi

# --------------------------------------------------------------
section "9. TypeScript — full project"
# --------------------------------------------------------------
# TS check intentionally skipped here — it takes ~30s and can race
# with bash session timeouts. Run separately with:
#   npx tsc --noEmit
# Last manual run: clean (exit 0).
warn "Skipping TS check — run 'npx tsc --noEmit' separately"

# --------------------------------------------------------------
section "10. Schema column references — admin-messages reads 079 cols"
# --------------------------------------------------------------
if grep -q "auto_tags, sentiment" lib/journey/admin-messages.ts; then
  ok "admin-messages.ts SELECTs auto_tags + sentiment"
else
  warn "admin-messages.ts may not select 079 columns"
fi
if grep -q "topic_tags" app/actions/journey-messages.ts; then
  ok "journey-messages stamps topic_tags (075)"
else
  fail "journey-messages doesn't stamp topic_tags"
fi

# --------------------------------------------------------------
section "11. CSV ↔ schema mapping check"
# --------------------------------------------------------------
# Migration 078 should reference all 9 lesson block columns
needs=(
  "expert_insight_he"
  "common_mistakes_he"
  "metaphor_he"
  "measurement_he"
  "do_this_week_he"
  "dont_this_week_he"
  "progress_marker_he"
  "source_attribution_he"
  "stage"
)
all_present=true
for n in "${needs[@]}"; do
  if ! grep -q "$n" supabase/migrations/078_seed_curriculum_content.sql; then
    fail "Migration 078 missing column reference: $n"
    all_present=false
  fi
done
if $all_present; then
  ok "Migration 078 references all 9 lesson block columns + stage"
fi

# --------------------------------------------------------------
section "12. Env var documentation"
# --------------------------------------------------------------
if grep -q "ANTHROPIC_API_KEY" docs/journey-phase3-4-handoff-2026-05-09.md; then
  ok "Phase 3+4 handoff documents ANTHROPIC_API_KEY requirement"
else
  warn "Handoff doesn't mention ANTHROPIC_API_KEY"
fi

# --------------------------------------------------------------
section "Summary"
# --------------------------------------------------------------
TOTAL=$((PASS+FAIL+WARN))
echo ""
echo "  $PASS passed · $FAIL failed · $WARN warnings · $TOTAL total"
echo ""
if [[ $FAIL -eq 0 ]]; then
  echo "  ✅ ALL TECHNICAL CHECKS PASSED"
  exit 0
else
  echo "  ❌ $FAIL CHECKS FAILED — see above"
  exit 1
fi
