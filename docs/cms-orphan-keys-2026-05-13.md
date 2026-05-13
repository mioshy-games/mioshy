# CMS — Orphan keys carried over from the seed (2026-05-13)

The Phase-1 seed (scripts/seed-cms-texts.mjs) imported every string
from `messages/{he,en}.json` into the `cms_texts` table — including
namespaces whose UI surface has already been removed from the
codebase. These rows are "orphans": the CMS exposes them, but
nothing on the public site actually reads them, so editing them
does nothing user-visible.

This isn't urgent — orphans don't hurt anything. But it would be
nice to clean up in a small follow-up PR so the CMS list doesn't
get cluttered with content that has no live consumer.

## Known orphans

### `homeV2.pricing.*` (4 keys)

| Key | Note |
|---|---|
| `homeV2.pricing.headline` | Was the "Full transparency" section H2 |
| `homeV2.pricing.card1Original` | Strikethrough original price for card 1 |
| `homeV2.pricing.card2Original` | Same for card 2 |
| `homeV2.pricing.card3Original` | Same for card 3 |

`components/marketing/v2/Pricing.tsx` was deleted from the codebase
on 2026-05-06 (commit message left a TODO in HomepageV2.tsx:18-21:
"The file is no longer imported anywhere and can be deleted"). The
JSON kept the keys, the seed imported them.

Three of these (the `cardXOriginal` keys) carry `<s>` strikethrough
markup — the only place in our CMS where `<s>` is needed. They were
the reason we added `<s>` to the rich-text allow-list in Sprint 4
even though no live surface renders strikethrough today.

### Cleanup recipe (whenever we're ready)

1. `DELETE FROM cms_texts WHERE key LIKE 'homeV2.pricing.%';`
2. `DELETE FROM cms_text_history WHERE key LIKE 'homeV2.pricing.%';`
3. Remove the same keys from `messages/{he,en}.json` so re-running
   the seed wouldn't bring them back.
4. After this cleanup, `<s>` is no longer used by any CMS row. We
   can choose to remove it from the sanitiser allow-list (defensive)
   or leave it for future strikethrough needs.

### Other surfaces worth re-auditing later

The seed marked every key under namespaces it recognised, including
ones whose admin tab is still "Coming soon":

- `journey.*` (83 keys) — admin tab disabled, components still
  read from messages/*.json directly. When we migrate those
  components in Sprint 4 #3 we'll discover which keys are still
  reachable and which were left behind by component rewrites.
- `games.*` (65 keys) — same situation.
- `mioshy-sex` (7 keys mapped from `products` namespace; sample
  in seed report was too small to be confident the mapping is
  right — re-verify when migrating that page).
- `shared` (211 keys, mostly `nav` / `footer` / `legal` /
  `metadata`) — used everywhere, expected to stay live.
- `my` (47 keys) — `dashboard` + `account` namespaces.

Nothing to do today. Surface re-audit naturally as each page lands
in Sprint 4 #3.
