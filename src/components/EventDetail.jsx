import { useState } from 'react'
import { Modal, Btn, NoteCard, CountdownChip, FormGroup, Input, Textarea } from './UI'
import { daysUntil, countdownInfo, TYPE_META, fmtAmount, formatDate, buildWAMessage } from '../utils/helpers'
import { triggerWAManual, insertWALog } from '../lib/db'
import { uid } from '../store/useStore'

export function EventDetail({ event, open, onClose, onComplete, onReprogram, onDelete, onEdit, onAddNote, config, onToast }) {
  const [showReprog, setShowReprog] = useState(false)
  const [newDate, setNewDate]       = useState('')
  const [newNote, setNewNote]       = useState('')
  const [showNote, setShowNote]     = useState(false)
  const [noteText, setNoteText]     = useState('')
  const [sendingWA, setSendingWA]   = useState(false)

  if (!event) return null

  const meta = TYPE_META[event.type] || { label: event.type, emoji: '📌', color: 'var(--text)', bg: 'var(--bg)' }
  const days = daysUntil(event.date)
  const cd = countdownInfo(days, event.status)

  const handleReprogram = () => {
    if (!newDate) return
    onReprogram(event.id, newDate, newNote)
    setShowReprog(false); setNewDate(''); setNewNote('')
    onClose()
  }

  const handleNote = () => {
    if (!noteText.trim()) return
    onAddNote(event.id, noteText)
    setNoteText(''); setShowNote(false)
  }

  const handleWA = async () => {
    if (!event.phone) return
    const msg = buildWAMessage(
      `Hola {{nombre}}, le recordamos: *{{concepto}}* con fecha {{fecha_venc}}${event.amount ? ' por *{{moneda}}{{monto}}*' : ''}. Coordine con nosotros. — {{empresa}}`,
      event, config?.empresa || 'Mega Sostenible SAC'
    )
    setSendingWA(true)
    try {
      const ok = await triggerWAManual(event.id, event.phone, msg)
      if (ok) {
        await insertWALog({ id: uid(), event_id: event.id, phone: event.phone, message: msg, status: 'sent' })
        onToast?.('📱 Mensaje enviado via YCloud')
      } else {
        // Fallback: open WhatsApp web
        window.open(`https://wa.me/${event.phone.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`, '_blank')
        onToast?.('📱 Abriendo WhatsApp (n8n no disponible)')
      }
    } catch {
      window.open(`https://wa.me/${event.phone.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`, '_blank')
    } finally {
      setSendingWA(false)
    }
  }

  return (
    <Modal open={open} onClose={() => { setShowReprog(false); setShowNote(false); onClose() }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
        <div style={{ fontSize: 32 }}>{meta.emoji}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: meta.color, marginBottom: 4 }}>{meta.label}</div>
          <h2 style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.3 }}>{event.title}</h2>
        </div>
        <CountdownChip cls={cd.cls} text={cd.text} />
      </div>

      {[
        { label: 'Fecha y hora', value: `${formatDate(event.date)} ${event.time}` },
        event.amount > 0 ? { label: 'Monto', value: fmtAmount(event), big: true, color: meta.color } : null,
        event.contact ? { label: 'Contacto', value: event.contact } : null,
        event.phone ? { label: 'WhatsApp', value: event.phone } : null,
        event.recurrence !== 'none' ? { label: 'Recurrencia', value: event.recurrence } : null,
      ].filter(Boolean).map((row, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--bg)' }}>
          <span style={{ fontSize: 12, color: 'var(--text-mid)' }}>{row.label}</span>
          <span style={{ fontSize: row.big ? 17 : 13, fontWeight: row.big ? 800 : 600, color: row.color || 'var(--text)', textAlign: 'right', maxWidth: '65%' }}>{row.value}</span>
        </div>
      ))}

      {event.notes && (
        <div style={{ margin: '12px 0', padding: 12, background: '#FFFDE7', borderRadius: 10, borderLeft: '3px solid var(--amber)', fontSize: 13 }}>
          📝 {event.notes}
        </div>
      )}

      {event.history?.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-mid)', marginBottom: 8 }}>Historial</div>
          {event.history.map((h, i) => <NoteCard key={i} date={h.date} action={h.action} note={h.note} />)}
        </div>
      )}

      {showReprog && (
        <div style={{ background: 'var(--bg)', borderRadius: 12, padding: 14, marginTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>📅 Reprogramar evento</div>
          <FormGroup label="Nueva fecha">
            <Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} />
          </FormGroup>
          <FormGroup label="Motivo (opcional)">
            <Input value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Ej: Solicitado por el cliente" />
          </FormGroup>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="amber" size="sm" onClick={handleReprogram}>Confirmar</Btn>
            <Btn variant="secondary" size="sm" onClick={() => setShowReprog(false)}>Cancelar</Btn>
          </div>
        </div>
      )}

      {showNote && (
        <div style={{ background: 'var(--bg)', borderRadius: 12, padding: 14, marginTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>📝 Agregar nota</div>
          <Textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Escribe la nota…" style={{ minHeight: 60 }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Btn variant="primary" size="sm" onClick={handleNote}>Guardar nota</Btn>
            <Btn variant="secondary" size="sm" onClick={() => setShowNote(false)}>Cancelar</Btn>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
        {event.status !== 'completed' && (
          <Btn variant="primary" size="sm" onClick={() => { onComplete(event.id); onClose() }}>✓ Completar</Btn>
        )}
        {event.phone && (
          <Btn variant="whatsapp" size="sm" onClick={handleWA} disabled={sendingWA}>
            {sendingWA ? '⏳…' : '📱 WA YCloud'}
          </Btn>
        )}
        <Btn variant="amber" size="sm" onClick={() => { setShowReprog(!showReprog); setShowNote(false) }}>📅 Reprogramar</Btn>
        <Btn variant="ghost" size="sm" onClick={() => { setShowNote(!showNote); setShowReprog(false) }}>📝 Nota</Btn>
        <Btn variant="ghost" size="sm" onClick={() => { onEdit(event); onClose() }}>✏️ Editar</Btn>
        <Btn variant="danger" size="sm" onClick={() => { if (confirm('¿Eliminar este evento?')) { onDelete(event.id); onClose() } }}>🗑️</Btn>
      </div>
    </Modal>
  )
}
