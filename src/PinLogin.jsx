import { useState, useEffect } from 'react'
import { T, genCode } from './utils.js'
import { tonoError, tonoExito } from './audio.js'

// ─── TECLADO NUMÉRICO ─────────────────────────────────────────────────────────
function Teclado({ value, onChange, color = T.verde }) {
  const teclas = [1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, '←']
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, maxWidth: 280, margin: '0 auto' }}>
      {teclas.map((t, i) => (
        <button key={i} onClick={() => {
          if (t === null) return
          if (t === '←') onChange(value.slice(0, -1))
          else if (value.length < 4) onChange(value + t)
        }} style={{
          background: t === null ? 'transparent' : '#2a2a2a',
          color: '#fff', border: 'none', borderRadius: 14,
          padding: '20px 0', fontSize: t === '←' ? 22 : 26,
          fontWeight: 700, cursor: t === null ? 'default' : 'pointer',
          transition: 'background .1s', WebkitTapHighlightColor: 'transparent',
        }}
          onTouchStart={e => t !== null && (e.currentTarget.style.background = color)}
          onTouchEnd={e => t !== null && (e.currentTarget.style.background = '#2a2a2a')}
          onMouseDown={e => t !== null && (e.currentTarget.style.background = color)}
          onMouseUp={e => t !== null && (e.currentTarget.style.background = '#2a2a2a')}
        >{t === null ? '' : t}</button>
      ))}
    </div>
  )
}

// ─── INDICADOR DE PUNTOS PIN ──────────────────────────────────────────────────
function PinDots({ value, total = 4, color = T.verde }) {
  return (
    <div style={{ display: 'flex', gap: 14, justifyContent: 'center', margin: '20px 0' }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          width: 18, height: 18, borderRadius: '50%',
          background: i < value.length ? color : '#333',
          border: `2px solid ${i < value.length ? color : '#555'}`,
          transition: 'all .15s',
          transform: i < value.length ? 'scale(1.2)' : 'scale(1)',
        }} />
      ))}
    </div>
  )
}

// ─── LOGIN POR PIN DEL COLABORADOR ───────────────────────────────────────────
export function LoginColaboradorPIN({ colaboradores, onIdentificado, onUsarQR }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [intentos, setIntentos] = useState(0)

  useEffect(() => {
    if (pin.length === 4) {
      // Comparación estricta como string en ambos lados
      const pinStr = String(pin).trim()
      const found = colaboradores.find(c => c.pin && String(c.pin).trim() === pinStr)

      if (found) {
        setError('')
        tonoExito()
        setTimeout(() => onIdentificado(found), 200)
      } else {
        const i = intentos + 1
        setIntentos(i)
        tonoError()
        const conPin = colaboradores.filter(c => c.pin)
        const msgExtra = conPin.length === 0
          ? ' (Ningún colaborador tiene PIN asignado aún)'
          : ` (${conPin.length} colaborador${conPin.length > 1 ? 'es' : ''} con PIN registrado)`
        setError(
          intentos >= 2
            ? `PIN incorrecto.${msgExtra} Usa el QR de tu fotocheck.`
            : `PIN incorrecto.${msgExtra} Inténtalo de nuevo.`
        )
        setTimeout(() => setPin(''), 600)
      }
    }
  }, [pin])

  return (
    <div style={{ background: '#111', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 340, textAlign: 'center' }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>🔐</div>
        <div style={{ color: '#fff', fontWeight: 900, fontSize: 22, marginBottom: 4 }}>Ingresa tu PIN</div>
        <div style={{ color: '#888', fontSize: 14, marginBottom: 24 }}>Tu código personal de 4 dígitos</div>

        <PinDots value={pin} color={T.verde} />

        {error && (
          <div style={{ background: '#2a0000', color: '#ff6b6b', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <Teclado value={pin} onChange={(v) => { setPin(v); setError('') }} color={T.verde} />

        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={onUsarQR} style={{
            background: 'transparent', border: `2px solid ${T.azul}`,
            borderRadius: 12, padding: '14px', color: T.azul,
            fontWeight: 700, fontSize: 15, cursor: 'pointer',
          }}>
            📷 Usar QR en cambio
          </button>
          <div style={{ color: '#555', fontSize: 12 }}>
            ¿No recuerdas tu PIN? El administrador puede verlo desde el Panel Gerente → Equipo
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── SELECTOR DE EMPRESA (fijo en el celular) ─────────────────────────────────
const EMPRESA_KEY = 'mega_empresa_fija'

export function getEmpresaFija() {
  return localStorage.getItem(EMPRESA_KEY) || null
}
export function setEmpresaFija(empresa) {
  if (empresa) localStorage.setItem(EMPRESA_KEY, empresa)
  else localStorage.removeItem(EMPRESA_KEY)
}

export function PantallaEmpresa({ onSeleccionar, empresas = [] }) {
  const lista = empresas.filter(e => e && e.trim())

  // Si hay exactamente una empresa → seleccionar automáticamente
  useEffect(() => {
    if (lista.length === 1) {
      onSeleccionar(lista[0])
    }
  }, [lista.length])

  return (
    <div style={{ background: T.verde, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 380, textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🌿</div>
        <div style={{ color: '#fff', fontWeight: 900, fontSize: 26, marginBottom: 8 }}>Mega Asistencia</div>

        {lista.length === 0 ? (
          // Cargando o sin empresas configuradas
          <div>
            <div style={{ color: '#A5D6A7', fontSize: 15, marginBottom: 24 }}>Cargando empresas...</div>
            <div style={{ width: 36, height: 36, border: '3px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.9s linear infinite', margin: '0 auto 20px' }} />
            <div style={{ color: '#A5D6A7', fontSize: 13 }}>
              Si no tienes empresas registradas,<br />
              ve al Panel Gerente → ⚙️ Ajustes → Empresas
            </div>
            <button onClick={() => onSeleccionar(null)}
              style={{ marginTop: 20, background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.3)', borderRadius: 12, padding: '14px 24px', cursor: 'pointer', color: '#fff', fontWeight: 700, fontSize: 14 }}>
              Continuar sin seleccionar empresa
            </button>
          </div>
        ) : lista.length === 1 ? (
          <div>
            <div style={{ color: '#A5D6A7', fontSize: 14 }}>Seleccionando {lista[0]}...</div>
            <div style={{ width: 32, height: 32, border: '3px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.9s linear infinite', margin: '16px auto' }} />
          </div>
        ) : (
          <>
            <div style={{ color: '#A5D6A7', fontSize: 15, marginBottom: 36 }}>¿En qué empresa estás?</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {lista.map((nombre) => (
                <button key={nombre} onClick={() => onSeleccionar(nombre)}
                  style={{
                    background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.3)',
                    borderRadius: 18, padding: '22px 20px', cursor: 'pointer',
                    textAlign: 'left', display: 'flex', alignItems: 'center', gap: 16,
                    WebkitTapHighlightColor: 'transparent',
                  }}
                  onTouchStart={e => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
                  onTouchEnd={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                >
                  <span style={{ fontSize: 36 }}>🏢</span>
                  <div>
                    <div style={{ color: '#fff', fontWeight: 800, fontSize: 17 }}>
                      {nombre.replace(' SAC', '').replace(' S.A.C.', '')}
                    </div>
                    <div style={{ color: '#A5D6A7', fontSize: 13, marginTop: 2 }}>{nombre}</div>
                  </div>
                </button>
              ))}
              <button onClick={() => onSeleccionar(null)}
                style={{
                  background: 'rgba(255,255,255,0.08)', border: '2px solid rgba(255,255,255,0.2)',
                  borderRadius: 18, padding: '18px 20px', cursor: 'pointer',
                  textAlign: 'left', display: 'flex', alignItems: 'center', gap: 16,
                  WebkitTapHighlightColor: 'transparent',
                }}>
                <span style={{ fontSize: 36 }}>🌐</span>
                <div>
                  <div style={{ color: '#fff', fontWeight: 800, fontSize: 17 }}>Todas las empresas</div>
                  <div style={{ color: '#A5D6A7', fontSize: 13, marginTop: 2 }}>Ver personal de todas</div>
                </div>
              </button>
            </div>
            <div style={{ color: '#A5D6A7', fontSize: 12, marginTop: 20 }}>
              Esta selección se guarda en este celular.
            </div>
          </>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
