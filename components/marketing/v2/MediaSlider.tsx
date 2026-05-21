"use client";

// Side-effect import — ensures v2 scoped styles load.
import "./styles.css";

import Image from "next/image";
import { useCmsText } from "@/hooks/useCmsText";
import { CmsText } from "@/components/cms/CmsText";

/**
 * MediaSlider — editorial press table.
 * Sprint 4 #1 closeout: every DOM text via <CmsText>. `LogoAlt`
 * keys stay on useCmsText since they feed <Image alt={…}>.
 */
export function MediaSlider() {
  const item1LogoAlt = useCmsText("homeV2.media.item1LogoAlt");
  const item2LogoAlt = useCmsText("homeV2.media.item2LogoAlt");

  const ITEMS = [
    { n: 1, url: "https://www.israelhayom.co.il/mumlazim/article/13374120", logoSrc: "/images/israel.webp", logoAlt: item1LogoAlt.text },
    { n: 2, url: "https://tld.walla.co.il/item/3528908",                    logoSrc: "/images/walla.webp",  logoAlt: item2LogoAlt.text },
  ] as const;

  return (
    <section className="media-press">
      <div className="media-press-wrap">
        <header className="media-press-head">
          <div className="media-press-eyebrow">
            <span className="media-press-dot" aria-hidden="true" />
            <CmsText cmsKey="homeV2.media.eyebrow" />
          </div>
          {/* 2026-05-20 — next-intl JSON-with-<em> pitfall. The
              original `headline` JSON value had inline <em>…</em>,
              which causes next-intl's t() to throw
              FORMATTING_ERROR when no matching cms_texts row exists
              (because <em> is parsed as a context variable). Now we
              keep `headline` as a plain fallback and render Part1 +
              <em>Em</em> as separate JSX children. Same pattern as
              ForWhom + Intimacy. See memory: project_nextintl_em_pitfall. */}
          <h2 className="media-press-title">
            <CmsText cmsKey="homeV2.media.headlinePart1" />{" "}
            <em>
              <CmsText cmsKey="homeV2.media.headlineEm" />
            </em>
          </h2>
        </header>

        <ul className="media-press-rows">
          {ITEMS.map((item) => (
            <li key={item.n} className="media-press-row">
              <div className="media-press-row-logo">
                <Image
                  src={item.logoSrc}
                  alt={item.logoAlt}
                  width={200}
                  height={64}
                  unoptimized
                />
              </div>

              <div className="media-press-row-content">
                <p className="media-press-quote">
                  <span aria-hidden="true">״</span>
                  <CmsText cmsKey={`homeV2.media.item${item.n}Quote`} />
                  <span aria-hidden="true">״</span>
                </p>

                <div className="media-press-row-meta">
                  <CmsText
                    cmsKey={`homeV2.media.item${item.n}Name`}
                    className="media-press-name"
                  />
                  <span className="media-press-sep" aria-hidden="true">
                    ·
                  </span>
                  <CmsText
                    cmsKey={`homeV2.media.item${item.n}Date`}
                    className="media-press-date"
                  />
                </div>

                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="media-press-row-cta"
                >
                  <CmsText cmsKey="homeV2.media.readArticle" />
                  <span className="arrow" aria-hidden="true">
                    ←
                  </span>
                </a>
              </div>
            </li>
          ))}
          <li aria-hidden className="media-press-row-end" />
        </ul>
      </div>
    </section>
  );
}
