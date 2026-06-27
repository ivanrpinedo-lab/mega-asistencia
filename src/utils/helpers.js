export function daysUntil(dateStr) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  return Math.round((target - today) / 86400000)
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDateShort(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function countdownInfo(days, status) {
  if (status === 'completed') return { text: 'Completado', cls: 'ok', color: 'var(--green)' }
  if (days < 0) return { text: `Venció hace ${Math.abs(days)}d`, cls: 'overdue', color: 'var(--red)' }
  if (days === 0) return { text: '⚡ Hoy', cls: 'overdue', color: 'var(--red)' }
  if (days <= 3) return { text: `⚠️ ${days}d`, cls: 'urgent', color: 'var(--amber)' }
  return { text: `${days} días`, cls: 'ok', color: 'var(--green)' }
}

export const TYPE_META = {
  cobro:       { label: 'Cobro',       emoji: '💚', color: '#1A6B4A', bg: '#E8F5EE' },
  pago:        { label: 'Pago',        emoji: '❤️', color: '#C0392B', bg: '#FDECEA' },
  letra:       { label: 'Letra',       emoji: '📄', color: '#C0392B', bg: '#FDECEA' },
  reunion:     { label: 'Reunión',     emoji: '🔵', color: '#2E86DE', bg: '#E8F1FB' },
  capacitacion:{ label: 'Capacit.',   emoji: '🟣', color: '#7B3FA0', bg: '#F3EAFA' },
  documento:   { label: 'Documento',  emoji: '🟡', color: '#B8830A', bg: '#FFF4E0' },
  proforma:    { label: 'Proforma',   emoji: '🟡', color: '#B8830A', bg: '#FFF4E0' },
  concurso:    { label: 'Concurso',   emoji: '🏆', color: '#0D2137', bg: '#E8EFF7' },
}

export function fmtAmount(ev) {
  if (!ev.amount) return ''
  return (ev.currency || 'S/') + ' ' + Number(ev.amount).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function buildWAMessage(template, ev, empresa) {
  const d = new Date(ev.date + 'T00:00:00')
  return template
    .replace(/{{nombre}}/g, ev.contact || 'Cliente')
    .replace(/{{empresa}}/g, empresa || 'Mega Sostenible SAC')
    .replace(/{{monto}}/g, ev.amount?.toFixed(2) || '0.00')
    .replace(/{{moneda}}/g, ev.currency || 'S/')
    .replace(/{{fecha_venc}}/g, d.toLocaleDateString('es-PE'))
    .replace(/{{num_factura}}/g, ev.title)
    .replace(/{{concepto}}/g, ev.title)
    .replace(/{{hora}}/g, ev.time || '')
    .replace(/{{dias_restantes}}/g, Math.max(0, daysUntil(ev.date)))
}

export function requestNotificationPermission() {
  if (!('Notification' in window)) return
  if (Notification.permission === 'default') {
    Notification.requestPermission()
  }
}

export function fireNotification(ev) {
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  try {
    const days = daysUntil(ev.date)
    const body = days === 0
      ? `¡Vence HOY! ${fmtAmount(ev)}`
      : days < 0
        ? `Venció hace ${Math.abs(days)} día(s)`
        : `Vence en ${days} día(s) — ${fmtAmount(ev)}`
    new Notification('🔔 MegaAgenda — ' + ev.title, { body })
  } catch (e) {}
}
