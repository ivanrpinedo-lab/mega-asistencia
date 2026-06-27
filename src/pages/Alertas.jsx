import { useMemo } from 'react'
import { SectionHeader, Btn, Empty, NoteCard, CountdownChip } from '../components/UI'
import { daysUntil, countdownInfo, TYPE_META, fmtAmount, formatDate, buildWAMessage } from '../utils/helpers'

export function Alertas({ events, history, onComplete, onEventClick, config }) {
  const pending = useMemo(() => events.filter(e => e.status !== 'completed'), [events])
  const overdue = useMemo(() => pending.filter(e => daysUntil(e.date) < 0), [pending])
  const urgent  = useMemo(() => pending.filter(e => { const d = daysUntil(e.date); return d >= 0 && d <= 3 }), [pending])

  const alertItems = useMemo(() =>
    [...overdue, ...urgent].sort((a, b) => new Date(a.date) - new Date(b.date)),
    [overdue, urgent]
  )

  const sendWA = (e) => {
    const msg = buildWAMessage(
      `Estimado/a {{nombre}}, le recordamos que {{concepto}} venció el {{fecha_venc}}${e.amount ? ' por *{{moneda}}{{monto}}*' : ''}. Por favor coordine con nosotros. — {{empresa}}`,
      e, config?.empresa
    )
    window.open(`https://wa.me/${e.phone.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  return (
    <div style={{ paddingBottom: 80 }}>
      <SectionHeader title="🚨 Alertas Activas" />

      {alertItems.length > 0 ? alertItems.map(e => {
        const meta = TYPE_META[e.type] || { color: 'var(--text)', label: e.type, emoji: '📌' }
        const days = daysUntil(e.date)
        const cd = countdownInfo(days, e.status)
        const borderColor = days < 0 ? 'var(--red)' : 'var(--amber)'

        return (
          <div key={e.id} style={{
            background: 'var(--surface)', borderRadius: 14, padding: 14, marginBottom: 10,
            boxShadow: 'var(--shadow)', borderLeft: `4px solid ${borderColor}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3 }}>{e.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-mid)', marginBottom: 4 }}>
                  {meta.emoji} {meta.label} · {formatDate(e.date)}
                </div>
                {e.amount > 0 && (
                  <div style={{ fontSize: 16, fontWeight: 800, color: borderColor }}>{fmtAmount(e)}</div>
                )}
              </div>
              <CountdownChip cls={cd.cls} text={cd.text} />
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              <Btn variant="primary" size="sm" onClick={() => onComplete(e.id)}>✓ Completar</Btn>
              {e.phone && <Btn variant="whatsapp" size="sm" onClick={() => sendWA(e)}>📱 WA</Btn>}
              <Btn variant="secondary" size="sm" onClick={() => onEventClick(e)}>Ver detalle</Btn>
            </div>
          </div>
        )
      }) : (
        <Empty icon="✅" title="Sin alertas activas" sub="Todo está en orden. ¡Buen trabajo!" />
      )}

      <SectionHeader title="📋 Historial de Incidencias" />
      {history.length > 0
        ? history.slice().reverse().map(h => {
          const actionColor = h.status === 'resolved' ? 'var(--green)' : h.status === 'reprogrammed' ? 'var(--amber)' : 'var(--blue)'
          return <NoteCard key={h.id} date={h.date} action={h.action} note={`${h.eventTitle}${h.note ? ' — ' + h.note : ''}`} color={actionColor} />
        })
        : <div style={{ color: 'var(--text-light)', fontSize: 13, padding: '12px 0' }}>Sin incidencias registradas.</div>
      }
    </div>
  )
}
