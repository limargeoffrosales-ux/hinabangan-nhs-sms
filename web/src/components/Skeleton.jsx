export function Skeleton({ width = '100%', height = 16, borderRadius = 4, style = {}, count = 1 }) {
  const base = {
    width,
    height,
    borderRadius,
    background: 'linear-gradient(90deg, var(--card, #1a1f36) 25%, var(--card-hover, #252d4a) 50%, var(--card, #1a1f36) 75%)',
    backgroundSize: '200% 100%',
    animation: 'skeleton-shimmer 1.5s ease-in-out infinite',
  };
  if (count === 1) return <div style={{ ...base, ...style }} />;
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} style={{ ...base, ...style, marginBottom: i < count - 1 ? 8 : 0 }} />
      ))}
    </>
  );
}

export function SkeletonCard({ rows = 4, style = {} }) {
  return (
    <div style={{ padding: 20, ...style }}>
      <Skeleton width="40%" height={18} style={{ marginBottom: 16 }} />
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} width={`${70 + Math.random() * 30}%`} height={14} style={{ marginBottom: 10 }} />
      ))}
    </div>
  );
}

export function SkeletonTable({ cols = 4, rows = 5 }) {
  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
        {Array.from({ length: cols }, (_, i) => (
          <Skeleton key={i} width={`${100 / cols}%`} height={14} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, ri) => (
        <div key={ri} style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
          {Array.from({ length: cols }, (_, ci) => (
            <Skeleton key={ci} width={`${100 / cols}%`} height={12} />
          ))}
        </div>
      ))}
    </div>
  );
}
