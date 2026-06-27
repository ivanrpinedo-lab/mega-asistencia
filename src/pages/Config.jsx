import { useState, useEffect } from 'react'
import { FormGroup, Input, Select, Toggle, Btn } from '../components/UI'

function ToggleRow({ label, sub, checked, onChange }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--bg)' }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--text-mid)' }}>{sub}</div>}
      </div>
      <Toggle checked={checked} onChange={e => onChange(e.target.checked)} />
    </div>
  )
}

function Card({ title, children }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 14, padding: 16, boxShadow: 'var(--shadow)', marginBottom: 14 }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  )
}

export function Config({ config, onUpdateConfig, onExport, onImport, onClear }) {
  const [form, setForm] = useState({ ...config })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => setForm({ ...config }), [config])

  const handleSave = () => {
    onUpdateConfig(form)
    alert('✅ Configuración guardada')
  }

  return (
    <div style={{ paddingBottom: 80 }}>
      <Card title="⚙️ Notificaciones y Alarmas">
        <ToggleRow label="Notificaciones push" sub="Alertas en el celular" checked={!!form.push} onChange={v => set('push', v)} />
        <ToggleRow label="Alarma sonora" sub="Sonido al vencer un evento" checked={!!form.alarma} onChange={v => set('alarma', v)} />
        <ToggleRow label="Recordatorio anticipado" sub="Alertar con días de anticipación" checked={!!form.anticipar} onChange={v => set('anticipar', v)} />
        <FormGroup label="Días de anticipación" style={{ marginTop: 12 }}>
          <Select value={form.diasAnticipacion} onChange={e => set('diasAnticipacion', parseInt(e.target.value))}>
            <option value={1}>1 día antes</option>
            <option value={2}>2 días antes</option>
            <option value={3}>3 días antes</option>
            <option value={5}>5 días antes</option>
            <option value={7}>7 días antes</option>
          </Select>
        </FormGroup>
        <FormGroup label="Moneda por defecto">
          <Select value={form.moneda} onChange={e => set('moneda', e.target.value)}>
            <option value="S/">S/ (Soles peruanos)</option>
            <option value="$">$ (Dólares)</option>
          </Select>
        </FormGroup>
      </Card>

      <Card title="👤 Datos de la empresa">
        <FormGroup label="Nombre de empresa">
          <Input value={form.empresa || ''} onChange={e => set('empresa', e.target.value)} placeholder="Mega Sostenible SAC" />
        </FormGroup>
        <FormGroup label="RUC">
          <Input value={form.ruc || ''} onChange={e => set('ruc', e.target.value)} placeholder="20XXXXXXXXX" />
        </FormGroup>
        <FormGroup label="WhatsApp administrador">
          <Input value={form.wa || ''} onChange={e => set('wa', e.target.value)} placeholder="+51 999 999 999" type="tel" />
        </FormGroup>
        <Btn variant="primary" full onClick={handleSave}>💾 Guardar configuración</Btn>
      </Card>

      <Card title="📥 Datos & Backup">
        <div style={{ fontSize: 13, color: 'var(--text-mid)', marginBottom: 12, lineHeight: 1.5 }}>
          Exporta tus datos como JSON para respaldarlos o importarlos en otro dispositivo.
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn variant="secondary" size="sm" onClick={onExport}>⬇️ Exportar JSON</Btn>
          <Btn variant="secondary" size="sm" onClick={onImport}>⬆️ Importar JSON</Btn>
          <Btn variant="danger" size="sm" onClick={onClear}>🗑️ Limpiar datos</Btn>
        </div>
      </Card>

      <div style={{ textAlign: 'center', padding: '8px 16px 0', color: 'var(--text-light)', fontSize: 12 }}>
        MegaAgenda v1.0 · Mega Sostenible SAC · Juanjuí, San Martín, Perú
      </div>
    </div>
  )
}
