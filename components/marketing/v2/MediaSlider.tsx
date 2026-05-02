// Side-effect import: ensures the v2 scoped styles are loaded whenever
// MediaSlider is rendered, even on pages that don't import HomepageV2.
// Safe because CSS imports are de-duplicated by Next.js.
import "./styles.css";

import Image from "next/image";
import { useTranslations } from "next-intl";

/**
 * MediaSlider - editorial press table.
 *
 * Same design language as the new Benefits section: right-aligned
 * editorial header, stacked rows with [logo | quote | CTA], hairline
 * dividers between rows, layered drifting white gradients underneath
 * the cream surface for breathable depth.
 *
 * Static (no rotation) - both publications are visible at once,
 * each in its own row. Click "קראו את הכתבה" to open the article in a
 * new tab.
 *
 * Server-rendered (no use-client) - there's no interactive state.
 */
export function MediaSlider() {
  const t = useTranslations("homeV2.media");

  const ITEMS = [
    {
      name: t("item1Name"),
      date: t("item1Date"),
      quote: t("item1Quote"),
      url: "https://www.israelhayom.co.il/mumlazim/article/13374120",
      logoSrc: "/images/israel.webp",
      logoAlt: t("item1LogoAlt"),
    },
    {
      name: t("item2Name"),
      date: t("item2Date"),
      quote: t("item2Quote"),
      url: "https://tld.walla.co.il/item/3528908",
      logoSrc: "/images/walla.webp",
      logoAlt: t("item2LogoAlt"),
    },
  ];

  return (
    <section className="media-press">
      <div className="media-press-wrap">
        {/* Editorial header - right-aligned (RTL natural axis). */}
        <header className="media-press-head">
          <div className="media-press-eyebrow">
            <span className="media-press-dot" aria-hidden="true" />
            <span>{t("eyebrow")}</span>
          </div>
          <h2 className="media-press-title">
            {t.rich("headline", { em: (chunks) => <em>{chunks}</em> })}
          </h2>
        </header>

        {/* Editorial table rows - 2-column grid: [Logo | Content].
            CTA lives INSIDE the content column, right-aligned (RTL start)
            so it sits next to the right edge of the quote text. */}
        <ul className="media-press-rows">
          {ITEMS.map((item, i) => (
            <li key={i} className="media-press-row">
              {/* Logo column */}
              <div className="media-press-row-logo">
                <Image
                  src={item.logoSrc}
                  alt={item.logoAlt}
                  width={200}
                  height={64}
                  unoptimized
                />
              </div>

              {/* Content column - quote, meta, then CTA right-aligned */}
              <div className="media-press-row-content">
                <p className="media-press-quote">
                  <span aria-hidden="true">״</span>
                  {item.quote}
                  <span aria-hidden="true">״</span>
                </p>

                <div className="media-press-row-meta">
                  <span className="media-press-name">{item.name}</span>
                  <span className="media-press-sep" aria-hidden="true">
                    ·
                  </span>
                  <span className="media-press-date">{item.date}</span>
                </div>

                {/* CTA - italic serif, no border, no bg. Pure editorial link. */}
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="media-press-row-cta"
                >
                  <span>{t("readArticle")}</span>
                  <span className="arrow" aria-hidden="true">
                    ←
                  </span>
                </a>
              </div>
            </li>
          ))}
          {/* Final hairline so the last row has bottom symmetry */}
          <li aria-hidden className="media-press-row-end" />
        </ul>
      </div>
    </section>
  );
}
