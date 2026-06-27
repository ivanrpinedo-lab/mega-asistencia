import { useState, useMemo } from 'react'
import { EventCard } from '../components/EventCard'
import { Chip, Empty } from '../components/UI'
import { daysUntil } from '../utils/helpers'

const FILTERS = [
  { key: 'todos', label: 'Todos' },
  { key: 'cobro', label: '💚 Cobros' },
  { key: 'pago', label: '❤️ Pagos' },
  { key: 'letra', label: '📄 Letras' },
  { key: 'reunion', label: '🔵 Reuniones' },
  { key: 'capacitacion', label: '🟣 Capacitac.' },
  { key: 'documento', label: '🟡 Documentos' },
  { key: 'concurso', label: '🏆 Concursos' },
]

const TABS = [
  { key: 'proximos', label: 'Próximos' },
  { key: 'completados', label: 'Completados' },
  { key: 'todos', label: 'Todos' },
]

export function Agenda({ events, onEventClick }) {
  const [filter, setFilter] = useState('todos')
  const [tab, setTab] = useState('proximos')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    let evs = [...events]
    if (filter !== 'todos') evs = evs.filter(e => e.type === filter)
    if (tab === 'proximos') evs = evs.filter(e => e.status !== 'completed')
    else if (tab === 'completados') evs = evs.filter(e => e.status === 'completed')
    if (search) {
      const q = search.toLowerCase()
      evs = evs.filter(e =>
        e.title.toLowerCase().includes(q) ||
        (e.contact || '').toLowerCase().includes(q) ||
        String(e.amount).includes(q)
      )
    }
    return evs.sort((a, b) => new Date(a.date) - new Date(b.date))
  }, [events, filter, tab, search])

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* Search */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--surface)', borderRadius: 12, padding: '0 12px',
        border: '1.5px solid var(--border)', marginBottom: 12,
      }}>
        <span style={{ fontSize: 16, color: 'var(--text-light)' }}>🔍</span>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar evento, cliente, monto…"
          style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, padding: '10px 0', fontFamily: 'inherit', background: 'transparent' }}
        />
        {search && <span onClick={() => setSearch('')} style={{ cursor: 'pointer', fontSize: 14, color: 'var(--text-light)' }}>✕</span>}
      </div>

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 12, scrollbarWidth: 'none' }}>
        {FILTERS.map(f => (
          <Chip key={f.key} label={f.label} active={filter === f.key} onClick={() => setFilter(f.key)} />
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: 'var(--bg)', borderRadius: 10, padding: 3, gap: 2, marginBottom: 16 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, padding: '7px', border: 'none', borderRadius: 8,
            fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
            background: tab === t.key ? 'var(--surface)' : 'transparent',
            color: tab === t.key ? 'var(--green)' : 'var(--text-mid)',
            boxShadow: tab === t.key ? 'var(--shadow)' : 'none',
          }}>{t.label}</button>
        ))}
      </div>

      {filtered.length > 0
        ? filtered.map(e => <EventCard key={e.id} event={e} onClick={() => onEventClick(e)} />)
        : <Empty icon="📭" title="Sin resultados" sub="Prueba cambiar los filtros o el texto de búsqueda" />
      }
    </div>
  )
}
