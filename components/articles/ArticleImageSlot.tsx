/**
 * ArticleImageSlot — a reserved, clearly-marked placeholder rendered at an
 * {{image}} token in an article body, for an image the author will supply
 * later. Server component. Once a real image exists, replace the {{image}}
 * token in the body with a markdown image (![](url)).
 */
export function ArticleImageSlot({ label }: { label?: string }) {
  return (
    <div className="my-8 flex aspect-[16/9] w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 text-center">
      <span className="text-sm font-medium text-gray-400">
        {label ?? "מקום שמור לתמונה"}
      </span>
      <span className="text-xs text-gray-300">תתווסף לפני הפרסום</span>
    </div>
  );
}
