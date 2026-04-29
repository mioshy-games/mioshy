import { TrackedLink } from "./TrackedLink";
import { RevealOnScroll } from "./RevealOnScroll";
import { Counter } from "./Counter";
import { ParallaxImage } from "./ParallaxImage";

/**
 * Hero — first section of HomepageV2.
 * Dark animated background with 5 floating blobs, headline, lead paragraph,
 * primary + secondary CTAs, social-proof meta strip, and right-side image
 * with two floating badge cards.
 *
 * Animations:
 *  • Headline: scale-up reveal (94% → 100%) on first paint
 *  • Lead, CTAs, meta: fade-up reveal staggered
 *  • Stat numbers: count-up from 0 when in view
 *  • Hero image: subtle parallax on scroll (16px range)
 *  • Background blobs: CSS-driven (in styles.css), pause on reduced-motion
 */
export function Hero() {
  return (
    <section className="hero">
      <div className="hero-bg">
        <div className="hero-blob hero-blob-1"></div>
        <div className="hero-blob hero-blob-2"></div>
        <div className="hero-blob hero-blob-3"></div>
        <div className="hero-blob hero-blob-4"></div>
        <div className="hero-blob hero-blob-5"></div>
        {/* Drifting sparkles — same vibe as the /adults ambience.
            CSS-only (see .hero-spark in styles.css). Each spark gets a
            different size / position / drift duration via nth-child so
            the field never repeats in lockstep. */}
        <div className="hero-particles" aria-hidden>
          {Array.from({ length: 18 }).map((_, i) => (
            <span key={i} className={`hero-spark hero-spark-${(i % 6) + 1}`}></span>
          ))}
        </div>
      </div>
      <div className="hero-grain"></div>
      <div className="container">
        <div className="hero-grid">
          <div className="hero-text">
            <RevealOnScroll variant="fade-up" delay={0}>
              <div className="hero-tag">
                <span className="dot"></span> מלווים זוגות בישראל מאז 2021
              </div>
            </RevealOnScroll>

            <RevealOnScroll variant="scale-up" delay={0.05}>
              {/*
                Hero headline — short on purpose. The previous version
                ("אתם חיים יחד… מתי הייתם באמת יחד") was a poetic question;
                lovely on a billboard, but slow to parse. A new visitor
                needs to know what Mioshy IS in the first second of scroll.
                "פלפל" carries the brand voice (playful, alive, slightly
                cheeky) without being therapy-coded or sex-coded. The em
                tag lights up the keyword in serif italic.
              */}
              <h1>
                זוגיות — רק עם קצת יותר <em>פלפל</em>.
              </h1>
            </RevealOnScroll>

            <RevealOnScroll variant="fade-up" delay={0.15}>
              {/*
                Sub-line earns its keep by NAMING the three pillars in one
                breath — anyone scanning the hero now knows in 8 seconds
                exactly what's on offer.
                The closer ("בלי לרוקן את הכיס, בלי ממחטות — זוגיות עושים
                באהבה") evolved through a few drafts:
                  • "בלי טיפול, בלי קורסים"   — self-contradicting (Journey
                                                  is a form of coaching);
                                                  also "courses" isn't a real
                                                  pain point people relate to.
                  • "בלי לרוקן את הכיס"        — affordability differentiator,
                                                  honest + real advantage.
                  • "בלי ממחטות"               — visual / emotional swap for
                                                  "no therapy". Implies the
                                                  brand doesn't dwell in heavy
                                                  emotional places. Couples
                                                  here laugh more than they cry.
                The closing turn ("עושים באהבה") flips the two negatives into
                a warm positive — same rhythm trick as the headline's פלפל.
              */}
              <p className="lead">
                משחקי זוגיות, חוויות אינטימיות וליווי אישי — מקום אחד שמחזיר
                לכם את הניצוץ. בלי לרוקן את הכיס, בלי ממחטות — זוגיות עושים
                באהבה.
              </p>
            </RevealOnScroll>

            <RevealOnScroll variant="fade-up" delay={0.25}>
              <div className="hero-actions">
                <TrackedLink href="/journey" className="btn btn-primary" ctaId="hero_primary" section="hero">
                  התחילו את המסע שלכם <span className="arrow">←</span>
                </TrackedLink>
                <TrackedLink href="/how-it-works" className="btn btn-ghost" ctaId="hero_secondary" section="hero">
                  איך זה עובד?
                </TrackedLink>
              </div>
            </RevealOnScroll>

            <RevealOnScroll variant="fade-up" delay={0.35}>
              <div className="hero-meta">
                <div className="hero-meta-item">
                  <span className="num">
                    <Counter to={1000} prefix="+" />
                  </span>
                  <span className="label">זוגות פעילים</span>
                </div>
                <div className="hero-meta-item">
                  <span className="num">
                    <Counter to={10} prefix="+" />
                  </span>
                  <span className="label">מומחים בשבילכם</span>
                </div>
                <div className="hero-meta-item">
                  <span className="num">
                    <Counter to={4.8} decimals={1} suffix="★" thousands={false} />
                  </span>
                  <span className="label">דירוג ממוצע</span>
                </div>
              </div>
            </RevealOnScroll>
          </div>

          <div className="hero-visual">
            <ParallaxImage
              src="/images/hero.webp"
              alt="זוג מצחקק יחד ברגע יומיומי חמים"
              width={720}
              height={900}
              className="hero-img"
              priority
              range={16}
            />
            <div className="badge-floating badge-1">
              <div className="badge-icon">♡</div>
              <div className="badge-text">
                <div className="t1">משחק חדש זמין</div>
                <div className="t2">&quot;שאלות שלא שאלנו&quot;</div>
              </div>
            </div>
            <div className="badge-floating badge-2">
              <div className="badge-icon">✦</div>
              <div className="badge-text">
                <div className="t1">השבוע שלכם</div>
                <div className="t2">הניצוץ חזר הלילה</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
