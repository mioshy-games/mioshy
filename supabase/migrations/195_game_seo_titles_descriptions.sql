-- 195 — SEO titles + meta descriptions for the three active games.
--
-- Measured 2026-08-05 on a live, signed-out crawl of /he:
--
--   /he/games/truth-or-dare         "Mioshy - אמת או חובה"   20 chars
--   /he/games/never-have-i-ever     "Mioshy - מעולם לא..."   20 chars
--   /he/games/honesty-or-challenge  "Mioshy - כנות ואתגר"    19 chars
--
-- Three problems in one string: the brand sits in the highest-weighted
-- position and is not a term anyone searches for; ~20 of the ~55 usable
-- characters are used; and the actual query terms ("אמת או חובה לזוגות",
-- "משחק לזוגות", "אונליין") are absent.
--
-- These columns were all NULL, so the route was falling back to `name_he` /
-- `description_he` — the CATALOGUE display strings. Writing the SEO overrides
-- instead of editing those leaves every visible surface (game cards, page
-- headings) exactly as it is; only <title> and <meta name="description">
-- change. The titles below are Itzik's, verbatim.
--
-- Pairs with the brand-placement fix in app/[locale]/games/[slug]/page.tsx —
-- that route used to force "Mioshy - " onto the front of any title that did
-- not already start with the brand, which would have turned these into
-- "Mioshy - … | מיאושי". Neither half works without the other.

UPDATE games
SET meta_title_he = 'אמת או חובה לזוגות · שאלות ומשימות לשחק אונליין | מיאושי'
WHERE slug = 'truth-or-dare';

UPDATE games
SET meta_title_he = 'מעולם לא... משחק לזוגות · עשרות שאלות אונליין | מיאושי'
WHERE slug = 'never-have-i-ever';

UPDATE games
SET meta_title_he = 'כנות ואתגר · משחק זוגי אונליין לערב אחר | מיאושי'
WHERE slug = 'honesty-or-challenge';

-- Meta descriptions — only the two that actually overflow.
--
-- Google truncates the Hebrew snippet around 150-160 characters. Rendered
-- lengths measured on the live pages:
--
--   never-have-i-ever     187  (177 raw + &quot; entity expansion)  → trim
--   honesty-or-challenge  181                                       → trim
--   truth-or-dare          79                                       → left alone
--
-- Both rewrites below are condensed from the existing approved description_he,
-- keeping the same promise and voice — no new claims. truth-or-dare is NOT
-- touched here: at 79 characters it is not being truncated, it is short, and
-- "titles/descriptions that are too short" is explicitly the next round's item.

-- 158 chars
UPDATE games
SET meta_description_he = 'משחק "מעולם לא..." לזוגות, אונליין וחינם, עם עשרות שאלות מוכנות. כל קלף חושף סוד קטן — ואם זה קרה לכם, שותים. מצחיק, מפתיע, וחושף דברים שלא ידעתם אחד על השני.'
WHERE slug = 'never-have-i-ever';

-- 154 chars
UPDATE games
SET meta_description_he = 'כנות ואתגר — משחק זוגי אונליין עם שאלות שחושפות ואינטימיות שתיהנו לחוות. לזוגות שמוכנים להעמיק, להדליק מחדש את התשוקה, ולקחת את הערב כולו למקום אחר לגמרי.'
WHERE slug = 'honesty-or-challenge';
