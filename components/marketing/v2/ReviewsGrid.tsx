"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export function ReviewsGrid() {
  const t = useTranslations("homeV2.reviews");
  const [expanded, setExpanded] = useState(false);

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

  return (
    <>
      <div className={`reviews-grid${expanded ? " expanded" : ""}`}>
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

      {!expanded && (
        <div className="reviews-load-more">
          <button type="button" onClick={() => setExpanded(true)}>
            {t("loadMore")} <span>↓</span>
          </button>
        </div>
      )}
    </>
  );
}
