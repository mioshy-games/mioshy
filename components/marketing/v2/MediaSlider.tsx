"use client";

// Side-effect import — ensures v2 scoped styles load.
import "./styles.css";

import { useState } from "react";
import Image from "next/image";
import { useCmsText } from "@/hooks/useCmsText";
import { CmsText } from "@/components/cms/CmsText";

/**
 * MediaSlider — press / social-proof logo wall.
 *
 * 2026-06-09 — each logo now has an action link beneath it: press
 * outlets link to their article; the "כל מה שטוב" TV item opens a
 * YouTube video in a centred lightbox. The old per-outlet quote rows
 * were removed per Itzik. Eyebrow + headline (homeV2.media.eyebrow /
 * headlinePart1) stay; the headline copy is managed in the CMS.
 */
type PressItem =
  | {
      n: number;
      kind: "article";
      url: string;
      cta: string;
      logoSrc: string;
      logoAlt: string;
      w: number;
      h: number;
    }
  | {
      n: number;
      kind: "video";
      youtubeId: string;
      cta: string;
      logoSrc: string;
      logoAlt: string;
      w: number;
      h: number;
    };

export function MediaSlider() {
  const item1LogoAlt = useCmsText("homeV2.media.item1LogoAlt");
  const item2LogoAlt = useCmsText("homeV2.media.item2LogoAlt");
  const [videoId, setVideoId] = useState<string | null>(null);

  // Order (RTL, right → left): ישראל היום · כל מה שטוב · וואלה.
  // The "כל מה שטוב" video item sits in the middle per Itzik.
  const ITEMS: PressItem[] = [
    {
      n: 1,
      kind: "article",
      url: "https://www.israelhayom.co.il/mumlazim/article/13374120",
      cta: "מעבר לכתבה",
      logoSrc: "/images/israel.webp",
      logoAlt: item1LogoAlt.text,
      w: 200,
      h: 64,
    },
    {
      n: 3,
      kind: "video",
      youtubeId: "fpkGvFzIlSY",
      cta: "לצפייה",
      logoSrc: "/images/logo.webp",
      logoAlt: "כל מה שטוב",
      w: 225,
      h: 225,
    },
    {
      n: 2,
      kind: "article",
      url: "https://tld.walla.co.il/item/3528908",
      cta: "מעבר לכתבה",
      logoSrc: "/images/walla.webp",
      logoAlt: item2LogoAlt.text,
      w: 200,
      h: 64,
    },
  ];

  return (
    <section className="media-press">
      <div className="media-press-wrap">
        <header className="media-press-head">
          <div className="media-press-eyebrow">
            <span className="media-press-dot" aria-hidden="true" />
            <CmsText cmsKey="homeV2.media.eyebrow" />
          </div>
          <h2 className="media-press-title">
            <CmsText cmsKey="homeV2.media.headlinePart1" />
          </h2>
        </header>

        <ul className="media-press-logos">
          {ITEMS.map((item) => (
            <li key={item.n} className="media-press-logo-item">
              {item.kind === "article" ? (
                <>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={item.logoAlt}
                    className="media-press-logo-link"
                  >
                    <Image
                      src={item.logoSrc}
                      alt={item.logoAlt}
                      width={item.w}
                      height={item.h}
                      unoptimized
                    />
                  </a>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="media-press-go"
                  >
                    {item.cta}
                  </a>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="media-press-logo-btn"
                    onClick={() => setVideoId(item.youtubeId)}
                    aria-label={`${item.logoAlt} — ${item.cta}`}
                  >
                    <Image
                      src={item.logoSrc}
                      alt={item.logoAlt}
                      width={item.w}
                      height={item.h}
                      unoptimized
                    />
                  </button>
                  <button
                    type="button"
                    className="media-press-go"
                    onClick={() => setVideoId(item.youtubeId)}
                  >
                    {item.cta}
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>

      {videoId ? (
        <div
          className="media-press-modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setVideoId(null)}
        >
          <div
            className="media-press-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="media-press-modal-close"
              onClick={() => setVideoId(null)}
              aria-label="סגירה"
            >
              ×
            </button>
            <div className="media-press-modal-video">
              <iframe
                src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
                title="כל מה שטוב — מיאושי"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
