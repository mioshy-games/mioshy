#!/bin/bash
# Restore CRM/CMS by merging origin/game into hotfix/journey-progress-restore-v2
# Resolves the 11 known conflicts deterministically.
set -e

REPO="$HOME/mioshy"
cd "$REPO" || { echo "❌ ~/mioshy not found"; exit 1; }

echo "── current branch: $(git branch --show-current)"
if [[ "$(git branch --show-current)" != "hotfix/journey-progress-restore-v2" ]]; then
  echo "❌ Must be on hotfix/journey-progress-restore-v2. Run: git checkout hotfix/journey-progress-restore-v2"
  exit 1
fi

echo "── safety: create a backup branch first"
git branch -f backup/pre-cms-merge-$(date +%Y%m%d-%H%M%S)

echo "── clearing any stale git lock"
rm -f .git/index.lock .git/MERGE_HEAD .git/MERGE_MSG .git/MERGE_MODE 2>/dev/null || true

echo "── fetching origin/game"
git fetch origin game

echo "── merging origin/game (will leave conflicts to resolve)"
git merge origin/game --no-edit || true

echo "── resolving 11 conflicts deterministically"
# (a) All marketing v2 components — take game's CMS-wired version
for f in \
  components/marketing/v2/Authority.tsx \
  components/marketing/v2/CouplesGames.tsx \
  components/marketing/v2/FAQ.tsx \
  components/marketing/v2/ForWhom.tsx \
  components/marketing/v2/Founder.tsx \
  components/marketing/v2/Hero.tsx \
  components/marketing/v2/Journey.tsx \
  components/marketing/v2/JourneyStages.tsx \
  components/marketing/v2/ReviewsGrid.tsx
do
  git checkout --theirs "$f"
done

# (b) package-lock.json — take game's version (was deleted on hotfix)
git checkout --theirs package-lock.json

# (c) Re-apply "no arrow" UX decision on CTAs (carries over hotfix commit 79b593d)
python3 - <<'PY'
import re, pathlib
files = [
  "components/marketing/v2/CouplesGames.tsx",
  "components/marketing/v2/FAQ.tsx",
  "components/marketing/v2/ForWhom.tsx",
  "components/marketing/v2/Founder.tsx",
  "components/marketing/v2/Hero.tsx",
  "components/marketing/v2/Journey.tsx",
]
for fp in files:
    p = pathlib.Path(fp)
    s = p.read_text()
    new = re.sub(r'(<CmsText[^>]*/>)\s*\{\s*"\s+"\s*\}\s*\n[ \t]+<span className="arrow">←</span>', r'\1', s)
    new = re.sub(r'(<CmsText[^>]*/>)\s+<span className="arrow">←</span>', r'\1', new)
    if new != s:
        p.write_text(new)
        print(f"  ✓ arrows removed: {fp}")
PY

# (d) app/globals.css — keep BOTH the new "Mioshy canonical CTA" block AND the new "CMS rich-text" block
python3 - <<'PY'
import re, pathlib
p = pathlib.Path("app/globals.css")
s = p.read_text()
new = re.sub(r'<<<<<<< HEAD\n(.*?)=======\n(.*?)>>>>>>> origin/game\n', lambda m: m.group(1) + m.group(2), s, flags=re.DOTALL)
p.write_text(new)
PY

echo "── verifying no conflict markers remain"
if grep -rl "^<<<<<<<\|^>>>>>>> " --include="*.ts" --include="*.tsx" --include="*.css" --include="*.json" . 2>/dev/null | grep -v node_modules | grep -v ".next" | head -5; then
  echo "❌ conflict markers still present — please review manually"
  exit 1
fi

echo "── staging + committing the merge"
git add -A
git commit -m "merge(origin/game): restore CRM (CMS), keep hotfix UX (no arrows + mobile)"

echo ""
echo "✅ Merge complete. Local hotfix branch now has the CMS back."
echo "   Next steps:"
echo "   1. Test locally:  npm install && npm run dev    (then visit /admin/content)"
echo "   2. Push to deploy: git push"
echo ""
echo "If anything looks wrong, you can roll back with:"
echo "   git reset --hard backup/pre-cms-merge-*  (most recent backup branch)"
