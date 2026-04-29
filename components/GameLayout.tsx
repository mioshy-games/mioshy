"use client";

import Image from "next/image";
import type { ReactNode } from "react";

type GameLayoutProps = {
  title?: string;
  children: ReactNode;
  /** Path under /public (default: bundled JPEG). Set to false to skip the background entirely (use when GamePageBackground handles the bg). */
  backgroundSrc?: string | false;
  showVignette?: boolean;
};

export function GameLayout({
  title,
  children,
  backgroundSrc = "/images/game-bg.jpg",
  showVignette = true,
}: GameLayoutProps) {
  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-x-hidden">
      {backgroundSrc !== false && (
        <div className="absolute inset-0 -z-10">
          <Image
            src={backgroundSrc}
            alt=""
            fill
            className="object-cover"
            priority
            sizes="100vw"
          />
          {showVignette ? (
            <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/65" />
          ) : null}
        </div>
      )}
      {title ? (
        <header className="relative z-10 px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))] text-center mt-10">
          <h1 className="text-lg font-semibold tracking-tight text-white drop-shadow-md sm:text-xl">
            {title}
          </h1>
        </header>
      ) : null}
      {/*
        Safe vertical centering:
        • my-auto on the inner wrapper distributes remaining space equally above
          and below → content is vertically centred when the viewport is tall.
        • When content is taller than the available space the auto margins
          collapse to 0 and content simply starts at the top — nothing is
          clipped above.
        • overflow-x-hidden (not overflow-hidden) on the root lets the page
          scroll vertically when needed.
      */}
      <div className="relative z-10 flex flex-1 flex-col items-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
        <div className="my-auto flex w-full flex-col items-center">
          {children}
        </div>
      </div>
    </div>
  );
}
