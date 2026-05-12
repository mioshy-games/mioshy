"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

/**
 * Reviews grid — 6 testimonial cards.
 *
 * Mobile (≤899px): shows 3 initially, "load more" reveals 3 more per
 * click (so all 6 are reachable in one click today; the per-click
 * semantics is preserved so adding more reviews in the future doesn't
 * need any component change). Desktop: shows all 6 in a 3-column grid
 * (no hide rule applied on desktop side; the load-more button only
 * appears when more reviews remain hidden, which on desktop is never).
 *
 * Rendering strategy: render every review into the DOM always (so SSR
 * + crawlers see all 6 reviews regardless of viewport). The grid uses
 * a `data-mobile-show` attribute that mobile CSS reads to hide cards
 * beyond the threshold; that keeps the implementation hydration-safe
 * and avoids a flash of "all 6" before the JS kicks in.
 */
const INITIAL_MOBILE = 3;
const STEP = 3;

export function ReviewsGrid() {
  const t = useTranslations("homeV2.reviews");
  const [visibleMobile, setVisibleMobile] = useState(INITIAL_MOBILE);

  const REVIEWS = [
    {
      text: t("item1Text"),
      initial: t("item1Initial"),
      name: t("item1Name"),
      source: t("item1Source"),
    },
    {
      text: t("item2Text"),
      initial: t("item2Initial"),
      name: t("item2Name"),
      source: t("item2Source"),
    },
    {
      text: t("item3Text"),
      initial: t("item3Initial"),
      name: t("item3Name"),
      source: t("item3Source"),
    },
    {
      text: t("item4Text"),
      initial: t("item4Initial"),
      name: t("item4Name"),
      source: t("item4Source"),
    },
    {
      text: t("item5Text"),
      initial: t("item5Initial"),
      name: t("item5Name"),
      source: t("item5Source"),
    },
    {
      text: t("item6Text"),
      initial: t("item6Initial"),
      name: t("item6Name"),
      source: t("item6Source"),
    },
  ];

  const hasMore = visibleMobile < REVIEWS.length;

  return (
    <>
      <div
        className="reviews-grid"
        data-mobile-show={visibleMobile}
      >
        {REVIEWS.map((review, i) => (
          <div className="review-card" key={i}>
            <div className="review-stars">★★★★★</div>
            <p className="review-text">{review.text}</p>
            <div className="review-meta">
              <div className="review-avatar">{review.initial}</div>
              <div>
                <div className="review-name">{review.name}</div>
                <div className="review-source">{review.source}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {hasMore && (
        <div className="reviews-load-more">
          <button
            type="button"
            onClick={() =>
              setVisibleMobile((c) => Math.min(c + STEP, REVIEWS.length))
            }
          >
            {t("loadMore")} <span>↓</span>
          </button>
        </div>
      )}
    </>
  );
}
