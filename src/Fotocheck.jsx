import { useEffect, useRef, useState } from 'react'
import { T, genCode, fmt } from './utils.js'
import QRCode from 'qrcode'

// ─── QR REAL (escaneable con cualquier cámara) ────────────────────────────────
export function QRCanvas({ code, size = 160 }) {
  const ref = useRef()
  useEffect(() => {
    if (!ref.current) return
    QRCode.toCanvas(ref.current, code, {
      width: size,
      margin: 2,
      color: { dark: T.verde, light: '#FFFFFF' },
      errorCorrectionLevel: 'M',
    }).catch(() => {})
  }, [code, size])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ border: `3px solid ${T.verde}`, borderRadius: 10, padding: 8, background: '#fff' }}>
        <canvas ref={ref} style={{ display: 'block' }} />
      </div>
      <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: Math.max(12, size / 10), color: T.verde, letterSpacing: 3 }}>{code}</div>
    </div>
  )
}

// ─── FOTOCHECK ────────────────────────────────────────────────────────────────
export function Fotocheck({ colab }) {
  const code = genCode(colab.id, colab.nombre)
  return (
    <div style={{ width: 280, borderRadius: 14, overflow: 'hidden', border: `3px solid ${T.verde}`, background: '#fff', boxShadow: '0 4px 20px #0002' }}>
      <div style={{ background: T.verde, padding: '14px 18px' }}>
        <div style={{ color: '#A5D6A7', fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase' }}>Personal autorizado</div>
        <div style={{ color: '#fff', fontSize: 12, fontWeight: 700, marginTop: 2 }}>{colab.empresa}</div>
      </div>
      <div style={{ padding: '18px 18px 12px', textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: T.verdeLight, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', fontSize: 30, border: `3px solid ${T.verde}` }}>
          {colab.nombre.slice(0, 1).toUpperCase()}
        </div>
        <div style={{ fontWeight: 900, fontSize: 15 }}>{colab.nombre}</div>
        <div style={{ fontSize: 12, color: T.gris, marginBottom: 4 }}>{colab.cargo}</div>
        {colab.ingreso && <div style={{ fontSize: 10, color: '#aaa', marginBottom: 14 }}>Desde {fmt(colab.ingreso)}</div>}
        <QRCanvas code={code} size={110} />
        <div style={{ marginTop: 10, fontSize: 10, color: '#aaa' }}>Escanea con la cámara para marcar asistencia</div>
      </div>
      <div style={{ background: T.grisLight, padding: '8px 18px', textAlign: 'center', fontSize: 10, color: '#888' }}>
        Juanjuí · San Martín · Perú
      </div>
    </div>
  )
}

// ─── PANEL FOTOCHECKS ─────────────────────────────────────────────────────────
export function PanelFotocheck({ colaboradores }) {
  const [selId, setSelId] = useState(colaboradores[0]?.id || '')
  const colabSel = colaboradores.find(c => c.id === selId)
  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <select value={selId} onChange={e => setSelId(e.target.value)}
          style={{ padding: '10px 14px', borderRadius: 9, border: '1.5px solid #D0D7DE', fontSize: 14, background: '#fff', minWidth: 260 }}>
          {colaboradores.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <button onClick={() => window.print()}
          style={{ padding: '10px 20px', borderRadius: 9, background: T.azul, color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
          🖨️ Imprimir fotocheck
        </button>
      </div>
      {colabSel && (
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 28 }}>
          <Fotocheck colab={colabSel} />
          <div style={{ flex: 1, minWidth: 240, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: T.verdeLight, borderRadius: 12, padding: 18, borderLeft: `5px solid ${T.verde}` }}>
              <div style={{ fontWeight: 800, color: T.verde, fontSize: 12, marginBottom: 8, textTransform: 'uppercase' }}>Código único personal</div>
              <div style={{ fontFamily: 'monospace', fontSize: 28, fontWeight: 900, color: T.verde, letterSpacing: 4 }}>{genCode(colabSel.id, colabSel.nombre)}</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 8 }}>Escaneable con cualquier cámara o ingresable manualmente.</div>
            </div>
            <div style={{ background: '#FFF3E0', borderRadius: 12, padding: 16, borderLeft: `5px solid ${T.gold}` }}>
              <div style={{ fontWeight: 800, color: T.gold, marginBottom: 10 }}>📋 Cómo usar el QR</div>
              {[
                'Imprime y plastifica este fotocheck',
                'Al llegar, abre la app → ⚡ Marcar',
                'Selecciona "Por QR" → apunta la cámara al código',
                'La app reconoce el código automáticamente',
                'Toma la selfie y confirma',
              ].map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 6, fontSize: 13 }}>
                  <span style={{ background: T.gold, color: '#fff', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{i + 1}</span>
                  {s}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <div style={{ fontWeight: 800, color: T.gris, fontSize: 15, marginBottom: 12 }}>Todos los códigos del equipo</div>
      <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 8px #0001' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: T.grisLight }}>
              {['Colaborador', 'Cargo', 'Empresa', 'Código', 'QR'].map(h => (
                <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: T.gris, textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {colaboradores.map(c => (
              <tr key={c.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '12px 14px', fontWeight: 700 }}>{c.nombre}</td>
                <td style={{ padding: '12px 14px', color: '#888' }}>{c.cargo}</td>
                <td style={{ padding: '12px 14px', color: '#888' }}>{c.empresa.replace(' SAC', '')}</td>
                <td style={{ padding: '12px 14px' }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 16, color: T.verde, background: T.verdeLight, padding: '4px 12px', borderRadius: 7, letterSpacing: 2 }}>{genCode(c.id, c.nombre)}</span>
                </td>
                <td style={{ padding: '12px 14px' }}><QRCanvas code={genCode(c.id, c.nombre)} size={56} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
