import { useMemo } from 'react'
import { daysUntil, countdownInfo, fmtAmount, TYPE_META, formatDate } from '../utils/helpers'
import { StatCard, SectionHeader, Btn, Empty, CountdownChip, Badge } from '../components/UI'
import { EventCard } from '../components/EventCard'

export function Dashboard({ events, onEventClick, onAddNew, onGoAgenda }) {
  const today = new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const pending = useMemo(() => events.filter(e => e.status !== 'completed'), [events])
  const overdue = useMemo(() => pending.filter(e => daysUntil(e.date) < 0), [pending])
  const next7 = useMemo(() => pending.filter(e => { const d = daysUntil(e.date); return d >= 0 && d <= 7 }), [pending])

  const upcoming = useMemo(() =>
    [...overdue, ...next7].sort((a, b) => new Date(a.date) - new Date(b.date)),
    [overdue, next7]
  )

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* Today banner */}
      <div style={{
        background: 'linear-gradient(135deg, var(--navy) 0%, var(--navy-light) 100%)',
        borderRadius: 16, padding: '16px 18px', marginBottom: 16,
        color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 4, textTransform: 'capitalize' }}>{today}</div>
          <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1 }}>{pending.length}</div>
          <div style={{ fontSize: 12, opacity: 0.65, marginTop: 2 }}>eventos pendientes</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {overdue.length > 0 && (
            <div style={{ background: 'var(--red)', padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
              🚨 {overdue.length} vencido{overdue.length !== 1 ? 's' : ''}
            </div>
          )}
          <Btn variant="primary" size="sm" onClick={onAddNew}>+ Nuevo</Btn>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
        <StatCard label="Pagos Pendientes" value={pending.filter(e => ['pago','letra'].includes(e.type)).length} sub="por vencer" variant="danger" />
        <StatCard label="Cobros Esperados" value={pending.filter(e => e.type === 'cobro').length} sub="programados" variant="success" />
        <StatCard label="Reuniones" value={pending.filter(e => e.type === 'reunion' && daysUntil(e.date) <= 7).length} sub="esta semana" variant="info" />
        <StatCard label="Documentos" value={pending.filter(e => ['documento','proforma','concurso'].includes(e.type)).length} sub="por presentar" variant="warning" />
      </div>

      {/* Alarms */}
      {overdue.filter(e => e.alarm).map(e => (
        <div key={e.id} style={{
          background: 'var(--red)', color: 'white', borderRadius: 14, padding: 16,
          marginBottom: 10, animation: 'pulse 2s infinite',
        }}>
          <style>{`@keyframes pulse { 0%,100%{box-shadow:0 0 0 0 rgba(192,57,43,.35)} 50%{box-shadow:0 0 0 10px rgba(192,57,43,0)} }`}</style>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>🚨 {e.title}</div>
          <div style={{ fontSize: 12, opacity: 0.85 }}>Venció el {formatDate(e.date)}{e.amount > 0 ? ` — ${fmtAmount(e)}` : ''}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <Btn size="sm" style={{ background: 'rgba(255,255,255,0.25)', color: 'white', border: 'none' }} onClick={() => onEventClick(e)}>Ver detalle</Btn>
          </div>
        </div>
      ))}

      {/* Upcoming */}
      <SectionHeader title="⚡ Próximos 7 días" action={<Btn variant="secondary" size="sm" onClick={onGoAgenda}>Ver todo</Btn>} />
      {upcoming.length > 0
        ? upcoming.map(e => <EventCard key={e.id} event={e} onClick={() => onEventClick(e)} />)
        : <Empty icon="🎉" title="Sin eventos próximos" sub="Agrega nuevos eventos con el botón +" />
      }
    </div>
  )
}
