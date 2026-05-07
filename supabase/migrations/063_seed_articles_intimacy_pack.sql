-- ============================================================
-- 063_seed_articles_intimacy_pack.sql
--
-- Five new long-form articles for the Mioshy blog (HE + EN).
-- Per Itzik 2026-05-06: Hebrew bodies are HIS verbatim copy
-- (typos, "????" placeholders, smileys, em-dashes preserved).
-- The ONLY edit applied to the Hebrew is a single missing
-- period in Article 1 between "להיות" and "מצב כזה".
--
-- Each article is wrapped in a small closing CTA block with
-- cross-links to /games (anchor: "משחקי זוגות אונליין"),
-- /journey, /mioshy-sex, and to other articles in this pack — to
-- reinforce the canonical product phrase for SEO and to keep
-- readers moving inside the funnel.
--
-- English copy is native American English (color / favorite /
-- realize), editorial-coach tone, free of the giveaway phrases
-- that flag generic AI output.
--
-- Slugs are English-only (matches the existing pattern: one
-- slug serves both locales). Run AFTER 011_articles.sql and
-- 012_articles_emoji.sql.
-- ============================================================

INSERT INTO public.articles (
  slug,
  title_en, title_he,
  excerpt_en, excerpt_he,
  content_en, content_he,
  author,
  is_published, published_at,
  tags, reading_time_minutes,
  emoji,
  meta_title_en, meta_title_he,
  meta_description_en, meta_description_he
) VALUES

-- ════════════════════════════════════════════════════════════
-- ARTICLE 1 — Three Steps to Boost Sexual Desire
-- ════════════════════════════════════════════════════════════
(
  'boost-sexual-desire-three-steps',
  'Three Steps to Reclaim Sexual Desire (Without Pressure)',
  'שלושה שלבים לשיפור והגדלת החשק המיני',
  'Desire fades when sex starts feeling like a chore. Three small mindset shifts that bring it back — and the conversation that has to happen first.',
  'בידוד החשק המיני מהגוף לרגע, ושלושה שלבים פשוטים שמחזירים אותו: חופש לבחור, שחרור מאשמה ולחץ, וחיבור מחדש לפינוק והנאה.',

  $en$# Three Steps to Reclaim Sexual Desire (Without Pressure)

To understand your sexuality — and especially desire — try a thought experiment. For one minute, separate desire from your body. Picture it as its own thing. Give it a shape, a color, a weight. It's easier to talk about something you can see in your head.

Now we can ask the real question: what does that thing actually need to thrive?

## Step 1 — Desire needs freedom

Before anything else, desire needs the option to say no. That sounds backwards, but it's the foundation of everything that comes after. If you can't say no without consequences — without a fight, without sulking, without the slow drift of resentment — then yes also stops meaning anything real.

Give your desire complete freedom to stop when something doesn't feel right, and to come back when it does. No score-keeping. No "you owe me." Just permission.

## Step 2 — Don't trap it

The fastest way to kill desire is to wrap it in pressure, guilt, and the fear of disappointing your partner. Once sex becomes a chore, it joins every other chore on the list — and the to-do list at home is already long enough.

Ask yourself, honestly:

> *Am I trying to satisfy my partner mostly so they won't cheat, won't leave, won't be upset?*

If the answer is yes, that's the loop. The relief you feel after having sex isn't pleasure — it's the feeling of having clocked out of an obligation. Desire learns to associate intimacy with anxiety, and it shrinks to protect you.

## Step 3 — Tie it to pleasure, not duty

Desire grows when it's connected to indulgence, play, and freedom. Close your eyes for a moment. What's stopping yours from breathing? Put your finger on the specific thing — the resentment, the fatigue, the feeling of "I have to perform." Name it.

Then try to redraw the picture. What would your sexuality look like if it came from a place of curiosity instead of obligation? What does it want to wear? Where does it want to be touched? What makes it laugh?

Share that picture with your partner. Not as a complaint — as a description of the version you'd like to grow back toward.

## A small practical step you can take tonight

Stop trying to schedule sex. Schedule **closeness** instead — twenty minutes of undistracted attention with no agenda. A back rub. A long conversation in the dark. A game you can play side by side that asks better questions than "how was your day?" Our [online couples games](/games) were built for exactly this — they take the pressure off the body and put it back on connection, which is where desire actually starts.

If your relationship has been stuck in this loop for a while, a couple of weeks of intentional sessions usually shifts something. If it doesn't, that's worth a conversation with someone who specializes in it — that's what [Mioshy's coaching track](/journey) is for: a clinician who gets to know you both and helps you redraw the picture together.

The same definitions you give to anything in your life shape what it becomes. Sexuality is no different — and the redefinition is something you can start tonight.

*Also worth reading: [How to last longer in bed](/articles/last-longer-in-bed-guide) · [How to give her multiple orgasms](/articles/multiple-orgasms-for-her)*
$en$,

  $he$# שלושה שלבים לשיפור והגדלת החשק המיני

כדי להבין את המיניות שלנו, ובפרט את החשק המיני, בואו נבודד אותו לרגע מגופנו ונתייחס אליו כאל ישות נפרדת. אנחנו יכולים לתת לו שם, נפח וצורה מסוימים, כדי שיהיה לנו קל יותר לדמיין אותו.

## שלב ראשון

בראש ובראשונה, עלינו להבין שהישות הזו, ״מיניות״ צריכה חופש, אפשרות לבחור בין לקיים יחסי מין לבין לסרב לעשות זאת. עלינו להעניק למיניות שלנו חופש מושלם לעצור כשלא נעים לנו, ולהמשיך כששוב יש לנו רצון בכך, כל זאת מבלי שהדבר ישפיע על אף אחד מהצדדים המעורבים ביחסי המין.

## שלב שני

אם במקום חופש נקשר את המיניות שלנו עם תחושות כמו מתח, אשמה והאשמה, תסכול וחשש מלאכזב - היא תהפוך למטלה, לקושי ולפעולה מורכבת, בדיוק ההפך ממה שהיא צריכה להיות. מצב כזה רק ידחיק עוד יותר את החשק המיני, כי הרי מי צריך מטלות גם במיטה, מעבר לכל אלה שיש מחוצה לה...?

## שלב שלישי

המיניות מתחברת לפינוקים, להנאות וכמו שכבר אמרנו - לחופש. כשיש ירידה בחשק המיני, גם אם לזמן קצר, הדבר עלול לגרור בעיות בהמשך, לרבות הימנעות.

עצמו עיניים ודמיינו את החשק המיני שלכם. מה תוקע אותו? מה מפריע למיניות שלכם להיות חופשית? נסו לשים את האצבע על הדבר או הדברים שהופכים אותה לנטל. האם ״מיניות״ מתחברת לכם עם התיאור ״משהו שחובה לעשות כדי לא לשלם בבגידה, במריבות או בתסכולים?״. ענו לעצמכם בכנות: האם אתם מנסים לספק את בני הזוג שלכם רק כדי שלא יבגדו בכם או לא יעזבו אתכם?

אם התשובה לשאלה הזו היא ״כן״, נסו לתאר מיניות בצורה חיובית, אחרת. תנו לה בראשכם צורה ונפח אחרים, שבאים ממקום חיובי, בונה וחופשי. ברגע שהמיניות שלנו תבוא ממקום של חופש ושחרור מוחלטים, היא תיראה אחרת לגמרי וכל מי שמעורב בה ירגיש בשינוי מקצה לקצה. פשוט ככה.

נסו למצוא את הדברים שגורמים לכם חופש, שחרור, פינוק והנאה, ועכשיו שתפו את המחשבות שעלו לכם עם בני הזוג שלכם. ביחד תיצרו לכם את האווירה הנחוצה לכם לשחרור המיניות שלכם ולגילוי מחוזות חדשים. די שתפסיקו לקשר מיניות עם מחשבות שליליות כדי לגלות עוצמות חדשות סביב המושג הזה ולהציף רגשות חיוביים, כפי שלא חוויתם בעבר. ככל שתקפידו על הגדלת הפתיחות והקירבה, כך תרחיקו את הבדידות והתסכול, ותייצרו ביחד חוויות מיניות טובות ועוצמתיות יותר, שיתהוו אל תוך חוויית מיניות חדשה, המושתתת על תפיסת מיניות כחופש והנאה.

גם במקרה של מיניות, ידהים אתכם לגלות עד כמה חזקה השפעתן של ההגדרות שאנו נותנים לדברים!

---

**רוצים להתחיל יחד?** [משחקי זוגות אונליין](/games) של מיאושי בנויים בדיוק לערבים שבהם צריך להוריד את הלחץ ולהחזיר את הסקרנות. לזוגות שרוצים תהליך ארוך עם מומחה שיכין תוכנית אישית, יש [ליווי עם מיאושי](/journey).

*שווה לקרוא גם: [המדריך השלם איך לשלוט בגמירה](/articles/last-longer-in-bed-guide) · [איך לגרום לה להגיע לשיא פעם אחר פעם](/articles/multiple-orgasms-for-her)*
$he$,

  'Itzik Berlav', true, now() - interval '0 days',
  ARRAY['couples-games','intimacy','desire','relationship-tips'], 6, '🔥',
  'Boost Sexual Desire — Three Steps That Actually Work | Mioshy',
  'שלושה שלבים לשיפור והגדלת החשק המיני | Mioshy',
  'When sex feels like a chore, desire dies. Three mindset shifts to bring it back, plus a tonight-friendly first step. Online couples games included.',
  'כשהסקס מרגיש כמו מטלה, החשק נעלם. שלושה שלבים שמחזירים אותו, וצעד ראשון שאפשר לעשות הלילה. כולל משחקי זוגות אונליין.'
),

-- ════════════════════════════════════════════════════════════
-- ARTICLE 2 — Last Longer in Bed (Without Distraction Tricks)
-- ════════════════════════════════════════════════════════════
(
  'last-longer-in-bed-guide',
  'How to Last Longer in Bed — Without Distraction Tricks',
  'המדריך השלם איך לשלוט בגמירה!',
  'Stop trying to delay the finish line. The real fix is learning your own body, then bringing your partner into the practice. Here''s the exact progression.',
  'איך שולטים בשפיכה בקלות - ובכיף! מתחילים בלהכיר את נקודת האל-חזור שלכם לבד, ואז מצרפים את בן/בת הזוג לתרגול. ההתקדמות המדויקת.',

  $en$# How to Last Longer in Bed — Without Distraction Tricks

The internet is full of "tricks" — think about baseball, count tiles, recite multiplication tables. They might buy you a minute. They also pull you out of the moment, which is the entire point of being there.

There's a better path, and it's mostly mental.

## Stop chasing the finish line

Healthy sex is built on presence, curiosity, and connection. The problem with rushing toward the climax — yours or hers — is that the rush itself creates the exact tension that ends things early. The act becomes a deadline.

So before any technique: shift the goal. The point of the experience isn't the orgasm. The orgasm is one possible outcome of a longer experience that's also worth having.

A few things follow from that:

- Not every encounter has to end in climax. For either of you. You're allowed to stop somewhere good.
- Time spent slow — eye contact, mouth, hands, breath — isn't "before" the sex. It is the sex.
- If one of you finishes and the other doesn't, the night isn't a failure. The pressure to "make it even" turns intimacy into accounting.

This isn't a personality reframe. It's a practical decision you can make tonight: change what "success" looks like.

## Step 1 — Get to know yourself first

Now the technical part, because there's a real skill to learn. The skill is recognizing your **point of no return** — the threshold past which the climax is going to happen no matter what. You can't manage something you can't feel arriving.

The way to learn it is alone. Through masturbation, slow, with attention. Don't aim to finish quickly. Notice the build. Notice the moment where the body stops asking and starts insisting. That's your line. Practice approaching it and pulling back. It can take a few sessions over a few weeks before the line is clear. That's normal.

While you're at it, get curious about your body. Where do hands feel best? What kind of pressure? What rhythm? You'll bring all of this back to the bedroom.

## Step 2 — Add your partner to the practice

Once the line is clear when you're alone, bring your partner in.

Start with you on your back, them on top. That position gives **you** the most control over depth and pace, which is what you need while you're still calibrating. When you feel the line approaching — the same one you mapped solo — ask them to pause for a few seconds.

A useful tip: with penetration, the arousal threshold is higher than with masturbation, so the line shows up sooner than you'd expect. Pause earlier than feels necessary. After a few sessions, the pause cue becomes second nature, and you'll find you can ride the wave for a long time before going over.

## Step 3 — Talk while you practice

The fastest version of this learning curve happens when you're not silent. "Slow down for a second." "Stay there." "I'm close." None of these break the mood — they build trust, and they teach your partner to read your body. Over a few weeks, the verbal cues become unnecessary because the muscle memory takes over.

If you'd rather practice the conversation muscle in a low-stakes way first, our [online couples games](/games) are designed to make those check-ins feel normal — questions and prompts that get you both used to talking about pleasure out loud. It transfers.

## When to ask for more help

If you've been at this for a few months and the issue is consistent — finish in under a minute regardless of context, anxiety building around sex, avoidance creeping in — that's worth a real conversation with a sex-positive clinician. [Mioshy's coaching track](/journey) is exactly that: a private channel with someone who's seen this pattern hundreds of times and can tailor the approach to you and your partner specifically.

Most people don't need that step. Most people need the mindset shift, the solo work, and a few honest weeks of practice with a patient partner. That's the whole answer.

*Also helpful: [Three steps to reclaim desire](/articles/boost-sexual-desire-three-steps) · [The five best sex positions for couples](/articles/best-sex-positions-for-couples)*
$en$,

  $he$# המדריך השלם איך לשלוט בגמירה!

## איך שולטים בשפיכה בקלות - ובכיף!

אבני היסוד של מערכות יחסים הן תשוקה, קירבה, ריגוש, מין טוב, תשומת לב, התייחסות, רגש ועוצמה. במקומות שבהם יש תסכול וחרדות, אנו נתקלים בבעיות במיניות. לכן, חשוב שלא להתחיל את מערכת היחסים בחופזה. עלינו להיכנס למיטה מתוך רצון לחוות, להתרגש, להעניק ולקבל. אם אתם ״דוחפים״ את האקט המיני קדימה על מנת להזדרז ולהגיע לאורגזמה או להביא את בני הזוג שלכם לאורגזמה - אתם מפספסים את הנקודה, ומכניסים מתח אל הפעילות המינית. במקום זאת, יש להאריך את משך הזמן שאתם מבלים באינטימיות. במקום לספור את כמות החדירות עד לשפיכה, צריך להגיע אל האקט עם מוכנות לחקור ולחוות.

המוכנות הזו, ההבנה של עצם מהות יחסי המין, דורשת לעצור לרגע ולהפנים שהאקט המיני נוצר, למעשה, לזוג. לכן, התחושה ברגע אינטימי שונה מכל תחושה או מגע אחרים שאנו מכירים ושמתקיימים עם אנשים אחרים בסביבתנו. זהו רגע מהמם, מרגש, מלא בתשוקה, רגע שהוא עולם ומלואו מעבר לאקט המיני שגלום בו. זהו רגע שניתן ורצוי לעצור ולהנות ממנו, מהמגע שאנחנו מעניקים ומקבלים בחזרה, מההורמונים שמציפים אותנו. גם אם אחד מבני הזוג לא הגיע לפורקן - הכל טוב! אנחנו נהנים האחד מהשני, אנחנו עוצרים לחוש את הרגע האינטימי שלנו, על כל הרבדים שלו, וזה מה שחשוב באמת. אם תדעו להנות מרגעים כאלה ותבינו שלא כל מגע מיני חייב להסתיים באורגזמה, תהיו משוחררים, וההנאה שלכם תהיה משוחררת ותוכלו להנות מכל החוויה, גם מהאקט המיני עצמו.

השלב הבא הוא שליטה בפורקן. לשם כך, עלינו להכיר את עצמנו בצורה הטובה ביותר, והדרך לעשות זאת מתחילה באוננות, שמאפשרת לנו ללמוד ביחידות את נקודת האל-חזור שלנו, זו שממנה והלאה ״פספסנו את הרכבת״ והפליטה תגיע בכל מחיר. בדיוק בנקודה הזו עלינו ללמוד לעצור. במהלך האוננות, הרגישו חופשיים לגעת בגופכם, לסרוק את הנקודות שהכי נעימות לכם ואת אופני המגע שעושים לכם הכי טוב. הבדיקה יכולה להימשך גם מספר שבועות, כל אחד והקצב שלו.

אחרי שברור מתי לעצור ומתי להמשיך, עוברים אל השלב הבא, שהוא תהליך זוגי: אתה על הגב, בת הזוג נעה מעליך - כך מתאפשרת לך השליטה הטובה ביותר. ברגע שתרגיש שהנה - הגעת אל נקודת האל-חזור שאליה התוודעת בשלב הקודם - בקש מבת הזוג לעצור קצת. טיפ: כשמדובר בחדירה רצוי לעצור כמה רגעים לפני כן, משום שביחסי מין רמת העוררות המינית תהיה גבוהה יותר ביחס לאוננות. לאחר מספר התנסויות כאלה עם בת הזוג תרגיש שליטה ויכולת לעצור את הפליטה כאוות נפשך. בהתאם לכך, תחווה הנאה גדולה יותר.

---

**רוצים להתחיל את התרגול בקלות?** [משחקי זוגות אונליין](/games) של מיאושי מורידים את הלחץ ופותחים שיחה על הנאה לפני שנכנסים למיטה — וזה השלב שעושה את ההבדל בתרגול הזה. לזוגות שמוכנים לחוויות מודרכות במיטה עצמה יש [הסקס של מיאושי](/mioshy-sex), ולמי שמחפש תוכנית אישית עם מומחה — [ליווי עם מיאושי](/journey).

*שווה לקרוא גם: [שלושה שלבים לשיפור והגדלת החשק המיני](/articles/boost-sexual-desire-three-steps) · [5 התנוחות הטובות ביותר](/articles/best-sex-positions-for-couples)*
$he$,

  'Itzik Berlav', true, now() - interval '1 days',
  ARRAY['couples-games','intimacy','sex-tips','men','relationship-tips'], 7, '⏱️',
  'How to Last Longer in Bed — Without Tricks | Mioshy',
  'המדריך השלם איך לשלוט בגמירה — בלי טריקים | Mioshy',
  'Skip the distraction tricks. Real technique for lasting longer: know your point of no return, then practice with your partner. Plus online couples games to warm up the conversation.',
  'בלי טריקים של הסחת דעת. הטכניקה האמיתית: להכיר את נקודת האל-חזור ולתרגל בזוג. כולל משחקי זוגות אונליין לשיחה הראשונה.'
),

-- ════════════════════════════════════════════════════════════
-- ARTICLE 3 — The Five Best Sex Positions for Couples
-- ════════════════════════════════════════════════════════════
(
  'best-sex-positions-for-couples',
  'The Five Best Sex Positions for Couples (And Why Position Matters Less Than You Think)',
  '5 התנוחות הטובות ביותר!',
  'Five positions worth practicing — but the bigger truth is that the right contact matters more than the right pose. Here''s what actually moves the needle.',
  'חמש תנוחות ששווה לתרגל — היא למעלה, דוגי סטייל, רגליים על הקרקע, מיסיונרית עם טוויסט, ותנוחת מספריים. ולמה האנרגיה במיטה חשובה לא פחות מהפוזה.',

  $en$# The Five Best Sex Positions for Couples

Most position guides skip the most important fact: for the majority of women, climax requires direct stimulation of the clitoris. The clitoris is the only organ in the human body whose entire purpose is pleasure — there's no second job. It also tends to be the part that "advanced positions" forget about.

So before the list, the rule that runs through every position below: if there's no consistent contact with the clitoris, the pose almost doesn't matter. Pick a position that lets one of you reach it.

## 1. Her on top

A favorite for a reason. She controls depth, angle, and pace — three things the same body wants in slightly different combinations on different nights. From this position, either partner can stimulate the clitoris easily, with a hand or with a small toy.

If she's new to being on top and feels self-conscious, dim the lights and let her lean forward onto your chest. The angle changes, the eye contact stays.

## 2. Doggy style

If you've avoided it because it feels intimidating, try it. The reach is generous: she can touch herself (out of view if she's still warming up to that), or you can — and the angle is one most bodies enjoy.

Two small details that change this position from average to outstanding:

- Lean on the elbows rather than the hands. The angle deepens, the back relaxes.
- Use the free hand. The position has been begging for it the whole time.

## 3. Feet on the floor

She's on the bed, on her back, hips at the edge. You're standing or kneeling on the floor at the edge — whichever height works for the bed you have.

What this position gives you that others don't: a wide, open hold of her body. Both your hands are free. You can reach the clitoris, the chest, the thighs. She can reach down to herself with no awkward angle. Eye contact is easy. It's the most underrated position on this list.

A small clinical note that surprises people: many women can't climax when their feet are cold. In this position you can hold her feet, warm them between your hands, even press your weight gently against them. It tends to intensify everything else.

## 4. Missionary, slightly upgraded

Standard missionary, but you climb higher up the bed than feels natural. Your weight shifts forward, the angle of penetration tilts to about 90 degrees, and now her clitoris is in steady contact with the base of you with every stroke. The mechanics are simple. The result is not.

A pillow under her lower back tilts the angle further and shifts the contact zone. Try it both ways and see which one she prefers.

## 5. Scissors

Both of you on your backs at about a 45-degree angle to each other, one of her legs draped over yours. It looks complicated for thirty seconds and then makes sense. Both of you have a hand free for her clitoris and easy access to each other for kissing, talking, eye contact.

## The thing position guides leave out

The energy you bring to the room matters as much as the technique. Quieter partners often forget how much information their bodies are *not* sending. Make noise. Say what feels good in real time. Pinch, scratch, grab, gasp, laugh. The more you both signal what's working, the more your partner can amplify it.

If you're a couple that's grown shy with each other over the years, the easiest way back is talking about pleasure outside the bedroom first. Our [online couples games](/games) put those conversations on a low-stakes table — questions and prompts about preferences, fantasies, and curiosities, designed to thaw the silence. It carries over.

For couples ready to bring guided experiences into the bedroom itself — built around a specific theme, with prompts that walk you through it step by step — that's what [Mioshy's Sex](/mioshy-sex) are for.

*Pair it with: [How to give her multiple orgasms](/articles/multiple-orgasms-for-her) · [Last longer in bed — without tricks](/articles/last-longer-in-bed-guide)*
$en$,

  $he$# 5 התנוחות הטובות ביותר!

על מנת להגיע לאורגזמה, רוב הנשים יזדקקו לגירוי של הדגדגן, איבר מופלא שנועד אך ורק לשם הנאה מינית ועונג. תאמינו או לא - אין לו אף שימוש אחר! גברים, זכרו: בלי חיכוך ומגע איכותי בדגדגן - לא משנה באיזו תנוחה תבחרו וכמה זמן יימשך הסקס -  סביר להניח שהאישה לא תגיע לאורגזמה. הנה 5 תנוחות שיסייעו לכם להפעיל את כפתור העונג של האישה שאתם אוהבים:

## היא למעלה

נשים רבות אוהבת לשבת על הגבר. הדבר מעניק להן שליטה על זווית החדירה, על הקצב ועל הסיטואציה כולה. נוסף על כך, זוהי תנוחה מעולה למגע בדגדגן על ידי האישה או הגבר.

## דוגי סטייל

לא התנסיתם? הזדמנת מצוינת להתחיל! בתנוחה האנרגטית והמעולה הזו יש גם לגבר וגם לאישה גישה לדגדגן בזמן האקט המיני. התנוחה הזו מועדפת על גברים ונשים כאחד: גברים נהנים מהתחושה והעוצמה שהם חווים בה,  ולנשים היא מאפשרת גישה נוחה לדגדגן (אפילו מבלי שבן הזוג יראה, אם הן מתביישת לגעת בעצמן מולו), ובכך להגיע לאורגזמה בקלות רבה יותר. מעבר לכך, דוגי סטייל מאפשר לנשים שליטה בזווית החדירה הנוחה להן, על ידי הישענות על כפות הידיים, על המרפקים או נמוך יותר.

## רגליים על הקרקע

האישה שוכבת על המיטה על גבה והגבר נמצא מחוץ למיטה, בעמידה או על ברכיו - מה שנוח לו. תנוחה זו מאפשרת לו אחיזה רחבה למדי של גוף האישה, כולל שליחת יד לדגדגן. גם האישה יכולה לגעת בעצמה בתנוחה זו - כל האופציות פתוחות להנאה הדדית.

טיפ של מומחים: לנשים קשה עד בלתי אפשרי להגיע לאורגזמה אם כפות הרגליים שלהן קרות. בתנוחה זו קל יותר לגברים לאחוז בכפות הרגליים של בת הזוג ולשפשף אותן עד שיתחממו. הדבר אף יעצים את האורגזמה הנשית.

## מיסיונרית עם טוויסט

מתחילים מתנוחה מיסיונרית סטנדרטית, רק שהפעם הגבר צריך לעלות גבוה יותר, כך שהזין שלו יהיה בזווית של 90 מעלות כשהוא חודר. באופן זה יווצר חיכוך עם הדגדגן תוך כדי תנועה, לצד ההנאה שבגיוון התנוחה האהובה. התנוחה המיסיונרית מתאימה גם לביישנים, מכיוון שאינה דורשת דורשת התארגנות מיוחדת. עוד גיוון אפשרי לתנוחה יתקבל על ידי הוספת כרית מתחת לגב התחתון של האישה, מה שישנה את הזווית ויאפשר מגע באזורים אחרים של הדגדגן.

## תנוחת מספריים

כאשר שני בני הזוג שוכבים על הגב בזווית של 45 מעלות זה מזה, הגבר חודר אל האישה כשרגל אחת שלה נמצאת מעליו. במצב כזה קל מאוד גם לגבר וגם לאישה לגעת בדגדגן וזה בזו.

## איזו תנוחה הכי סיקרנה אתכם?

בחרו אחת ונסו אותה הלילה! אלא שמעבר לביצועים ולטכניקה, חשובה לא פחות ואולי אף יותר! האנרגיה שאנו משדרים לבני הזוג שלנו במהלך קיום יחסי המין. למשל, בני זוג מופנמים יותר יצטרכו לעשות מאמץ כדי להראות לפרטנר מה באמת מתחולל בגופם. נסו להשמיע קולות, לשתף במחשבות בזמן אמת, לצעוק, לגנוח, לצבוט, לגעת ולא להפסיק להפגין את העובדה שאתם חווים דבר מה עוצמתי. סמכו עלינו - זה ייקח את החוויה שלכם למחוזות חדשים לגמרי של עונג.

---

**רוצים להפשיר את השיחה לפני המיטה?** [משחקי זוגות אונליין](/games) של מיאושי שואלים בדיוק את השאלות שמכינות את הקרקע — מה אהבתי, מה הייתי רוצה לנסות, מה דליק. לזוגות שמוכנים לחוויות תמטיות במיטה עצמה יש [הסקס של מיאושי](/mioshy-sex).

*שווה לקרוא גם: [איך לגרום לה להגיע לשיא פעם אחר פעם](/articles/multiple-orgasms-for-her) · [המדריך השלם איך לשלוט בגמירה](/articles/last-longer-in-bed-guide)*
$he$,

  'Itzik Berlav', true, now() - interval '2 days',
  ARRAY['couples-games','intimacy','sex-tips','positions'], 7, '🔥',
  '5 Best Sex Positions for Couples (Plus What Matters More) | Mioshy',
  '5 התנוחות הטובות ביותר לזוגות + מה שחשוב יותר | Mioshy',
  'Five positions worth trying — but contact matters more than pose. Detailed guide with tips, plus online couples games to make the conversation easy.',
  'חמש תנוחות ששווה לנסות — אבל המגע חשוב יותר מהפוזה. מדריך מפורט עם טיפים, ועוד משחקי זוגות אונליין שמקלים על השיחה.'
),

-- ════════════════════════════════════════════════════════════
-- ARTICLE 4 — Multiple Orgasms for Her
-- ════════════════════════════════════════════════════════════
(
  'multiple-orgasms-for-her',
  'How to Bring Her to Climax — Again and Again',
  'איך לגרום לאישה להגיע לשיא פעם אחר פעם?',
  'Skip straight to the clitoris and you''ll lose it. The full path: arousal first, attention always, and the patience that separates good from unforgettable.',
  'אם אין חרמנות ואנרגיה מינית — מגע אינטימי עלול להיות לא נעים. הדרך לכבד את האיבר, להתחיל מסביב, ולחזור אליו ברגע הנכון. סבלנות היא הטכניקה.',

  $en$# How to Bring Her to Climax — Again and Again

The single biggest mistake men make in bed is rushing to the clitoris. The clitoris is the destination, not the door. Approach it before her body is ready and the touch — no matter how skilled — is going to feel like sandpaper. Approach it with everything else already lit up, and the same touch becomes something else entirely.

The principle: the clitoris deserves respect, not directness.

## Start in the warm-up zone

Begin nowhere near it. Inner thighs. The dip behind the knee. A soft hand sliding up the side of the rib cage. Stay there longer than you think you need to. You're not stalling — you're listening. Her body will tell you, with its own movements and breath, when she wants more.

When she does, follow that signal. Move toward the chest. Linger. Pay attention to the small inner labia and the soft skin that surrounds the clitoris before you ever touch it directly. The whole area is a feedback system: pressure, pace, and timing on the surrounding tissue is what makes the clitoris itself ready for direct contact.

## A note on the long way

Yes, this is slower than going for the goal. That's the entire point. A man takes about six minutes to climax in good conditions. A woman, on average, takes around twenty. If you compress her twenty into your six, you've made the same mistake people make when they rush dinner — the meal happens, but no one enjoyed it.

Patience here isn't a virtue. It's the technique.

## Once you're there

Direct contact, but not constant. The thing that turns one orgasm into several is *modulation* — pulling back to kissing, the hands, the inner thigh, then returning to direct contact a minute later with everything more sensitive than before. The reset is the secret.

A few practical add-ons:

- Bring a finger inside the vagina (or near the rectum, if she's into it). The internal pressure changes the entire sensation profile.
- A small toy is not a threat. It's a tool. The vibration adds a frequency hands can't produce.
- Talk while you're there. "Tell me what you want." "Slower or faster?" Verbal communication during sex is the single most underused skill in long relationships.

## The thing nobody talks about

Many women feel insecure about their genitals — taught, somewhere along the way, that there's something to be embarrassed about. If you're going down on her, tell her she smells incredible. Tell her she looks beautiful. Specifically. Not as a line — as a fact you happened to say out loud. If she pulls away from kissing you afterwards, ask why with curiosity, not defensiveness. There's almost always a reason worth knowing about, and the conversation tends to dissolve the discomfort.

## Where this fits in your relationship

Couples who are out of practice with this — who've grown shy or rushed or both — usually need to rebuild the muscle outside the bedroom first. Permission to talk about pleasure. Permission to be specific about what you want. That's exactly what our [online couples games](/games) do: they make those conversations feel normal, and the ease shows up later.

For couples who want a more guided practice — themed sessions, prompts that walk you both through specific experiences with intention — that's [Mioshy's Sex](/mioshy-sex). And if you've been stuck on the same patterns for years and want a coach who can map out a specific plan for the two of you, [Mioshy's coaching track](/journey) is built for exactly that.

The technique is simple. The patience is harder. Once you have both, "again and again" stops being a metaphor.

*Worth pairing: [The five best sex positions](/articles/best-sex-positions-for-couples) · [What women should do during sex](/articles/what-women-do-during-sex)*
$en$,

  $he$# איך לגרום לאישה להגיע לשיא פעם אחר פעם?

העיקרון המנחה הוא פשוט: אם אין חרמנות ואנרגיה מינית - מגע אינטימי עלול להיות לא נעים, ואפילו להכאיב. את האיבר, במילים אחרות, צריך לכבד - לא לגשת אליו ישר, ללא התחשבות ומחשבה, אלא להתחיל מלחקור בעדינות את סביבותיו. נכון, הדגדגן הוא הדובדבן שבקצפת, הפיק המושלם, הנקודה הכי החמה - כל כינוי מדליק שתתנו לו - יתאים. אבל כדי להוציא ממנו את מקסימום ההנאה שהוא יכול להפיק (ותאמינו לנו - הוא מסוגל לרמות הנאה מטורפות!), צריך ללמוד לגעת גם מסביב, בשפתיים הקטנות, בחלקים הפנימיים שעוטפים אותו, לפני שממהרים לגעת בו ישירות.

אז מאיפה מתחילים? התחילו מנגיעות בירכיים ובמגע רך עלו לכיוון החזה. היו קשובים לאישה. ברגע שתרגישו שיש היענות מצדה, המשיכו לגעת וללטף היכן שאתם אוהבים וחושקים, מבלי למהר. עם עליית האנרגיה המינית והחרמנות שלה - התעכבו במקום שהצית אותה. גם כשאתם חשים את העוררות שלה, אל תקפצו ישר לדגדגן. להפך, השאירו מקום לציפייה, להשתוקקות שלה למגע. בינתיים, התמקדו בנקודות רגישות בגופה ובאזורים מעוררים שאתם מגלים בחקירתכם. תוך כדי מגע, הרגישות בנקודות מסוימות תשתנה, ובכלל - בכל פעם, ועם חלוף הזמן והשנים, ישנם שינויים גם באזורים שגורמים לנו לעונג. קשב הוא מילת המפתח בדרך לעינוג אישה. בשלב מאוחר יותר בדרככם אל הדגדגן ניתן יהיה לשלב אצבע בתוך הנרתיק או באזור פי הטבעת. גם צעצוע מין יוכל להעצים את החוויה.

טיפ קטן של מומחים לדגדגנים: כששניכם כבר מצויים ברמה של עוררות שיא, קחו כמה רגעים להפסקות קלות, שבהן תנשקו ותלטפו את בת הזוג, לפני שתחזרו לעצם העניין. ההפוגות הללו יעזרו להעצמת התחושה והציפייה להמשך המגע, שיכולים להוביל לאורגזמה עוצמתית במיוחד.

אפשר ורצוי לדבר עם האישה תוך כדי עינוגה ולספר לה על רצונכם לנסות דברים חדשים. תקשורת חשובה מאוד גם כשמדובר במין אוראלי.

שימו לב: נשים רבות חשות שלא בנוח ביחס לאיבר המין שלהן. ציינו בפני בת הזוג שאתם מענגים שיש לה ריח נפלא ושהכוס שלה יפה. אם אתם מרגישים שהיא לא חשה בנוח  להתנשק איתכם לאחר שירדתם לה, כדאי לבדוק מדוע היא חשה כך. חבל לפספס חלקים נפלאים של החוויה בגלל חסימות!

מכיוון שלגבר לוקח 6 דקות להגיע לאורגזמה, במקרה הטוב חברים ????, ולנשים כ-20 דקות, סבלנות היא מצרך הכרחי בסיפור, ולצדה רכות ועדינות. אם תמהרו לאורגזמה - תאבדו אותה. דבר נוסף שחשוב להבין במין בכלל הוא שמה שנעים לגבר במין שונה ממה שנשים חוות כהנאה. למשל, כדי לענג אישה חשוב להתמקד בדגדגן. לכן, כדאי לשנות תנוחות מדי פעם ולגוון לכאלה שמאפשרות לכם להגיע לדגדגן בקלות. חוויית האורגזמה של אישה משתנה בהתאם לפוזיציה, מה גם שגיוון שומר על חדשנות, סקרנות ועניין.

---

**רוצים להעמיק את התרגול?** [משחקי זוגות אונליין](/games) של מיאושי בנויים לפתוח את השיחה על מה שהיא אוהבת לפני שאתם בכלל נכנסים למיטה. לזוגות שרוצים חוויות מודרכות עם פרומפטים תמטיים יש [הסקס של מיאושי](/mioshy-sex), ולמי שרוצה תוכנית אישית עם מומחה — [ליווי עם מיאושי](/journey).

*שווה לקרוא גם: [5 התנוחות הטובות ביותר](/articles/best-sex-positions-for-couples) · [מה האישה ״צריכה״ לעשות בזמן הסקס](/articles/what-women-do-during-sex)*
$he$,

  'Itzik Berlav', true, now() - interval '3 days',
  ARRAY['couples-games','intimacy','sex-tips','her-pleasure'], 7, '✨',
  'How to Give Her Multiple Orgasms — Real Technique | Mioshy',
  'איך לגרום לה לשיא פעם אחר פעם — טכניקה אמיתית | Mioshy',
  'Patience, attention, and a path that doesn''t go straight to the clitoris. The full guide for couples who want it deeper. Plus online couples games to start the talk.',
  'סבלנות, קשב, ודרך שלא הולכת ישר לדגדגן. המדריך המלא לזוגות שרוצים את זה עמוק. וגם משחקי זוגות אונליין לפתיחת השיחה.'
),

-- ════════════════════════════════════════════════════════════
-- ARTICLE 5 — What Women Do During Sex (Reframing the Passive Role)
-- ════════════════════════════════════════════════════════════
(
  'what-women-do-during-sex',
  'What Women Should Actually Do During Sex (And Why "Just Lie There" Is the Worst Advice)',
  'אחת ולתמיד: מה האישה ״צריכה״ לעשות בזמן הסקס?',
  'A culture told women to be passive in bed and active everywhere else. Here''s what the active version of being there actually looks like — and why both partners get more from it.',
  'נשים רבות סבורות שתפקידן בסקס הוא לשכב ולתת לגבר ״לעשות את העבודה״. למה זה לא נכון, ומה כן צריך לעשות — נוכחות, קול, תזוזה, וכמה דברים שגברים לא מעיזים לבקש.',

  $en$# What Women Should Actually Do During Sex

Plenty of women have been quietly told — by movies, by friends, by silence — that their job in bed is to lie there and let it happen. The same culture that asks them to run a household, hold a career, and emotionally manage two extended families also tells them to switch off the moment the lights go down. It's a strange contradiction. It also kills the sex.

This isn't about performing for anyone. It's about being there fully, the way the rest of your life already requires.

## Be present

The most important thing you can do during sex is also the most invisible: actually be there. Not partially. Not while running through tomorrow's schedule. Fully.

This is harder than it sounds, because the brain doesn't switch off on command. A useful exercise: don't think about a blue cat. Now close your eyes for three seconds. There it was. Trying not to think about something is the surest way to think about it. The way out is sideways — through breath, through specific physical sensations, through your partner's skin under your hand. The thoughts will keep arriving. Your job is to keep coming back. A daily mindfulness habit, even five minutes, transfers directly into bed.

## Build him up — out loud

Confidence is one of the most underrated aphrodisiacs in long relationships. The more your partner feels he's getting it right, the more he tries, and the better the experience gets for both of you.

Concretely: make sounds. Use words. "I love how you're touching me." "Don't stop." "You're so good at this." If those words feel cheesy on the page, remember they don't sound cheesy in the moment — they sound like an invitation to keep going. The data from the moment doesn't have to be 100% accurate to be true; turning the volume up on your real pleasure is itself an act of generosity.

## Move

You run a household. You don't lie still while doing it. The same instinct, the same agency, belongs in the bed.

If you've fallen out of practice with using your own body actively, here's a practical progression:

1. Stand on one leg. Let the other touch the floor lightly. Shift your weight back and forth twenty times. Feel the hips moving.
2. Make small circles with your pelvis without moving the shoulders. Twenty in each direction.
3. Lie on your back and do the same circles, slowly, with intention.
4. Imagine being on top of him during step 3. Let the imagination guide the rhythm.

A week of this and your body remembers what it always knew. Bring it to bed.

## Use your hands, your nails, your teeth

Scratches, bites, the surprise of a slap on the chest — gently or not, depending on what you've both calibrated to. These add an electric current to a familiar evening. Talk about it ahead of time if you've never done it, but don't underestimate how much your partner wants you to introduce something he didn't think to ask for.

## And one place men rarely ask about

A man's anus has more nerve endings than most parts of his body. Most men have never had it touched and most are too embarrassed to bring it up. With lube and a gentle approach, it can be a small introduction that opens a much bigger door. If he's into it, you've just unlocked a new room in the relationship.

## Where to start if this feels far away

If "be more present and active in bed" sounds great in theory but distant in practice, the path back usually starts outside the bedroom. Conversations about pleasure. Permission to be specific. Small bits of play that build the muscle without the pressure of the act itself. Our [online couples games](/games) are designed for exactly that — questions and prompts that get you both used to talking about what you want, before you have to do it under spotlight.

For couples who want guided experiences with structure — themed sessions for the bedroom, designed by experts and walked through step by step — [Mioshy's Sex](/mioshy-sex) are built for that. And for couples who want a long-term coach who learns the two of you and helps reshape patterns over months, [Mioshy's coaching track](/journey) is the deeper option.

You're already running everything else. Sex is allowed to be one more place where you show up — not as someone performing for the camera, but as the same active, alive person you are when no one's watching.

*Continue with: [How to give her multiple orgasms](/articles/multiple-orgasms-for-her) · [Three steps to reclaim sexual desire](/articles/boost-sexual-desire-three-steps)*
$en$,

  $he$# אחת ולתמיד: מה האישה ״צריכה״ לעשות בזמן הסקס?

נשים רבות סבורות שתפקידן בסקס הוא לשכב ולתת לגבר ״לעשות את העבודה״. מחשבה זו היא לגיטימית ומובנת בחברה שמציבה את הנשים במקום פאסיבי בסקס, אך מטילה עליהן מטלות אקטיביות רבות אחרות, למשל באחזקת הבית. מתסכל ושגוי בכל כך הרבה רמות!

אז מה, בעצם ,את צריכה לעשות בזמן הסקס? נתחיל במספר דברים בסיסיים

* להיות נוכחת, להתמקד ברגע ולהתנתק מכל מחשבה שעולה לך בראש. אנחנו יודעים - קל להגיד וקשה לבצע, אבל הנה דוגמה קונקרטית: אל תחשבי על חתול כחול! ,עכשיו תעצמי עיניים חכי 3 שניות, הנה, אנחנו בטוחים שכרגע עברה במוחך מחשבה על חתול כחול :) לכן, חשוב לתרגל את הדבר על ידי נשימות עמוקות והתמקדות במגע ובתחושות. באופן זה נצליח להתמקד במה שקורה סביבנו ולהנות מהרגע. טיפ קטן: מחקרים מראים שתרגול מדיטציה על בסיס יומי עוזר לנו למקד את המחשבה שלנו כשאנחנו רוצים בכך.

* העצימי את הפרטנר שלך: גרמי לו להרגיש שהוא זיין-על. ככל שהוא ירגיש בטוח יותר בעצמו, בכך שהוא נוגע בך כמו שצריך ובכך שהוא משגע אותך - הדבר רק יחרמן אותו עוד יותר ויגרום לסקס עצמו להיות עוצמתי וחזק יותר. איך עושים את זה בפועל? באמצעות גניחות, למשל, או אמירת מילים שיעיפו לו את הסכך (״איזה גדול הזין שלך!״ או ״איך אתה משגע אותי, אני חייבת לגמור…!״ בינינו, הנתונים במציאות לא חייבים להיות כאלה בשביל שתאמרי זאת :) ). במילים אחרות, כשאתם עושים אהבה, נסי להעביר לבן זוגך את התחושות שלך בעצימות גבוהה יותר ממה שאת חווה. זה יעצים את הרגע שלכם ביחד.

* פייר? האישה היא השולטת בבית. ואם את הכוחות הללו שאת מפגינה בסיטואציות אחרות תכניסי אל תוך מערכת היחסים הזוגית, ובפרט אל המיטה - רק חשבי מה זה יעשה לסקס שלכם…! נשים רבות שוכבות במהלך אקט מיני ואינן מזיזות את גופן. חבל מאוד! על מנת להנות בסקס, מחד, ולהעצים את החוויה של בן הזוג, מאידך,, עלייך ללמוד להזיז את הגוף. נכון, לפעמים קשה לשבור דפוסים מושרשים, אבל אפשר להתחיל בקטן ולהשתלב בתנועתו של הגבר. איך? התחילי בכך שתבצעי תרגילים כשאת לבדך: עמדי והשעני על רגל אחת מתוחה, בעוד השנייה נוגעת בקלילות ברצפה. העבירי את מרכז הכובד מרגל לרגל כ-20 פעמים. לאחר מכן   הניעי את האגן בתנועה מעגלית. נסי לעשות זאת מבלי להזיז את הכתפיים. בשלב הבא, הניעי את האגן בתנועות סיבוביות, ולאחר מכן נסי לעשות זאת כשאת שוכבת על הגב במיטה או יושבת נמוך. דמייני שאת מעל לגבר שלך ושבמהלך התנועות המעגליות הקלות שאת מבצעת את מרגישה אותו בפנים. לאחר שתרגלת, תוכלי ליישם את זה על רטוב (:

* שריטות, נשיכות, הפלקות… בעדינות או בפראות - תלוי בכם! תבלי בהן את הסקס כדי לזכות בהתנסות חדשה ולגרום לבן הזוג לחוות רגשות עוצמתיים יותר בסקס.

* פי הטבעת של הגבר - המגע שכל גבר חייב לאזור אומץ ולנסות את כוחה! עם חומרי סיכה ובעדינות, נסי לגעת קלות בפי הטבעת שלו ולחדור אליו עם אצבע בזהירות. טיפ קטן: אם הוא בעניין והרגשת שהוא אוהב את זה, מגע כזה יוכל להביא אותו לסיבוב חדש ועוצמתי יותר. הדבר יגרום לו להתפרצות של תשוקה. זכרי, זה בידיים שלך! או בעצם, באצבע שלך ????

---

**רוצות להתחיל בקטן?** [משחקי זוגות אונליין](/games) של מיאושי הם בדיוק ההזדמנות לפתוח את השיחה על מה שאתן רוצות לנסות — לפני שאתן בכלל ניגשות לזה. לזוגות שמוכנות לחוויות מודרכות במיטה עצמה יש [הסקס של מיאושי](/mioshy-sex), ולמי שמחפשת תהליך עומק עם מומחה — [ליווי עם מיאושי](/journey).

*שווה לקרוא גם: [איך לגרום לה להגיע לשיא פעם אחר פעם](/articles/multiple-orgasms-for-her) · [שלושה שלבים לשיפור והגדלת החשק המיני](/articles/boost-sexual-desire-three-steps)*
$he$,

  'Itzik Berlav', true, now() - interval '4 days',
  ARRAY['couples-games','intimacy','her-pleasure','relationship-tips'], 8, '💋',
  'What Women Should Do During Sex — Reframing the Active Role | Mioshy',
  'מה האישה ״צריכה״ לעשות בזמן הסקס — אחת ולתמיד | Mioshy',
  'Lying still isn''t the assignment. The active version of being present in bed — presence, voice, movement, hands. Plus online couples games to ease the conversation.',
  'לשכב בשקט זו לא המשימה. הגרסה הפעילה של נוכחות במיטה — נוכחות, קול, תזוזה, ידיים. עם משחקי זוגות אונליין שמקלים על השיחה.'
);
