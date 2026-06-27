import { daysUntil, countdownInfo, TYPE_META, fmtAmount, formatDate } from '../utils/helpers'
import { CountdownChip, Badge } from './UI'

export function EventCard({ event, onClick }) {
  const { type, title, date, time, amount, currency, contact, status } = event
  const meta = TYPE_META[type] || { label: type, emoji: '📌', color: 'var(--text)', bg: 'var(--bg)' }
  const days = daysUntil(date)
  const cd = countdownInfo(days, status)

  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--surface)', borderRadius: 14, padding: '14px 16px',
        boxShadow: 'var(--shadow)', marginBottom: 10, display: 'flex', gap: 14,
        position: 'relative', overflow: 'hidden', cursor: 'pointer',
        transition: 'transform 0.12s, box-shadow 0.12s',
        borderLeft: `5px solid ${meta.color}`,
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow)' }}
    >
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <Badge text={`${meta.emoji} ${meta.label}`} color={meta.color} bg={meta.bg} />
        <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--text-mid)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <span>📅 {formatDate(date)} {time}</span>
          {contact && <span>👤 {contact}</span>}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, minWidth: 80 }}>
        {amount > 0 && (
          <div style={{ fontSize: 15, fontWeight: 800, color: meta.color }}>{fmtAmount(event)}</div>
        )}
        <CountdownChip cls={cd.cls} text={cd.text} />
      </div>
    </div>
  )
}
