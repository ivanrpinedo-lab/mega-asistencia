/**
 * Fotocheck.jsx — Generador de fotochecks con QR
 * Exporta: QRCanvas, PanelFotocheck
 */
import { T } from './utils.js'

// ─── QRCanvas ─────────────────────────────────────────────────────────────────
export function QRCanvas({ code, size = 80 }) {
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size * 2}x${size * 2}&data=${encodeURIComponent(code)}&margin=2`
  return (
    <img
      src={url}
      alt={`QR ${code}`}
      width={size}
      height={size}
      style={{ display: 'block', imageRendering: 'pixelated', borderRadius: 4 }}
    />
  )
}

// ─── PanelFotocheck ───────────────────────────────────────────────────────────
export function PanelFotocheck({ colaboradores }) {
  if (!colaboradores || colaboradores.length === 0)
    return <p style={{ color: '#999', textAlign: 'center', padding: 40 }}>Sin colaboradores registrados.</p>

  return (
    <div>
      <h3 style={{ color: T.verde, marginBottom: 20 }}>🪪 Fotochecks del equipo</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        {colaboradores.map(c => <FotocheckCard key={c.id} colab={c} />)}
      </div>
      <div style={{ marginTop: 20, fontSize: 12, color: '#aaa' }}>
        💡 Usa Ctrl+P para imprimir los fotochecks.
      </div>
    </div>
  )
}

function genCodeFoto(id, nombre) {
  const base = (id + nombre).replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  return base.slice(0, 8).padEnd(8, '0')
}

function FotocheckCard({ colab }) {
  const code = genCodeFoto(colab.id, colab.nombre)
  return (
    <div style={{
      background: `linear-gradient(135deg, ${T.verde} 0%, #2E7D52 100%)`,
      borderRadius: 16, padding: 20, color: '#fff',
      width: 240, boxShadow: '0 4px 16px #0003',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ fontSize: 9, letterSpacing: 2, opacity: .7, textTransform: 'uppercase' }}>
        {colab.empresa || 'Mega Aventura · Mega Sostenible'}
      </div>
      {colab.face_foto && colab.face_foto !== 'null' && (
        <img src={colab.face_foto} alt={colab.nombre}
          style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,.4)' }} />
      )}
      <div style={{ fontWeight: 900, fontSize: 16, lineHeight: 1.2 }}>{colab.nombre}</div>
      <div style={{ fontSize: 12, opacity: .8 }}>{colab.cargo || 'Colaborador'}</div>
      <div style={{ background: '#fff', borderRadius: 8, padding: 8, display: 'inline-flex', alignSelf: 'flex-start', marginTop: 4 }}>
        <QRCanvas code={code} size={80} />
      </div>
      <div style={{ fontFamily: 'monospace', fontSize: 13, letterSpacing: 3, opacity: .8 }}>{code}</div>
    </div>
  )
}
