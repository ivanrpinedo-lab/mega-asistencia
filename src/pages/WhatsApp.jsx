import { useState, useMemo } from 'react'
import { Modal, FormGroup, Input, Select, Textarea, Btn, SectionHeader, Empty } from '../components/UI'
import { buildWAMessage } from '../utils/helpers'
import { triggerWAManual, triggerWAMasivo, insertWALog } from '../lib/db'
import { uid } from '../store/useStore'

const WA_VARS = ['{{nombre}}','{{empresa}}','{{monto}}','{{moneda}}','{{fecha_venc}}','{{concepto}}','{{dias_restantes}}']

function previewMessage(body) {
  return body
    .replace(/{{nombre}}/g, 'Juan García')
    .replace(/{{empresa}}/g, 'Mega Sostenible SAC')
    .replace(/{{monto}}/g, '850.00')
    .replace(/{{moneda}}/g, 'S/')
    .replace(/{{fecha_venc}}/g, '30/06/2026')
    .replace(/{{num_factura}}/g, 'F-0045')
    .replace(/{{concepto}}/g, 'Servicio ISP Mensual')
    .replace(/{{hora}}/g, '10:00')
    .replace(/{{dias_restantes}}/g, '5')
}

export function WhatsApp({ events, templates, waLogs, onSaveTemplate, onDeleteTemplate, onRefreshLogs, config, onToast }) {
  const [open, setOpen]             = useState(false)
  const [tplName, setTplName]       = useState('')
  const [tplBody, setTplBody]       = useState('Hola {{nombre}}, le recordamos que tiene un pago pendiente de *{{moneda}}{{monto}}* por _{{concepto}}_ con vencimiento el *{{fecha_venc}}*. Por favor coordine con nosotros. — {{empresa}} 🌿')
  const [filterType, setFilterType] = useState('todos')
  const [sending, setSending]       = useState(false)

  const targets = useMemo(() => {
    let evs = events.filter(e => e.phone && e.status !== 'completed')
    if (filterType !== 'todos') evs = evs.filter(e => e.type === filterType)
    return evs
  }, [events, filterType])

  const handleSendMasivo = async () => {
    if (!tplBody.trim()) return
    if (!targets.length) { onToast('⚠️ Sin contactos con WhatsApp registrado'); return }
    setSending(true)
    try {
      const ok = await triggerWAMasivo(
        targets.map(e => ({
          id: e.id, phone: e.phone, contact: e.contact,
          title: e.title, amount: e.amount, currency: e.currency,
          date: e.date, type: e.type,
        })),
        tplBody,
        config?.empresa || 'Mega Sostenible SAC'
      )
      if (ok) {
        // Log each send
        await Promise.all(targets.map(e =>
          insertWALog({
            id: uid(),
            event_id: e.id,
            phone: e.phone,
            message: buildWAMessage(tplBody, e, config?.empresa),
            status: 'sent',
          })
        ))
        onToast(`📤 Enviando a ${targets.length} contacto(s) via n8n + YCloud`)
        onRefreshLogs?.()
        setOpen(false)
      } else {
        onToast('❌ Error al conectar con n8n — verifica el webhook')
      }
    } catch (e) {
      onToast('❌ Error: ' + e.message)
    } finally {
      setSending(false)
    }
  }

  const handleSaveTemplate = async () => {
    if (!tplName.trim() || !tplBody.trim()) { onToast('⚠️ Completa nombre y mensaje'); return }
    await onSaveTemplate({ name: tplName, body: tplBody, filterType })
    onToast('💾 Plantilla guardada')
    setOpen(false)
    setTplName(''); setTplBody('')
  }

  const useTemplate = (tpl) => {
    setTplName(tpl.name)
    setTplBody(tpl.body)
    setFilterType(tpl.filterType || 'todos')
    setOpen(true)
  }

  return (
    <div style={{ paddingBottom: 80 }}>
      <SectionHeader
        title="📱 WhatsApp via YCloud + n8n"
        action={<Btn variant="whatsapp" size="sm" onClick={() => setOpen(true)}>+ Nueva campaña</Btn>}
      />

      {/* Status banner */}
      <div style={{ background: '#E8F5E9', borderRadius: 12, padding: 12, marginBottom: 16, borderLeft: '4px solid #25D366', fontSize: 13 }}>
        <strong>🔗 Integración activa:</strong> Los mensajes se envían via <strong>n8n.ivanpinedo.com</strong> → <strong>YCloud</strong> → WhatsApp Business (<strong>+51 915295685</strong>)
      </div>

      {/* Variables */}
      <div style={{ background: 'var(--surface)', borderRadius: 14, padding: 16, boxShadow: 'var(--shadow)', marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Variables disponibles:</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {WA_VARS.map(v => (
            <span key={v} style={{ background: '#E8F5E9', color: '#1A7A3A', borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>{v}</span>
          ))}
        </div>
      </div>

      {/* Templates */}
      <SectionHeader title="Plantillas guardadas" />
      {templates.length > 0
        ? templates.map(t => (
          <div key={t.id} style={{ background: 'var(--surface)', borderRadius: 14, padding: 14, marginBottom: 10, boxShadow: 'var(--shadow)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>📄 {t.name}</div>
            <div style={{ background: '#E8F5E9', borderRadius: 10, padding: 10, fontSize: 12, borderLeft: '3px solid #25D366', marginBottom: 10, lineHeight: 1.5 }}>
              {t.body.substring(0, 140)}{t.body.length > 140 ? '…' : ''}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="whatsapp" size="sm" onClick={() => useTemplate(t)}>Usar plantilla</Btn>
              <Btn variant="danger" size="sm" onClick={() => onDeleteTemplate(t.id)}>🗑️</Btn>
            </div>
          </div>
        ))
        : <Empty icon="📝" title="Sin plantillas" sub="Crea tu primera campaña" />
      }

      {/* WA Logs */}
      <SectionHeader title="📋 Historial de envíos YCloud" />
      {waLogs.length > 0
        ? waLogs.slice(0, 20).map(l => (
          <div key={l.id} style={{ background: '#FFFDE7', borderRadius: 10, padding: 12, marginBottom: 8, borderLeft: '3px solid #25D366' }}>
            <div style={{ fontSize: 11, color: 'var(--text-light)', marginBottom: 4 }}>
              {new Date(l.sent_at).toLocaleString('es-PE')} · <strong style={{ color: l.status === 'sent' ? 'var(--green)' : 'var(--red)' }}>{l.status}</strong>
            </div>
            <div style={{ fontSize: 13 }}>📱 {l.phone} — {l.message?.substring(0, 80)}{l.message?.length > 80 ? '…' : ''}</div>
          </div>
        ))
        : <div style={{ color: 'var(--text-light)', fontSize: 13, padding: '12px 0' }}>Sin envíos registrados aún.</div>
      }

      {/* Campaign modal */}
      <Modal open={open} onClose={() => setOpen(false)} title="📱 Nueva Campaña WhatsApp">
        <FormGroup label="Nombre de la plantilla">
          <Input value={tplName} onChange={e => setTplName(e.target.value)} placeholder="Ej: Cobro mensual ISP" />
        </FormGroup>
        <FormGroup label="Filtrar destinatarios">
          <Select value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="todos">Todos los eventos con WhatsApp</option>
            <option value="cobro">Solo cobros</option>
            <option value="pago">Solo pagos</option>
            <option value="letra">Solo letras de cambio</option>
            <option value="reunion">Solo reuniones</option>
          </Select>
        </FormGroup>
        <FormGroup label="Mensaje">
          <Textarea value={tplBody} onChange={e => setTplBody(e.target.value)} rows={6} />
        </FormGroup>
        <div style={{ fontSize: 12, color: 'var(--text-mid)', marginBottom: 6 }}>Vista previa:</div>
        <div style={{ background: '#E8F5E9', borderRadius: 12, padding: 14, fontSize: 13, borderLeft: '3px solid #25D366', whiteSpace: 'pre-wrap', lineHeight: 1.6, marginBottom: 12 }}>
          {previewMessage(tplBody) || '—'}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--green)', marginBottom: 12 }}>
          📤 {targets.length} contacto{targets.length !== 1 ? 's' : ''} recibirán el mensaje via YCloud
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn variant="whatsapp" style={{ flex: 1 }} onClick={handleSendMasivo} disabled={sending}>
            {sending ? '⏳ Enviando via n8n…' : '📤 Enviar via YCloud'}
          </Btn>
          <Btn variant="secondary" size="sm" onClick={handleSaveTemplate}>💾 Guardar</Btn>
          <Btn variant="secondary" size="sm" onClick={() => setOpen(false)}>Cancelar</Btn>
        </div>
      </Modal>
    </div>
  )
}
