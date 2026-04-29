import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const isHe = params.locale === "he";
  return {
    title: isHe ? "פרטיות — מיאושי" : "Privacy — Mioshy",
    description: isHe
      ? "מדיניות הפרטיות של מיאושי"
      : "Privacy policy for the Mioshy service",
  };
}

export default function PrivacyPage({
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
  title: "מדיניות פרטיות",
  lastUpdated: "עודכן לאחרונה: אפריל 2026",
  sections: [
    {
      t: "1. מה אנחנו אוספים",
      d: "פרטי חשבון (שם, מייל, טלפון) ותשובות השאלון שלכם. המידע הזה נחוץ כדי לבנות עבורכם את הניתוח והתוכנית.",
    },
    {
      t: "2. איך אנחנו משתמשים במידע",
      d: "אך ורק כדי לספק לכם את השירות: ניתוח, תוכנית שבועית, שליחת משימות במייל/ווטסאפ, ותמיכה. לא נשתמש במידע שלכם למטרות שיווקיות חיצוניות.",
    },
    {
      t: "3. מי רואה את התשובות",
      d: "אתם. הצוות של מיאושי — רק חברי צוות הליווי. אנחנו לא מוכרים, לא משכירים, ולא מפרסמים את התשובות או הניתוח שלכם.",
    },
    {
      t: "4. איפה המידע שמור",
      d: "במסדי נתונים מאובטחים של ספקי תשתית רשומים (Supabase / Vercel). הגישה מוגבלת בהרשאות ומצפנת.",
    },
    {
      t: "5. זכויותיכם",
      d: "אתם יכולים בכל עת לבקש לקבל עותק של המידע שלכם, לעדכן אותו, או למחוק את החשבון שלכם — צרו קשר ב- hello@mioshy.com.",
    },
    {
      t: "6. Cookies",
      d: "אנחנו משתמשים ב-cookie בסיסי אחד לשמירת זהות הסשן ובאחד לשמירת העדפת שפה. אין קובצי מעקב שיווקי צד-שלישי.",
    },
    {
      t: "7. שינויים במדיניות",
      d: "אם נשנה את המדיניות הזאת, נעדכן את התאריך למעלה ונשלח הודעה במייל למשתמשים פעילים.",
    },
  ],
};

const en = {
  title: "Privacy policy",
  lastUpdated: "Last updated: April 2026",
  sections: [
    {
      t: "1. What we collect",
      d: "Account details (name, email, phone) and your questionnaire answers. This is necessary to build your analysis and plan.",
    },
    {
      t: "2. How we use it",
      d: "Solely to deliver the service: analysis, weekly plan, sending tasks by email/WhatsApp, and support. We will not use your data for external marketing.",
    },
    {
      t: "3. Who sees the answers",
      d: "You. The Mioshy team — only members of the care team. We don't sell, rent, or publish your answers or analysis.",
    },
    {
      t: "4. Where data is stored",
      d: "In secure databases with registered infrastructure providers (Supabase / Vercel). Access is permission-gated and encrypted.",
    },
    {
      t: "5. Your rights",
      d: "You can request a copy of your data, update it, or delete your account at any time — contact hello@mioshy.com.",
    },
    {
      t: "6. Cookies",
      d: "We use one basic cookie for session identity and one for language preference. No third-party marketing trackers.",
    },
    {
      t: "7. Changes",
      d: "If we change this policy we'll update the date at the top and email active users.",
    },
  ],
};
