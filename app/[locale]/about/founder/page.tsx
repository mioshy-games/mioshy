import type { Metadata } from "next";
import { Link } from "@/navigation";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";

/**
 * /[locale]/about/founder
 *
 * The personal story of Itzik Berlev - Mioshy's founder. Linked from the
 * Founder section CTA on the homepage ("קראו את הסיפור המלא").
 *
 * Design direction
 * ────────────────
 * Editorial long-form, NOT corporate "about us". The page reads like a
 * magazine feature: tight reading column (~680px, the cognitive-psychology
 * sweet spot for sustained reading), serif chapter titles, sans body, pull
 * quotes that interrupt the flow at the right moments, and a long quiet
 * closing CTA back to the product.
 *
 * The story has 8 chapters that are tonally distinct - crisis → decision →
 * study → breakthrough → insight → founding → naming → invitation. The
 * naming chapter (the Italian etymology) is the best moment of the whole
 * piece and gets its own visual treatment - it's the brand's emotional
 * keystone.
 *
 * Localization
 * ────────────
 * Currently Hebrew-only. The story is deeply personal and Itzik wrote it
 * in Hebrew; an English translation should be a separate copy pass, not a
 * machine translation. Until then, the EN locale falls back to the same
 * Hebrew copy with English chrome (eyebrows, CTAs).
 */

export const dynamic = "force-static";

const BODY_FONT =
  "var(--font-body-hebrew), 'Assistant', system-ui, sans-serif";
const SERIF_FONT = "'Frank Ruhl Libre', serif";

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const isHe = params.locale === "he";
  return {
    title: isHe
      ? "איציק ברלב - הסיפור שמאחורי מיאושי"
      : "Itzik Berlev - The Story Behind Mioshy",
    description: isHe
      ? "המסע האישי של איציק ברלב, מייסד מיאושי - מהמשבר הזוגי שכמעט פירק את הנישואים, דרך 600 ספרים בשלוש שפות, ועד למיאושי. הסיפור שיכול להיות גם שלכם."
      : "The personal journey of Itzik Berlev, Mioshy's founder - from a near-breakup, through 600 books in three languages, to founding Mioshy. A story that could be yours too.",
    openGraph: {
      type: "article",
      authors: ["Itzik Berlev"],
      images: ["/images/itzik-barlev.webp"],
    },
  };
}

export default function FounderStoryPage({
  params,
}: {
  params: { locale: string };
}) {
  const isHe = params.locale === "he";
  const Arrow = isHe ? ArrowLeft : ArrowRight;

  return (
    <article
      dir={isHe ? "rtl" : "ltr"}
      className="relative min-h-[100dvh] overflow-hidden bg-[#fdf8f4] text-stone-900"
      style={{ fontFamily: BODY_FONT }}
    >
      {/* Soft warm gradient wash - cream → peach at the top so the page
          reads like an open book rather than a flat content page. The
          gradient is purely decorative; pointer-events-none keeps it
          out of any selection. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[60vh] bg-[linear-gradient(180deg,#fff0e6_0%,#fdf2ec_45%,#fdf8f4_100%)]"
      />

      {/* ───── HERO ───── */}
      <header className="relative z-10 mx-auto max-w-[920px] px-5 pt-12 sm:pt-16">
        {/* Back link - quiet, doesn't compete with the headline */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-stone-500 transition hover:text-stone-900"
        >
          <Arrow className="h-3.5 w-3.5" />
          {isHe ? "חזרה למיאושי" : "Back to Mioshy"}
        </Link>

        {/* Eyebrow + bold name treatment. The name itself is the page's
            strongest asset - set big, in serif, with an underline accent. */}
        <div className="mt-10 sm:mt-14">
          <p
            className="text-[12px] font-semibold uppercase tracking-[0.32em] text-rose-600/80"
            style={{ fontFamily: BODY_FONT }}
          >
            {isHe ? "הסיפור שמאחורי מיאושי" : "The story behind Mioshy"}
          </p>
          <h1
            className="mt-4 text-[42px] leading-[1.05] tracking-tight text-stone-900 sm:text-[56px] lg:text-[72px]"
            style={{ fontFamily: SERIF_FONT, fontWeight: 700 }}
          >
            איציק <em style={{ fontStyle: "italic", color: "#c2410c" }}>ברלב</em>
          </h1>
          <p
            className="mt-4 text-[15px] text-stone-500 sm:text-[16px]"
            style={{ fontFamily: BODY_FONT }}
          >
            {isHe
              ? "בן 45 · נשוי 17 שנה · אבא לליאן (16), נדב (14) ונועם (7) · מייסד מיאושי"
              : "45 · Married 17 years · Father to Lian, Nadav and Noam · Founder of Mioshy"}
          </p>
        </div>

        {/* Hero photo - editorial frame.
            Aspect changed from 16:10 → 4:3 because the source photo is a
            seated portrait with Itzik's head near the top of the frame; a
            wide letterbox crop sliced his face. 4:3 keeps more vertical
            room AND object-position 'center top' anchors the crop from
            the top so the head stays visible at every viewport size. */}
        <figure className="relative mt-10 overflow-hidden rounded-[28px] shadow-[0_30px_70px_-25px_rgba(120,53,15,0.4)] sm:mt-14">
          <div className="aspect-[4/3] w-full bg-stone-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/itzik-barlev.webp"
              alt={isHe ? "איציק ברלב" : "Itzik Berlev"}
              className="h-full w-full object-cover"
              style={{ objectPosition: "center top" }}
            />
          </div>
        </figure>

        {/* Big pull quote that hooks the reader before chapter 1.
            The job of this quote: make a stranger commit to reading the
            next 5 minutes. It promises the arc of the whole story - the
            crisis, the journey, and the outcome - in one breath. */}
        <blockquote
          className="mx-auto mt-12 max-w-[680px] text-center sm:mt-16"
          style={{ fontFamily: SERIF_FONT }}
        >
          <p
            className="text-[26px] leading-[1.3] text-stone-900 sm:text-[32px]"
            style={{ fontStyle: "italic", fontWeight: 500 }}
          >
            &quot;פעם חשבנו להתפרק. היום אני בונה משחקים שמחזירים לאלפי זוגות
            את התשוקה שאיבדו.&quot;
          </p>
        </blockquote>
      </header>

      {/* ───── BODY (chapters) ───── */}
      <main className="relative z-10 mx-auto mt-16 max-w-[680px] px-5 pb-24 sm:mt-20 sm:pb-32">
        <Chapter num={1} title="הרגע שכמעט פירק אותנו">
          <Lede>
            כמו אצל הרבה זוגות, גם אצלנו זה התחיל בלי דרמה. הילדים עוד היו
            קטנים, החיים זזו מהר, ואיכשהו, באיזשהו רגע, הבטנו אחת בשני וכבר לא
            זיהינו את עצמנו.
          </Lede>
          <p>
            השגרה הצמיחה רגליים. עבודה, גן, ארוחות ערב, הרדמת ילדים, שינה.
            ובסוף השבוע - אותו דבר. כשניסינו להזכר מתי בפעם האחרונה צחקנו ביחד
            עד דמעות, באמת לא ידענו לענות.
          </p>
          <p>
            כששיחה אחת לא הספיקה, פנינו לייעוץ זוגי. כשגם זה לא היה מספיק,
            הוספנו סקסולוגית. ישבנו מול אנשים מקצועיים, דיברנו, בכינו, ניסינו.
          </p>
          <p className="font-semibold text-stone-900">
            וזה לא עזר.
          </p>
        </Chapter>

        <Chapter num={2} title="ההחלטה - לקחת את זה לידיים">
          <p>
            הייתי יכול להמשיך לחפש מטפל אחר, גישה אחרת, איזשהו פתרון מבחוץ.
            במקום זה, החלטתי משהו אחר: אם אף אחד לא הולך להציל את הזוגיות
            שלנו - אני אעשה את זה בעצמי.
          </p>
          <p>
            הפסקתי לחכות לתשובות. התחלתי לחפש אותן. מה השתבש בדרך? איפה איבדנו
            אחד את השני? והכי חשוב - האם בכלל אפשר לחזור?
          </p>
          <p>
            ידעתי שזה לא ייפתר בסוף שבוע ארוך. אם אני רוצה לראות שוב את אושרת
            כפי שראיתי אותה כשהכרתי אותה - אצטרך ללכת עם זה עד הסוף.
          </p>
        </Chapter>

        <Chapter num={3} title="מאות ספרים. שלוש שפות.">
          <p>
            התחלתי לקרוא. בעברית, באנגלית, ובאיטלקית - שלוש שפות, מאות ספרים.
            זוגיות, תשוקה, אהבה, פסיכולוגיה, סקסולוגיה. כל מה שמצאתי, קראתי.
            בלילות, אחרי שהילדים נרדמו, בנסיעות לעבודה, בכל חור של זמן.
          </p>
          <p>
            לא הסתפקתי בספרים. נרשמתי לקורסים - ייעוץ זוגי, NLP, סקסולוגיה.
            רציתי שיהיה לי גם הידע התיאורטי וגם הכלים המעשיים. רציתי להבין את
            זה כל הדרך עד הסוף.
          </p>
          <PullQuote>
            לא חיפשתי תיאוריה. חיפשתי תרופה.
          </PullQuote>
          <p>
            וככל שצללתי עמוק יותר, התחלתי לראות שהסיפור שלנו לא יוצא דופן.
            זוגות נופלים שוב ושוב לאותן המלכודות. אבל גיליתי גם משהו אחר -
            שיש דרכים אחרות לצאת מהן. לא דרך הספה אצל המטפל, ולא דרך לילות
            של בכי. דרכים שמרגישות אחרת לגמרי. קלות יותר. חמות יותר. ביחד.
          </p>
        </Chapter>

        <Chapter num={4} title="הרגע שהבנתי שזה עובד">
          <p>
            התוצאה לא איחרה לבוא. החזרנו את התשוקה. את המבטים מעבר לחדר. את
            הצחוק שקיים רק בין שני אנשים שבחרו אחד בשני, וזוכרים בדיוק למה.
          </p>
          <p>
            לא היה רגע אחד דרמטי. היה תהליך. אבל בנקודה מסוימת הסתכלתי על
            אושרת והבנתי שמשהו השתנה - אנחנו שוב <em style={{ fontStyle: "italic" }}>אנחנו</em>.
            וכל מה שעברנו עד אז לא היה הסוף - הוא היה התחלה חדשה.
          </p>
        </Chapter>

        <Chapter num={5} title="למה דווקא משחקים">
          <p>
            תמיד אהבתי משחקים. את הדרך שבה הם פותחים שיחות שלעולם לא היו
            נפתחות אחרת. את האופן שבו הם מאפשרים להיות פגיעים בלי להרגיש
            מאוימים. את זה שבמשחק, מותר לשאול מה שלא היית מעז לשאול בארוחת ערב.
          </p>
          <p>
            ברגע שחיברתי בין הידע שצברתי לבין האהבה הזאת - הבנתי שיש פה משהו.
            התחלתי ליצור משחקים. בהתחלה רק לאושרת ולי. אחר-כך לחברים קרובים -
            אלה שראיתי אצלם את אותם הדפוסים שהיו אצלנו. הם עבדו. שם, בסלון,
            על השולחן בארוחת ערב - הם פשוט עבדו.
          </p>
          <p>
            וזה היה הרגע שבו הבנתי שאני לא יכול לשמור את זה לעצמי.
          </p>
        </Chapter>

        <Chapter num={6} title="ככה נולדה מיאושי">
          <p>
            עם הידע שצברתי, עם האהבה שלי למשחקים, ועם ההבנה שזה באמת עובד -
            התחלתי לבנות משהו גדול יותר. מקום שיתן לזוגות אחרים את אותם
            הכלים בדיוק שעזרו לנו, בלי שיצטרכו לעבור את הדרך הארוכה שאני
            עברתי.
          </p>
          <p>
            ככה נולדה מיאושי. בית - יצירתי, חם, חכם, ועם מטרה אחת ברורה:
            להחזיר לזוגיות את הרוח שלה. המשחקים שפיתחתי לאורך השנים מובילים
            אתכם למסע שמחבר אתכם מחדש - בתקשורת, בתשוקה, באינטימיות. אנחנו
            לא בקדמת הבמה. אנחנו ברקע, מלווים. צעד אחר צעד.
          </p>
          <p>
            ולמי שמוכן ללכת רחוק יותר - פתחנו דלת גם לעולם של אביזרי המין.
            בעדינות, בהדרגה, דרך מארזי תשוקה ומשחקים שיצרנו במיוחד למטרה הזו.
            תמיד באיכות. תמיד בטעם טוב. ותמיד ממקום שאנחנו עומדים מאחוריו -
            כי גם אנחנו עברנו את הדרך הזו.
          </p>
        </Chapter>

        {/* ───── THE NAMING CHAPTER ───── */}
        {/* This is the brand's emotional keystone. Visually it deserves its
            own treatment - a soft accent card with the Italian etymology
            broken out so the reader sees the wordplay rather than parsing
            it from prose. */}
        <Chapter num={7} title='למה "מיאושי"?'>
          <Lede>
            השם &quot;מיאושי&quot; לא הומצא בחדר ישיבות, ולא נבחר על ידי משרד פרסום.
            הוא יצא מתוך הסיפור הכי אישי שלנו.
          </Lede>
          <p>
            ארבע שנים מטריפות ביליתי באיטליה - עם אושרת, אשתי, שאז עוד הייתה
            החברה שלי. איטלקית - השפה הסקסית ביותר שיש - נכנסה לי לדם. כשחזרנו
            הביתה, היא נשארה איתנו. כינויי החיבה, המשפטים הקטנים, הצורה שבה
            קוראים לאהוב.
          </p>
          <p>וככה, בלי שתכננו, נבנה גם השם:</p>

          {/* Etymology breakout - three rows, each a piece of the name */}
          <div
            className="my-8 rounded-[20px] border border-amber-200/70 bg-gradient-to-br from-amber-50 to-rose-50/60 px-6 py-7 sm:px-8 sm:py-8"
            dir="rtl"
          >
            <div className="space-y-5">
              <EtymologyRow
                italian="Mio"
                meaning='בְּאיטלקית: "שלי"'
              />
              <EtymologyRow
                italian="Oshi"
                meaning="הכינוי שלי לאהובתי, אושרת"
              />
              <div className="border-t border-amber-200/60 pt-5">
                <EtymologyRow
                  italian="Mio · Oshi"
                  meaning='"אישה שלי" · "אושי שלי"'
                  emphasized
                />
              </div>
              <div className="pt-2 text-center">
                <span
                  className="inline-block bg-gradient-to-br from-rose-600 to-amber-600 bg-clip-text text-[44px] leading-none text-transparent sm:text-[56px]"
                  style={{ fontFamily: SERIF_FONT, fontWeight: 700 }}
                >
                  Mioshy
                </span>
                <p
                  className="mt-2 text-[14px] text-stone-600"
                  style={{ fontFamily: BODY_FONT }}
                >
                  מיאושי
                </p>
              </div>
            </div>
          </div>

          <p>
            כל פעם שמישהו אומר את השם, הוא בעצם אומר את המשפט הכי אינטימי
            שיכול להיות בין שני אנשים - <em style={{ fontStyle: "italic" }}>
            אישה שלי</em>. וזה בדיוק מה שמיאושי עוסקת בו.
          </p>
        </Chapter>

        <Chapter num={8} title="הסיפור הזה יכול להיות גם שלכם">
          <p>
            מאהבה ותשוקה ענקיות, דרך הדעיכה שמביא איתו הזמן, ומשם - הצתה
            חוזרת של כל מה שהדליק אותנו פעם, באיטליה, בתחילת הדרך.
          </p>
          <p>
            הסיפור הזה לא רק שלי. הוא של אלפי זוגות שעברו אותו דרך מיאושי.
            ובדיוק בשביל זה הקמתי את המקום הזה - כדי שלא תצטרכו לקרוא מאות
            ספרים, לעבור עשרות קורסים, ולעשות את הטעויות שאנחנו עשינו, לפני
            שתחזרו לעצמכם.
          </p>
          <p className="font-semibold text-stone-900">
            אל תחיו &quot;ליד&quot;.
          </p>
        </Chapter>

        {/* ───── CLOSING CTA ─────
            Primary "התחילו את המסע שלכם" routes to /journey by request -
            after a 7-minute personal-letter read, the reader is in the
            highest emotional readiness state of the funnel and the right
            move is to drop them into the most committed product (Journey)
            rather than the homepage. */}
        <div className="mt-16 rounded-[28px] border border-rose-200/60 bg-gradient-to-br from-rose-50 to-amber-50 px-7 py-10 text-center sm:mt-20 sm:px-10 sm:py-12">
          <Sparkles className="mx-auto h-5 w-5 text-rose-500" />
          <h2
            className="mx-auto mt-4 max-w-[440px] text-[26px] leading-[1.2] text-stone-900 sm:text-[32px]"
            style={{ fontFamily: SERIF_FONT, fontWeight: 700 }}
          >
            עשו צעד גדול אל אהבה עוצמתית מחודשת.
          </h2>
          <p
            className="mx-auto mt-4 max-w-[420px] text-[15px] leading-[1.6] text-stone-700"
            style={{ fontFamily: BODY_FONT }}
          >
            הצטרפו אל מיאושי. הכלים שעזרו לנו, מחכים גם לכם.
          </p>
          <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/journey"
              className="group relative inline-flex min-h-[52px] items-center gap-2 overflow-hidden rounded-full px-8 text-[15px] font-semibold text-white shadow-2xl shadow-rose-500/30 transition hover:brightness-110"
            >
              <span
                aria-hidden
                className="absolute inset-0 bg-[linear-gradient(110deg,#f43f5e_0%,#ec4899_45%,#a855f7_100%)]"
              />
              <span className="relative z-10 inline-flex items-center gap-2">
                {isHe ? "התחילו את המסע שלכם" : "Start your journey"}
                <Arrow className="h-4 w-4 transition group-hover:-translate-x-1" />
              </span>
            </Link>
          </div>
        </div>

        {/* Footer note - soft sign-off, the equivalent of "yours, Itzik" at
            the bottom of a long letter. Marketing surfaces below the article
            (footer / nav) make the page feel like a real read instead of a
            trapped destination. */}
        <p
          className="mt-12 text-center text-[13px] italic text-stone-500"
          style={{ fontFamily: SERIF_FONT }}
        >
          באהבה,
          <br />
          איציק
        </p>
      </main>
    </article>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponents - kept inline so the page reads top-to-bottom as a story.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Chapter - numbered section with a serif title. The number is set in
 * italic-serif rose, the title in a heavier serif, and there's a thin
 * horizontal rule between chapters so the reader's eye gets a beat to
 * breathe between sections.
 */
function Chapter({
  num,
  title,
  children,
}: {
  num: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-14 first:mt-0 sm:mt-16">
      {/* Chapter divider - only show above non-first chapters; the first
          chapter sits directly under the hero pull-quote. */}
      {num > 1 ? (
        <div
          aria-hidden
          className="mx-auto mb-12 h-px w-24 bg-gradient-to-r from-transparent via-rose-300/70 to-transparent sm:mb-14"
        />
      ) : null}

      <div className="mb-6 flex items-baseline gap-3">
        <span
          className="text-[28px] leading-none text-rose-500/80 sm:text-[32px]"
          style={{
            fontFamily: SERIF_FONT,
            fontStyle: "italic",
            fontWeight: 500,
          }}
          aria-hidden
        >
          {String(num).padStart(2, "0")}
        </span>
        <h2
          className="text-[26px] leading-[1.2] tracking-tight text-stone-900 sm:text-[32px]"
          style={{ fontFamily: SERIF_FONT, fontWeight: 700 }}
        >
          {title}
        </h2>
      </div>

      <div
        className="space-y-5 text-[17px] leading-[1.78] text-stone-800 sm:text-[18px]"
        style={{ fontFamily: BODY_FONT }}
      >
        {children}
      </div>
    </section>
  );
}

/**
 * Lede - the first paragraph of a chapter, slightly heavier weight + a
 * touch larger than body. Editorial convention; signals "this is the
 * opening claim of the section, lean in".
 */
function Lede({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[19px] font-medium leading-[1.7] text-stone-900 sm:text-[20px]">
      {children}
    </p>
  );
}

/**
 * PullQuote - interrupts the flow at a key emotional beat. Larger, italic,
 * serif, and indented from the body so the eye knows it's not regular text.
 */
function PullQuote({ children }: { children: React.ReactNode }) {
  return (
    <blockquote
      className="my-8 border-s-[3px] border-rose-400/70 ps-5 text-[22px] leading-[1.4] text-stone-900 sm:my-10 sm:text-[26px]"
      style={{ fontFamily: SERIF_FONT, fontStyle: "italic", fontWeight: 500 }}
    >
      {children}
    </blockquote>
  );
}

/**
 * EtymologyRow - used inside the naming chapter to break down the Italian
 * roots of "Mioshy". Two columns: the Italian word large in serif, the
 * Hebrew meaning in body sans on the right.
 */
function EtymologyRow({
  italian,
  meaning,
  emphasized,
}: {
  italian: string;
  meaning: string;
  emphasized?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span
        className={`${
          emphasized ? "text-[28px] sm:text-[34px]" : "text-[24px] sm:text-[28px]"
        } leading-none text-stone-900`}
        style={{
          fontFamily: SERIF_FONT,
          fontStyle: "italic",
          fontWeight: emphasized ? 700 : 500,
        }}
      >
        {italian}
      </span>
      <span
        className={`text-[14px] text-stone-700 sm:text-[15px] ${
          emphasized ? "font-semibold text-stone-900" : ""
        }`}
        style={{ fontFamily: BODY_FONT }}
      >
        {meaning}
      </span>
    </div>
  );
}
