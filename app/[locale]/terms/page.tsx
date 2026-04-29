import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const isHe = params.locale === "he";
  return {
    title: isHe ? "תנאי שימוש — מיאושי" : "Terms of use — Mioshy",
    description: isHe
      ? "תנאי השימוש בשירות מיאושי"
      : "Terms of use for the Mioshy service",
  };
}

export default function TermsPage({
  params,
}: {
  params: { locale: string };
}) {
  const isHe = params.locale === "he";
  const L = isHe ? he : en;

  return (
    <main
      dir={isHe ? "rtl" : "ltr"}
      className="min-h-[70dvh] bg-[var(--mio-bg)] px-4 py-20 text-white"
    >
      <div className="mx-auto max-w-3xl">
        <h1 className="font-heading text-4xl font-bold tracking-tight sm:text-5xl">
          {L.title}
        </h1>
        <p className="mt-4 text-sm text-white/60">{L.lastUpdated}</p>

        <div className="mt-10 space-y-8 text-white/80">
          {L.sections.map((s, i) => (
            <section key={i}>
              <h2 className="font-heading text-xl font-bold text-white">{s.t}</h2>
              <p className="mt-3 leading-relaxed">{s.d}</p>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}

const he = {
  title: "תנאי שימוש",
  lastUpdated: "עודכן לאחרונה: אפריל 2026",
  sections: [
    {
      t: "1. השירות",
      d: "מיאושי מספקת ליווי אישי לזוגות — שאלון, ניתוח, ותוכנית שבועית של פעולות. השירות אינו תחליף לטיפול זוגי, רפואי או נפשי. אם אתם במצוקה, פנו למטפל מוסמך.",
    },
    {
      t: "2. רישום והצטרפות",
      d: "ההצטרפות פתוחה למשתמשים בני 18 ומעלה. אתם מתחייבים לספק מידע נכון ולשמור על פרטי הכניסה שלכם.",
    },
    {
      t: "3. תשלום וחיוב",
      d: "המחיר החודשי הנוכחי הוא 98 ש״ח / 33$. החיוב הוא חודשי וחוזר באופן אוטומטי עד ביטול. ניתן לבטל בכל עת דרך עמוד ״החשבון שלי״ ללא קנסות.",
    },
    {
      t: "4. קניין רוחני",
      d: "התוכן בשירות (שאלונים, ניתוחים, תוכניות, טקסטים) הוא קניינה של מיאושי. אין להעתיק או להפיץ ללא אישור בכתב.",
    },
    {
      t: "5. אחריות מוגבלת",
      d: "אנחנו עושים כל שניתן לספק ניתוח איכותי ומותאם אישית, אך השירות מסופק ״כפי שהוא״ (AS-IS). איננו מתחייבים לתוצאות ספציפיות בזוגיות שלכם.",
    },
    {
      t: "6. סיום",
      d: "אנחנו יכולים להפסיק את הגישה לשירות למשתמש שמפר את התנאים. אתם יכולים לבטל את המנוי בכל עת.",
    },
    {
      t: "7. יצירת קשר",
      d: "לכל שאלה — hello@mioshy.com.",
    },
  ],
};

const en = {
  title: "Terms of use",
  lastUpdated: "Last updated: April 2026",
  sections: [
    {
      t: "1. The service",
      d: "Mioshy provides personal guidance for couples — a questionnaire, analysis, and a weekly plan of actions. The service is not a substitute for couples therapy, medical care, or mental-health treatment. If you're in distress, please contact a licensed professional.",
    },
    {
      t: "2. Sign-up",
      d: "Sign-up is open to users 18 and older. You agree to provide accurate information and to safeguard your login credentials.",
    },
    {
      t: "3. Payment and billing",
      d: "The current monthly price is 98 ILS / $33. Billing is monthly and recurs automatically until canceled. You can cancel anytime from your Account page with no penalties.",
    },
    {
      t: "4. Intellectual property",
      d: "All content in the service (questionnaires, analyses, plans, copy) is the property of Mioshy. No copying or distribution without written permission.",
    },
    {
      t: "5. Limited warranty",
      d: "We work hard to deliver high-quality, personalized analysis, but the service is provided AS IS. We don't guarantee specific outcomes in your relationship.",
    },
    {
      t: "6. Termination",
      d: "We may suspend access for users who violate these terms. You may cancel your subscription anytime.",
    },
    {
      t: "7. Contact",
      d: "Any questions — hello@mioshy.com.",
    },
  ],
};
