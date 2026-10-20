'use client';

// Shows the owner's overall star rating + review count. Fully
// functional as a display widget (no backing review store exists in
// this project yet, so it renders the rating the owner enters in their
// widget settings rather than pulling from a review platform).
interface Props {
  config: Record<string, unknown>;
}

export function ReviewsWidget({ config }: Props) {
  const rating = typeof config.rating === 'number' ? config.rating : Number(config.rating) || 4.8;
  const reviewCount = typeof config.reviewCount === 'number' ? config.reviewCount : Number(config.reviewCount) || 0;
  const accent = typeof config.accent === 'string' && /^#[0-9a-f]{6}$/i.test(config.accent) ? config.accent : '#8a5a3c';

  const fullStars = Math.round(rating);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        width: '100%',
        height: '100%',
        padding: 12,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 800, color: '#22201c' }}>{rating.toFixed(1)}</div>
      <div style={{ display: 'flex', gap: 2 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <svg key={i} viewBox="0 0 24 24" width={16} height={16} fill={i < fullStars ? accent : '#e8e4de'}>
            <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.9L12 3.5z" />
          </svg>
        ))}
      </div>
      {reviewCount > 0 && (
        <div style={{ fontSize: 12, color: '#6b655c' }}>Based on {reviewCount.toLocaleString()} reviews</div>
      )}
    </div>
  );
}
