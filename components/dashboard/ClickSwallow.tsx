"use client";

/**
 * ClickSwallow — tiny click-eater used inside Link rows where one
 * interactive child must NOT trigger the outer navigation.
 *
 * Why this exists: Next 14 server components cannot pass functions
 * (`onClick={...}`) to client components, so an inline
 * `<div onClick={(e) => e.preventDefault()}>` written directly in a
 * Server Component throws:
 *
 *   Error: Event handlers cannot be passed to Client Component props.
 *
 * That used to be silently fine for static rows, but stops the page
 * from rendering the moment the conditional path is taken (e.g. when
 * a chip with state appears inside the row). Wrapping that one bit of
 * interactivity in a tiny `"use client"` component fixes it without
 * upgrading the whole list to a client tree.
 *
 * Behaviour: stopPropagation on click + the bubbling pointerdown so the
 * parent link doesn't fire on either mouse or touch input. Renders
 * children as-is; no styling of its own.
 *
 * Added 2026-06-01.
 */

import type { ReactNode } from "react";

export function ClickSwallow({ children }: { children: ReactNode }) {
  return (
    <span
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {children}
    </span>
  );
}
