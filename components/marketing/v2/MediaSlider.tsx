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
            <CmsText cmsKey="homeV2.media.headlinePart1" />
          </h2>
        </header>

        {/* 2026-06-09 — simplified to a logo wall per Itzik. The
            per-outlet quote, name/date meta, and "read article" CTA
            were removed; only the publication logos remain, side by
            side. CMS keys homeV2.media.item{n}Quote/Name/Date +
            readArticle and the `.media-press-row*` CSS stay on disk. */}
        <ul className="media-press-logos">
          {ITEMS.map((item) => (
            <li key={item.n} className="media-press-logo-item">
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={item.logoAlt}
              >
                <Image
                  src={item.logoSrc}
                  alt={item.logoAlt}
                  width={200}
                  height={64}
                  unoptimized
                />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
