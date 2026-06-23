import { useState } from 'react'
import { T } from './utils.js'
import { Btn, Inp, Field, Spinner } from './components.jsx'
import {
  registrarAdmin, loginAdmin, loginGoogle,
  vincularDispositivo, PLANES,
} from './auth.js'

// ─── PANTALLA PRINCIPAL DE AUTH ───────────────────────────────────────────────
export function AuthScreen({ onAutenticado }) {
  const [modo, setModo] = useState('inicio') // inicio | login | registro | vincular

  return (
    <div style={{ minHeight: '100vh', background: `linear-gradient(135deg, ${T.verde} 0%, #0D3320 100%)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>

      <div style={{ width: '100%', maxWidth: 400, animation: 'fadeIn .35s ease' }}>
        {/* LOGO */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 64, marginBottom: 8 }}>🌿</div>
          <div style={{ color: '#fff', fontWeight: 900, fontSize: 28, letterSpacing: -0.5 }}>Mega Asistencia</div>
          <div style={{ color: '#A5D6A7', fontSize: 14, marginTop: 4 }}>Control de personal inteligente</div>
        </div>

        {modo === 'inicio' && <PantallaInicio onModo={setModo} />}
        {modo === 'login' && <PantallaLogin onExito={onAutenticado} onVolver={() => setModo('inicio')} onRegistro={() => setModo('registro')} />}
        {modo === 'registro' && <PantallaRegistro onExito={onAutenticado} onVolver={() => setModo('inicio')} />}
        {modo === 'vincular' && <PantallaVincular onExito={onAutenticado} onVolver={() => setModo('inicio')} />}
      </div>
    </div>
  )
}

// ─── INICIO ───────────────────────────────────────────────────────────────────
function PantallaInicio({ onModo }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Opciones principales */}
      <button onClick={() => onModo('login')}
        style={{ background: '#fff', border: 'none', borderRadius: 16, padding: '18px 20px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 16, WebkitTapHighlightColor: 'transparent' }}>
        <span style={{ fontSize: 32 }}>👔</span>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16, color: T.verde }}>Soy administrador</div>
          <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>Ingresar al panel de gestión</div>
        </div>
      </button>

      <button onClick={() => onModo('vincular')}
        style={{ background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.3)', borderRadius: 16, padding: '18px 20px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 16, WebkitTapHighlightColor: 'transparent' }}>
        <span style={{ fontSize: 32 }}>📱</span>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16, color: '#fff' }}>Vincular este celular</div>
          <div style={{ fontSize: 13, color: '#A5D6A7', marginTop: 2 }}>Ingresar código del administrador</div>
        </div>
      </button>

      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <button onClick={() => onModo('registro')}
          style={{ background: 'transparent', border: 'none', color: '#A5D6A7', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
          ¿Primera vez? Crear cuenta gratis →
        </button>
      </div>

      {/* Planes — solo informativo */}
      <div style={{ marginTop: 16 }}>
        <div style={{ color: '#A5D6A7', fontSize: 11, textAlign: 'center', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Planes disponibles
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {/* FREE — destacado como plan por defecto */}
          <div style={{ background: 'rgba(255,255,255,0.18)', borderRadius: 12, padding: '14px', border: '2px solid rgba(255,255,255,0.6)', position: 'relative' }}>
            <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: '#fff', color: T.verde, fontSize: 10, fontWeight: 800, padding: '2px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>
              ✅ GRATIS
            </div>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 15, marginTop: 4 }}>Free</div>
            <div style={{ color: '#A5D6A7', fontWeight: 900, fontSize: 18, marginTop: 2 }}>S/ 0</div>
            <div style={{ marginTop: 8, fontSize: 11, color: '#A5D6A7', lineHeight: 1.7 }}>
              👥 Hasta 5 colaboradores<br />
              📱 2 dispositivos<br />
              📷 QR + PIN<br />
              <span style={{ color: '#ffffff88' }}>❌ Sin GPS ni facial</span>
            </div>
          </div>
          {/* PRO */}
          <div style={{ background: 'rgba(255,213,79,0.12)', borderRadius: 12, padding: '14px', border: '1px solid rgba(255,213,79,0.3)' }}>
            <div style={{ color: '#FFD54F', fontWeight: 800, fontSize: 15 }}>⭐ Pro</div>
            <div style={{ color: '#FFD54F', fontWeight: 900, fontSize: 18, marginTop: 2 }}>S/ 49/mes</div>
            <div style={{ marginTop: 8, fontSize: 11, color: '#A5D6A7', lineHeight: 1.7 }}>
              👥 Ilimitados<br />
              📱 Ilimitados<br />
              📍 GPS + Facial<br />
              📊 Exportar reportes
            </div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: '#A5D6A7', textAlign: 'center', marginTop: 8 }}>
          Puedes empezar gratis — sin tarjeta de crédito
        </div>
      </div>
    </div>
  )
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function PantallaLogin({ onExito, onVolver, onRegistro }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  const login = async () => {
    if (!email || !password) return setError('Completa email y contraseña')
    setCargando(true); setError('')
    try {
      await loginAdmin({ email, password })
      onExito({ tipo: 'admin' })
    } catch (e) { setError(e.message) }
    setCargando(false)
  }

  const google = async () => {
    setCargando(true); setError('')
    try { await loginGoogle() }
    catch (e) { setError(e.message); setCargando(false) }
  }

  return (
    <div style={{ background: '#fff', borderRadius: 20, padding: 28 }}>
      <div style={{ fontWeight: 900, fontSize: 20, color: T.verde, marginBottom: 20 }}>Iniciar sesión</div>

      {/* Google */}
      <button onClick={google} disabled={cargando}
        style={{ width: '100%', padding: '14px', borderRadius: 12, border: '2px solid #E0E0E0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, cursor: 'pointer', fontWeight: 700, fontSize: 15, marginBottom: 16 }}>
        <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
        Continuar con Google
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ flex: 1, height: 1, background: '#E0E0E0' }} />
        <span style={{ fontSize: 12, color: '#888' }}>o con email</span>
        <div style={{ flex: 1, height: 1, background: '#E0E0E0' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
        <Field label="Email">
          <Inp type="email" value={email} onChange={setEmail} placeholder="admin@miempresa.com" />
        </Field>
        <Field label="Contraseña">
          <Inp type="password" value={password} onChange={setPassword} placeholder="••••••••"
            onKeyDown={e => e.key === 'Enter' && login()} />
        </Field>
      </div>

      {error && <div style={{ background: '#FFEBEE', color: '#B71C1C', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 }}>⚠️ {error}</div>}

      {cargando ? <div style={{ textAlign: 'center', padding: 10 }}><Spinner /></div> : (
        <Btn full color={T.verde} onClick={login}>Ingresar</Btn>
      )}

      {/* LINK A REGISTRO */}
      <div style={{ marginTop: 16, padding: '14px', background: '#F0F9F4', borderRadius: 10, textAlign: 'center', border: '1px solid #C8E6C9' }}>
        <div style={{ fontSize: 13, color: '#555', marginBottom: 8 }}>¿No tienes cuenta aún?</div>
        <button onClick={onRegistro}
          style={{ background: T.verde, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 800, fontSize: 14, width: '100%' }}>
          Crear cuenta gratis →
        </button>
      </div>

      <button onClick={onVolver}
        style={{ width: '100%', marginTop: 10, background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: 13, padding: '8px' }}>
        ← Volver
      </button>
    </div>
  )
}

// ─── REGISTRO ─────────────────────────────────────────────────────────────────
function PantallaRegistro({ onExito, onVolver }) {
  const [form, setForm] = useState({ email: '', password: '', confirmar: '', nombreOrg: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  const registrar = async () => {
    if (!form.nombreOrg) return setError('Ingresa el nombre de tu organización')
    if (!form.email) return setError('Ingresa tu email')
    if (form.password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres')
    if (form.password !== form.confirmar) return setError('Las contraseñas no coinciden')
    setCargando(true); setError('')
    try {
      await registrarAdmin({ email: form.email, password: form.password, nombreOrg: form.nombreOrg })
      onExito({ tipo: 'admin' })
    } catch (e) { setError(e.message) }
    setCargando(false)
  }

  const google = async () => {
    if (!form.nombreOrg) return setError('Primero ingresa el nombre de tu organización')
    setCargando(true); setError('')
    try { await loginGoogle() }
    catch (e) { setError(e.message); setCargando(false) }
  }

  return (
    <div style={{ background: '#fff', borderRadius: 20, padding: 28 }}>
      <div style={{ fontWeight: 900, fontSize: 20, color: T.verde, marginBottom: 4 }}>Crear cuenta gratis</div>
      <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>Plan Free · Hasta 5 colaboradores · Sin tarjeta</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
        <Field label="Nombre de tu organización *">
          <Inp value={form.nombreOrg} onChange={v => set('nombreOrg', v)} placeholder="Ej. Hotel Los Pinos, Clínica San Juan..." />
        </Field>

        <button onClick={google} disabled={cargando || !form.nombreOrg}
          style={{ width: '100%', padding: '14px', borderRadius: 12, border: '2px solid #E0E0E0', background: form.nombreOrg ? '#fff' : '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, cursor: form.nombreOrg ? 'pointer' : 'default', fontWeight: 700, fontSize: 15 }}>
          <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          Registrarme con Google
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, height: 1, background: '#E0E0E0' }} />
          <span style={{ fontSize: 12, color: '#888' }}>o con email</span>
          <div style={{ flex: 1, height: 1, background: '#E0E0E0' }} />
        </div>

        <Field label="Email *">
          <Inp type="email" value={form.email} onChange={v => set('email', v)} placeholder="admin@miempresa.com" />
        </Field>
        <Field label="Contraseña *">
          <Inp type="password" value={form.password} onChange={v => set('password', v)} placeholder="Mínimo 6 caracteres" />
        </Field>
        <Field label="Confirmar contraseña *">
          <Inp type="password" value={form.confirmar} onChange={v => set('confirmar', v)} placeholder="Repite la contraseña" />
        </Field>
      </div>

      {error && <div style={{ background: '#FFEBEE', color: '#B71C1C', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 }}>⚠️ {error}</div>}

      {cargando ? <div style={{ textAlign: 'center', padding: 10 }}><Spinner /></div> : (
        <Btn full color={T.verde} onClick={registrar}>Crear cuenta gratis</Btn>
      )}

      <div style={{ fontSize: 11, color: '#aaa', textAlign: 'center', marginTop: 10 }}>
        Al registrarte aceptas los términos de uso
      </div>
      <button onClick={onVolver}
        style={{ width: '100%', marginTop: 8, background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: 13, padding: '8px' }}>
        ← Volver
      </button>
    </div>
  )
}

// ─── VINCULAR DISPOSITIVO ────────────────────────────────────────────────────
function PantallaVincular({ onExito, onVolver }) {
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  const vincular = async () => {
    if (codigo.length !== 6) return setError('El código tiene 6 caracteres')
    setCargando(true); setError('')
    try {
      const data = await vincularDispositivo(codigo)
      onExito({ tipo: 'device', data })
    } catch (e) { setError(e.message) }
    setCargando(false)
  }

  return (
    <div style={{ background: '#fff', borderRadius: 20, padding: 28, textAlign: 'center' }}>
      <div style={{ fontSize: 52, marginBottom: 12 }}>📱</div>
      <div style={{ fontWeight: 900, fontSize: 20, color: T.verde, marginBottom: 4 }}>Vincular celular</div>
      <div style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>
        El administrador genera un código desde<br />Panel Gerente → ⚙️ Ajustes → Dispositivos
      </div>

      <div style={{ marginBottom: 20 }}>
        <input
          value={codigo} maxLength={6}
          onChange={e => { setCodigo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')); setError('') }}
          placeholder="ABC123"
          style={{ width: '100%', padding: '18px', border: `3px solid ${codigo.length === 6 ? T.verde : '#E0E0E0'}`, borderRadius: 14, fontSize: 32, fontWeight: 900, letterSpacing: 8, textAlign: 'center', fontFamily: 'monospace', outline: 'none', transition: 'border-color .2s' }}
        />
        <div style={{ fontSize: 12, color: '#aaa', marginTop: 8 }}>
          {codigo.length}/6 caracteres
        </div>
      </div>

      {error && <div style={{ background: '#FFEBEE', color: '#B71C1C', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 }}>⚠️ {error}</div>}

      {cargando ? <div style={{ padding: 10 }}><Spinner /></div> : (
        <Btn full color={T.verde} onClick={vincular}>Vincular este celular</Btn>
      )}

      <button onClick={onVolver}
        style={{ width: '100%', marginTop: 12, background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: 13, padding: '8px' }}>
        ← Volver
      </button>
    </div>
  )
}

// ─── PANTALLA PRO — para funciones bloqueadas ─────────────────────────────────
export function PantallaPro({ feature, onCerrar }) {
  const features = {
    gps:     { icon: '📍', titulo: 'GPS en tiempo real', desc: 'Verifica la ubicación exacta de cada colaborador al marcar asistencia.' },
    facial:  { icon: '🔍', titulo: 'Reconocimiento facial', desc: 'Identidad verificada automáticamente. Nadie puede marcar por otro.' },
    exportar:{ icon: '📊', titulo: 'Exportar reportes', desc: 'Descarga reportes en Excel con historial completo del mes.' },
  }
  const f = features[feature] || { icon: '⭐', titulo: 'Función Pro', desc: '' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#00000099', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 32, maxWidth: 380, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>{f.icon}</div>
        <div style={{ fontWeight: 900, fontSize: 20, color: T.negro, marginBottom: 8 }}>{f.titulo}</div>
        <div style={{ fontSize: 14, color: '#666', marginBottom: 20 }}>{f.desc}</div>
        <div style={{ background: '#FFF8E1', borderRadius: 12, padding: '16px', marginBottom: 20, border: '2px solid #FFD54F' }}>
          <div style={{ fontWeight: 800, color: '#F57F17', marginBottom: 4 }}>🔒 Disponible en Plan Pro</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#F57F17' }}>S/ 49/mes</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Colaboradores y dispositivos ilimitados</div>
        </div>
        <Btn full color="#F57F17" onClick={() => window.open('mailto:ivan@megasostenible.pe?subject=Actualizar a Pro', '_blank')}>
          Contactar para actualizar a Pro
        </Btn>
        <button onClick={onCerrar}
          style={{ marginTop: 12, background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: 13, width: '100%', padding: '8px' }}>
          Continuar con Plan Free
        </button>
      </div>
    </div>
  )
}
