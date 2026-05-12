"use client";

// Side-effect import: ensures the v2 scoped styles are loaded whenever
// MediaSlider is rendered, even on pages that don't import HomepageV2.
// Safe because CSS imports are de-duplicated by Next.js.
import "./styles.css";

import Image from "next/image";
import { useCmsText } from "@/hooks/useCmsText";
import { CmsText } from "@/components/cms/CmsText";

/**
 * MediaSlider - editorial press table.
 *
 * Same design language as the new Benefits section: right-aligned
 * editorial header, stacked rows with [logo | quote | CTA], hairline
 * dividers between rows, layered drifting white gradients underneath
 * the cream surface for breathable depth.
 *
 * Static (no rotation) — both publications are visible at once,
 * each in its own row.
 *
 * CMS-migrated (Sprint 1). headline carries <em>.
 */
export function MediaSlider() {
  const eyebrow = useCmsText("homeV2.media.eyebrow");
  const readArticle = useCmsText("homeV2.media.readArticle");

  const item1Name = useCmsText("homeV2.media.item1Name");
  const item1Date = useCmsText("homeV2.media.item1Date");
  const item1Quote = useCmsText("homeV2.media.item1Quote");
  const item1LogoAlt = useCmsText("homeV2.media.item1LogoAlt");
  const item2Name = useCmsText("homeV2.media.item2Name");
  const item2Date = useCmsText("homeV2.media.item2Date");
  const item2Quote = useCmsText("homeV2.media.item2Quote");
  const item2LogoAlt = useCmsText("homeV2.media.item2LogoAlt");

  const ITEMS = [
    {
      name: item1Name,
      date: item1Date,
      quote: item1Quote,
      url: "https://www.israelhayom.co.il/mumlazim/article/13374120",
      logoSrc: "/images/israel.webp",
      logoAlt: item1LogoAlt.text,
    },
    {
      name: item2Name,
      date: item2Date,
      quote: item2Quote,
      url: "https://tld.walla.co.il/item/3528908",
      logoSrc: "/images/walla.webp",
      logoAlt: item2LogoAlt.text,
    },
  ];

  return (
    <section className="media-press">
      <div className="media-press-wrap">
        {/* Editorial header - right-aligned (RTL natural axis). */}
        <header className="media-press-head">
          <div className="media-press-eyebrow" style={eyebrow.style}>
            <span className="media-press-dot" aria-hidden="true" />
            <span>{eyebrow.text}</span>
          </div>
          {/* headline carries <em> */}
          <CmsText
            cmsKey="homeV2.media.headline"
            as="h2"
            className="media-press-title"
          />
        </header>

        {/* Editorial table rows */}
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

              {/* Content column */}
              <div className="media-press-row-content">
                <p className="media-press-quote" style={item.quote.style}>
                  <span aria-hidden="true">״</span>
                  {item.quote.text}
                  <span aria-hidden="true">״</span>
                </p>

                <div className="media-press-row-meta">
                  <span className="media-press-name" style={item.name.style}>
                    {item.name.text}
                  </span>
                  <span className="media-press-sep" aria-hidden="true">
                    ·
                  </span>
                  <span className="media-press-date" style={item.date.style}>
                    {item.date.text}
                  </span>
                </div>

                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="media-press-row-cta"
                >
                  <span>{readArticle.text}</span>
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
