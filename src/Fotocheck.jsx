/**
 * Fotocheck.jsx — Generador de fotochecks con QR
 */
import { useState } from 'react'
import { T } from './utils.js'

function genCode(id, nombre) {
  const base = (id + nombre).replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  return base.slice(0, 8).padEnd(8, '0')
}

export function PanelFotocheck({ colaboradores }) {
  const [selId, setSelId] = useState('')
  const colab = colaboradores.find(c => c.id === selId)

  return (
    <div>
      <h3 style={{ color: T.verde, marginBottom: 16 }}>🪪 Fotochecks</h3>
      <div style={{ marginBottom: 20 }}>
        <select
          style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #ccc', fontSize: 14, fontFamily: 'inherit', minWidth: 280 }}
          value={selId} onChange={e => setSelId(e.target.value)}>
          <option value="">— Seleccionar colaborador —</option>
          {colaboradores.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>

      {colab && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
          <div style={{
            background: `linear-gradient(135deg, ${T.verde}, #2E7D52)`,
            borderRadius: 18, padding: 24, color: '#fff',
            width: 280, boxShadow: '0 6px 24px #0003',
          }}>
            <div style={{ fontSize: 11, letterSpacing: 2, opacity: .7, marginBottom: 8 }}>MEGA AVENTURA · MEGA SOSTENIBLE</div>
            <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 4 }}>{colab.nombre}</div>
            <div style={{ fontSize: 13, opacity: .8, marginBottom: 4 }}>{colab.cargo || 'Colaborador'}</div>
            <div style={{ fontSize: 12, opacity: .7, marginBottom: 20 }}>{colab.empresa || ''}</div>
            <div style={{ background: '#fff', borderRadius: 10, padding: 12, display: 'inline-block', marginBottom: 12 }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${genCode(colab.id, colab.nombre)}`}
                alt="QR" width={120} height={120}
              />
            </div>
            <div style={{ fontSize: 11, opacity: .7, fontFamily: 'monospace', letterSpacing: 2 }}>
              {genCode(colab.id, colab.nombre)}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, justifyContent: 'center' }}>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>
              <strong>Código:</strong> {genCode(colab.id, colab.nombre)}<br/>
              <strong>ID:</strong> {colab.id}<br/>
              <strong>Empresa:</strong> {colab.empresa || '—'}
            </div>
            <button
              onClick={() => window.print()}
              style={{ background: T.verde, color: '#fff', border: 'none', borderRadius: 10, padding: '12px 24px', fontWeight: 700, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}>
              🖨️ Imprimir fotocheck
            </button>
          </div>
        </div>
      )}

      {!colab && colaboradores.length > 0 && (
        <p style={{ color: '#999', fontSize: 13 }}>Selecciona un colaborador para ver su fotocheck.</p>
      )}
    </div>
  )
}
