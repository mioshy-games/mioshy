// components/articles/ArticleCover.tsx
//
// Usage:
//   <ArticleCover coverImageUrl={a.cover_image_url} emoji={a.emoji} title={title} />
//
// - If cover_image_url exists → shows the real image
// - Otherwise → shows emoji on a gradient derived from the slug/emoji

interface ArticleCoverProps {
  coverImageUrl?: string | null
  emoji?: string | null
  title?: string | null
  className?: string
}

// Maps emoji (or first char of slug) to a gradient pair
const GRADIENTS: [string, string][] = [
  ['#7c3aed', '#db2777'], // purple → pink
  ['#be185d', '#f97316'], // rose → orange
  ['#1d4ed8', '#7c3aed'], // blue → purple
  ['#065f46', '#0891b2'], // emerald → cyan
  ['#92400e', '#dc2626'], // amber → red
  ['#1e3a5f', '#7c3aed'], // navy → purple
]

function getGradient(seed: string): [string, string] {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash)
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length]
}

export function ArticleCover({
  coverImageUrl,
  emoji,
  title,
  className = '',
}: ArticleCoverProps) {
  const seed = emoji ?? title ?? 'article'
  const [from, to] = getGradient(seed)

  if (coverImageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={coverImageUrl}
        alt={title ?? ''}
        className={`aspect-[16/10] w-full object-cover ${className}`}
      />
    )
  }

  return (
    <div
      className={`flex aspect-[16/10] w-full items-center justify-center ${className}`}
      style={{
        background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
      }}
    >
      <span
        className="select-none"
        style={{ fontSize: 'clamp(2.5rem, 6vw, 4rem)', lineHeight: 1 }}
        aria-hidden="true"
      >
        {emoji ?? '💬'}
      </span>
    </div>
  )
}
