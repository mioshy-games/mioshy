import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Ensures an injected SVG fills its container div.
 *
 * Strips any fixed `width` / `height` attributes from the root <svg> tag and
 * replaces them with `width="100%" height="100%"` so the SVG scales to the
 * wrapper element. The `viewBox` (if present) is left intact so aspect-ratio
 * is preserved.
 *
 * Use this before passing SVG markup to `dangerouslySetInnerHTML` when the
 * container div controls the rendered size.
 */
export function fitSvgToContainer(svg: string): string {
  return svg.replace(
    /(<svg\b[^>]*?)>/i,
    (_, tag) => {
      const cleaned = tag
        .replace(/\bwidth\s*=\s*["'][^"']*["']/gi, "")
        .replace(/\bheight\s*=\s*["'][^"']*["']/gi, "");
      return `${cleaned} width="100%" height="100%">`;
    },
  );
}
