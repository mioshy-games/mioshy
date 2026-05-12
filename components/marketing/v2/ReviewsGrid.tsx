"use client";

import { useState } from "react";
import { useCmsText } from "@/hooks/useCmsText";

/**
 * ReviewsGrid — 6 testimonial cards (mobile load-more in a future
 * step). CMS-migrated (Sprint 1). Each card pulls 4 keys: text, initial,
 * name, source. Plain text throughout, no inline HTML.
 */
export function ReviewsGrid() {
  const [expanded, setExpanded] = useState(false);
  const loadMore = useCmsText("homeV2.reviews.loadMore");

  // 6 testimonial entries. Each item gets 4 useCmsText calls — total 24.
  // Order is stable so hook order stays consistent across renders.
  const r1Text = useCmsText("homeV2.reviews.item1Text");
  const r1Initial = useCmsText("homeV2.reviews.item1Initial");
  const r1Name = useCmsText("homeV2.reviews.item1Name");
  const r1Source = useCmsText("homeV2.reviews.item1Source");
  const r2Text = useCmsText("homeV2.reviews.item2Text");
  const r2Initial = useCmsText("homeV2.reviews.item2Initial");
  const r2Name = useCmsText("homeV2.reviews.item2Name");
  const r2Source = useCmsText("homeV2.reviews.item2Source");
  const r3Text = useCmsText("homeV2.reviews.item3Text");
  const r3Initial = useCmsText("homeV2.reviews.item3Initial");
  const r3Name = useCmsText("homeV2.reviews.item3Name");
  const r3Source = useCmsText("homeV2.reviews.item3Source");
  const r4Text = useCmsText("homeV2.reviews.item4Text");
  const r4Initial = useCmsText("homeV2.reviews.item4Initial");
  const r4Name = useCmsText("homeV2.reviews.item4Name");
  const r4Source = useCmsText("homeV2.reviews.item4Source");
  const r5Text = useCmsText("homeV2.reviews.item5Text");
  const r5Initial = useCmsText("homeV2.reviews.item5Initial");
  const r5Name = useCmsText("homeV2.reviews.item5Name");
  const r5Source = useCmsText("homeV2.reviews.item5Source");
  const r6Text = useCmsText("homeV2.reviews.item6Text");
  const r6Initial = useCmsText("homeV2.reviews.item6Initial");
  const r6Name = useCmsText("homeV2.reviews.item6Name");
  const r6Source = useCmsText("homeV2.reviews.item6Source");

  const REVIEWS = [
    { text: r1Text, initial: r1Initial, name: r1Name, source: r1Source },
    { text: r2Text, initial: r2Initial, name: r2Name, source: r2Source },
    { text: r3Text, initial: r3Initial, name: r3Name, source: r3Source },
    { text: r4Text, initial: r4Initial, name: r4Name, source: r4Source },
    { text: r5Text, initial: r5Initial, name: r5Name, source: r5Source },
    { text: r6Text, initial: r6Initial, name: r6Name, source: r6Source },
  ];

  return (
    <>
      <div className={`reviews-grid${expanded ? " expanded" : ""}`}>
        {REVIEWS.map((review, i) => (
          <div className="review-card" key={i}>
            <div className="review-stars">★★★★★</div>
            <p className="review-text" style={review.text.style}>
              {review.text.text}
            </p>
            <div className="review-meta">
              <div className="review-avatar">{review.initial.text}</div>
              <div>
                <div className="review-name" style={review.name.style}>
                  {review.name.text}
                </div>
                <div className="review-source" style={review.source.style}>
                  {review.source.text}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {!expanded && (
        <div className="reviews-load-more">
          <button type="button" onClick={() => setExpanded(true)}>
            {loadMore.text} <span>↓</span>
          </button>
        </div>
      )}
    </>
  );
}
