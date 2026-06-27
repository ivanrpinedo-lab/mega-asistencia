import { useState, useEffect } from 'react'
import { Modal, FormGroup, Input, Select, Textarea, Btn } from './UI'

const DEFAULT = {
  type: 'cobro', title: '', date: '', time: '09:00',
  amount: '', currency: 'S/', contact: '', phone: '',
  recurrence: 'none', notes: '', alarm: true, status: 'pending',
}

const AMOUNT_TYPES = ['cobro', 'pago', 'letra']

export function EventForm({ open, onClose, onSave, initialData }) {
  const [form, setForm] = useState(DEFAULT)

  useEffect(() => {
    if (open) {
      if (initialData) {
        setForm({ ...DEFAULT, ...initialData, amount: initialData.amount || '' })
      } else {
        setForm({ ...DEFAULT, date: new Date().toISOString().split('T')[0] })
      }
    }
  }, [open, initialData])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = () => {
    if (!form.title.trim() || !form.date) {
      alert('Título y fecha son obligatorios')
      return
    }
    onSave({ ...form, amount: parseFloat(form.amount) || 0 })
    onClose()
  }

  const showAmount = AMOUNT_TYPES.includes(form.type)

  return (
    <Modal open={open} onClose={onClose} title={initialData ? '✏️ Editar Evento' : '➕ Nuevo Evento'}>
      <FormGroup label="Tipo de evento">
        <Select value={form.type} onChange={e => set('type', e.target.value)}>
          <option value="cobro">💚 Cobro / Factura por cobrar</option>
          <option value="pago">❤️ Pago / Factura por pagar</option>
          <option value="letra">📄 Letra de cambio</option>
          <option value="reunion">🔵 Reunión</option>
          <option value="capacitacion">🟣 Capacitación</option>
          <option value="documento">🟡 Presentación de documento</option>
          <option value="proforma">🟡 Elaboración de proforma</option>
          <option value="concurso">🏆 Concurso / Postulación</option>
        </Select>
      </FormGroup>

      <FormGroup label="Título / Descripción">
        <Input
          value={form.title}
          onChange={e => set('title', e.target.value)}
          placeholder="Ej: Factura #001 - Cliente Copajira"
        />
      </FormGroup>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <FormGroup label="Fecha límite">
          <Input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
        </FormGroup>
        <FormGroup label="Hora">
          <Input type="time" value={form.time} onChange={e => set('time', e.target.value)} />
        </FormGroup>
      </div>

      {showAmount && (
        <FormGroup label="Monto">
          <div style={{ display: 'flex', gap: 6 }}>
            <Select value={form.currency} onChange={e => set('currency', e.target.value)} style={{ maxWidth: 75 }}>
              <option value="S/">S/</option>
              <option value="$">$</option>
            </Select>
            <Input
              type="number" step="0.01" min="0"
              value={form.amount}
              onChange={e => set('amount', e.target.value)}
              placeholder="0.00"
            />
          </div>
        </FormGroup>
      )}

      <FormGroup label="Contacto / Cliente / Empresa">
        <Input value={form.contact} onChange={e => set('contact', e.target.value)} placeholder="Nombre o razón social" />
      </FormGroup>

      <FormGroup label="WhatsApp contacto">
        <Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+51 999 999 999" type="tel" />
      </FormGroup>

      <FormGroup label="Recurrencia">
        <Select value={form.recurrence} onChange={e => set('recurrence', e.target.value)}>
          <option value="none">Sin recurrencia</option>
          <option value="weekly">Semanal</option>
          <option value="monthly">Mensual</option>
          <option value="bimonthly">Bimestral</option>
          <option value="quarterly">Trimestral</option>
        </Select>
      </FormGroup>

      <FormGroup label="Notas">
        <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Información adicional…" />
      </FormGroup>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 4 }}>
        <input type="checkbox" checked={form.alarm} onChange={e => set('alarm', e.target.checked)} />
        <span style={{ fontSize: 13, fontWeight: 500 }}>🔔 Activar alarma y recordatorio</span>
      </label>

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <Btn variant="primary" style={{ flex: 1 }} onClick={handleSave}>
          💾 {initialData ? 'Actualizar' : 'Guardar'}
        </Btn>
        <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
      </div>
    </Modal>
  )
}
