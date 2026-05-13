"use client";

import { useState } from "react";
import { CmsText } from "@/components/cms/CmsText";

/**
 * ReviewsGrid — 6 testimonial cards (mobile load-more in a future
 * step). Sprint 4 #1 closeout: every text flows through <CmsText>.
 * The card-internal layout is generic enough to handle either plain
 * text or rich (rare for a testimonial, but allowed if admin toggles).
 */
export function ReviewsGrid() {
  const [expanded, setExpanded] = useState(false);

  // Stable iteration count so React's hook order is consistent.
  const ITEMS = [1, 2, 3, 4, 5, 6] as const;

  return (
    <>
      <div className={`reviews-grid${expanded ? " expanded" : ""}`}>
        {ITEMS.map((i) => (
          <div className="review-card" key={i}>
            <div className="review-stars">★★★★★</div>
            <CmsText
              cmsKey={`homeV2.reviews.item${i}Text`}
              as="p"
              className="review-text"
            />
            <div className="review-meta">
              <div className="review-avatar">
                <CmsText cmsKey={`homeV2.reviews.item${i}Initial`} />
              </div>
              <div>
                <CmsText
                  cmsKey={`homeV2.reviews.item${i}Name`}
                  as="div"
                  className="review-name"
                />
                <CmsText
                  cmsKey={`homeV2.reviews.item${i}Source`}
                  as="div"
                  className="review-source"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {!expanded && (
        <div className="reviews-load-more">
          <button type="button" onClick={() => setExpanded(true)}>
            <CmsText cmsKey="homeV2.reviews.loadMore" /> <span>↓</span>
          </button>
        </div>
      )}
    </>
  );
}
