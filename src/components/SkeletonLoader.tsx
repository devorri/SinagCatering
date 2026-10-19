import React from 'react'

export const SkeletonStat: React.FC = () => {
  return (
    <div className="skeleton-card" style={{ padding: '20px', borderRadius: '12px', background: 'var(--paper-warm)' }}>
      <div className="skeleton-line" style={{ width: '40%', height: '12px', marginBottom: '12px' }} />
      <div className="skeleton-line" style={{ width: '60%', height: '28px', marginBottom: '8px' }} />
      <div className="skeleton-line" style={{ width: '80%', height: '10px' }} />
    </div>
  )
}

export const SkeletonCard: React.FC<{ rows?: number }> = ({ rows = 3 }) => {
  return (
    <div className="skeleton-card" style={{ padding: '24px', borderRadius: '12px', background: '#FFFFFF', border: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <div className="skeleton-circle" style={{ width: '42px', height: '42px' }} />
        <div style={{ flex: 1 }}>
          <div className="skeleton-line" style={{ width: '50%', height: '16px', marginBottom: '6px' }} />
          <div className="skeleton-line" style={{ width: '30%', height: '12px' }} />
        </div>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="skeleton-line"
          style={{
            width: `${90 - i * 15}%`,
            height: '14px',
            marginBottom: i === rows - 1 ? 0 : '10px',
          }}
        />
      ))}
    </div>
  )
}

export const SkeletonTable: React.FC<{ rows?: number; columns?: number }> = ({ rows = 5, columns = 6 }) => {
  return (
    <div style={{ width: '100%', overflowX: 'auto', background: '#FFFFFF', borderRadius: '12px', padding: '16px', border: '1px solid var(--line)' }}>
      {/* Header row */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: '12px', paddingBottom: '12px', borderBottom: '2px solid var(--line)' }}>
        {Array.from({ length: columns }).map((_, c) => (
          <div key={c} className="skeleton-line" style={{ height: '14px', width: '70%' }} />
        ))}
      </div>
      {/* Body rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: '12px',
            padding: '14px 0',
            borderBottom: r === rows - 1 ? 'none' : '1px solid var(--line)',
          }}
        >
          {Array.from({ length: columns }).map((_, c) => (
            <div
              key={c}
              className="skeleton-line"
              style={{
                height: '14px',
                width: c === 0 ? '55%' : c === 1 ? '85%' : '65%',
              }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
