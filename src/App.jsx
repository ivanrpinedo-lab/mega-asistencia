import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { T, uid, hoy, ahora, fmt, genCode, diffH, EMPRESAS, setEmpresasGlobal } from './utils.js'
import { Btn, Card, Inp, Sel, Field, Badge, Toast, Spinner, Divider, BtnVolver } from './components.jsx'
import { useGPS, mapsUrl } from './useGPS.js'
import { QRCanvas, PanelFotocheck } from './Fotocheck.jsx'
import { PanelGerente, LoginGerente, sessionValida } from './PanelGerente.jsx'
import { LoginColaboradorPIN, PantallaEmpresa, getEmpresaFija, setEmpresaFija } from './PinLogin.jsx'
import { VerificacionFacial } from './FaceRecognition.jsx'
import { confirmarMarca, rechazarIdentidad, errorGeneral, isAudioEnabled, setAudioEnabled, tonoError, precargarVoces } from './audio.js'
import { AuthScreen, PantallaPro } from './AuthScreen.jsx'
import { verificarSesion, getTenant, puedeUsarGPS, puedeUsarFacial, logoutAdmin, clearSession } from './auth.js'
import { PanelSuperAdmin } from './PanelSuperAdmin.jsx'
import {
  supabaseEnabled, reniecEnabled, consultarDNI,
  getColaboradores, upsertColaborador, deleteColaborador,
  getRegistros, getRegistrosHoy, insertRegistro,
  getEmpresas, saveEmpresas,
} from './db.js'

// ─── HOOK DATOS ───────────────────────────────────────────────────────────────
function useAppData(mesFiltro) {
  const [colaboradores, setColaboradores] = useState([])
  const [registros, setRegistros] = useState([])
  const [registrosHoy_, setRegistrosHoy_] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  const cargarEmpresas = useCallback(async () => {
    try {
      const lista = await getEmpresas()
      // Si lista es null significa que este tenant no tiene empresas configuradas
      // Resetear a vacío — NO mantener datos de otro usuario
      const listaFinal = lista || []
      setEmpresasGlobal(listaFinal)
      setEmpresas([...listaFinal])
    } catch {
      setEmpresasGlobal([])
      setEmpresas([])
    }
  }, [])

  const cargarColaboradores = useCallback(async () => {
    try { setColaboradores(await getColaboradores()) } catch (e) { setError(e.message) }
  }, [])
  const cargarRegistros = useCallback(async (mes_) => {
    try { setRegistros(await getRegistros(mes_ || mesFiltro)) } catch (e) { setError(e.message) }
  }, [mesFiltro])
  const cargarHoy = useCallback(async () => {
    try { setRegistrosHoy_(await getRegistrosHoy(hoy())) } catch (e) { setError(e.message) }
  }, [])
  const cargarTodo = useCallback(async () => {
    setCargando(true)
    await Promise.all([cargarEmpresas(), cargarColaboradores(), cargarRegistros(), cargarHoy()])
    setCargando(false)
  }, [cargarEmpresas, cargarColaboradores, cargarRegistros, cargarHoy])

  useEffect(() => { cargarTodo() }, [cargarTodo])

  const addColaborador = async (c) => {
    if (c._update) {
      // Es una edición — solo actualizar sin crear nuevo id
      const { _update, ...datos } = c
      await upsertColaborador(datos)
    } else {
      await upsertColaborador({ id: uid(), ...c })
    }
    await cargarColaboradores()
  }
  const removeColaborador = async (id) => { await deleteColaborador(id); await cargarColaboradores() }
  const addRegistro = async (reg) => {
    // Eliminar campos camelCase antes de enviar — db.js maneja la normalización
    const { colabId, tipoMarca, gpsLat, gpsLng, gpsPrecision, autorizadoPor, ...resto } = reg
    await insertRegistro({
      ...resto,
      colab_id: reg.colab_id || reg.colabId,
      tipo_marca: reg.tipo_marca || reg.tipoMarca,
      gps_lat: reg.gps_lat || reg.gpsLat || null,
      gps_lng: reg.gps_lng || reg.gpsLng || null,
      gps_precision: reg.gps_precision || reg.gpsPrecision || null,
    })
    await cargarRegistros(); await cargarHoy()
  }

  return { colaboradores, registros, registrosHoy: registrosHoy_, empresas, cargando, error, cargarTodo, cargarRegistros, addColaborador, removeColaborador, addRegistro }
}

// ─── LECTOR QR ────────────────────────────────────────────────────────────────
function LectorQR({ onDetectado }) {
  const videoRef = useRef()
  const streamRef = useRef()
  const [camError, setCamError] = useState('')
  const [manual, setManual] = useState('')
  const intervalRef = useRef()

  useEffect(() => {
    const iniciar = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
        if ('BarcodeDetector' in window) {
          const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
          intervalRef.current = setInterval(async () => {
            if (!videoRef.current || videoRef.current.readyState < 2) return
            try {
              const codes = await detector.detect(videoRef.current)
              if (codes.length > 0) {
                clearInterval(intervalRef.current)
                streamRef.current?.getTracks().forEach(t => t.stop())
                onDetectado(codes[0].rawValue)
              }
            } catch {}
          }, 400)
        } else {
          setCamError('Usa el campo manual para ingresar el código.')
        }
      } catch (e) { setCamError('Cámara no disponible: ' + e.message) }
    }
    iniciar()
    return () => { clearInterval(intervalRef.current); streamRef.current?.getTracks().forEach(t => t.stop()) }
  }, [onDetectado])

  return (
    <div>
      {!camError && (
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', borderRadius: 14, background: '#000', display: 'block', maxHeight: 240 }} />
          <div style={{ position: 'absolute', top: '15%', left: '15%', width: '70%', height: '70%', border: `3px solid ${T.verde}`, borderRadius: 12, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, textAlign: 'center', color: '#fff', fontSize: 12, fontWeight: 700, textShadow: '0 1px 4px #000' }}>
            Apunta al QR del fotocheck
          </div>
        </div>
      )}
      {camError && <div style={{ background: T.goldLight, color: T.gold, borderRadius: 9, padding: '10px 14px', fontSize: 13, marginBottom: 12 }}>⚠️ {camError}</div>}
      <div style={{ fontSize: 13, fontWeight: 700, color: T.gris, marginBottom: 8, textAlign: 'center' }}>
        {!camError ? 'O ingresa el código manualmente:' : 'Ingresa tu código:'}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={manual} onChange={e => setManual(e.target.value.toUpperCase())} placeholder="Ej. MAR-1234"
          style={{ flex: 1, padding: '14px', border: `2px solid ${T.azul}`, borderRadius: 10, fontSize: 20, fontWeight: 800, letterSpacing: 3, textAlign: 'center', fontFamily: 'monospace' }} />
        <button onClick={() => manual.length >= 5 && onDetectado(manual)}
          style={{ padding: '14px 20px', borderRadius: 10, background: T.azul, color: '#fff', border: 'none', fontWeight: 800, fontSize: 16, cursor: 'pointer' }}>OK</button>
      </div>
    </div>
  )
}

// ─── PANTALLA PRINCIPAL COLABORADOR (móvil first) ─────────────────────────────
function PantallaMarcar({ colaboradores, onRegistro, toast_, onProBloqueado }) {
  const [paso, setPaso] = useState('inicio') // inicio | qr_scan | qr_selfie | gps | gps_cam | confirmar
  const [tipoMarca, setTipoMarca] = useState(null)
  const [metodo, setMetodo] = useState(null)
  const [colab, setColab] = useState(null)
  const [colabId, setColabId] = useState(colaboradores[0]?.id || '')
  const [foto, setFoto] = useState(null)
  const [gps, setGps] = useState(null)
  const [cargandoGPS, setCargandoGPS] = useState(false)
  const { getOnce, error: gpsErr, setError: setGpsErr } = useGPS()
  const videoRef = useRef()
  const streamRef = useRef()

  const detenerCam = () => streamRef.current?.getTracks().forEach(t => t.stop())

  const iniciarCamSelfie = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 } }, audio: false })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
    } catch {}
  }

  const [procesandoFoto, setProcesandoFoto] = useState(false)

  const tomarFoto = (nombreColab) => {
    const v = videoRef.current; if (!v) return
    setProcesandoFoto(true)
    setTimeout(() => {
      const c2 = document.createElement('canvas')
      c2.width = v.videoWidth || 320; c2.height = v.videoHeight || 240
      const ctx = c2.getContext('2d')
      ctx.drawImage(v, 0, 0)
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, c2.height - 40, c2.width, 40)
      ctx.fillStyle = '#fff'; ctx.font = 'bold 12px monospace'
      ctx.fillText(`${nombreColab} · ${tipoMarca?.toUpperCase()} · ${ahora()} ${hoy()}`, 6, c2.height - 22)
      if (gps) { ctx.font = '10px monospace'; ctx.fillText(`GPS: ${gps.lat}, ${gps.lng}`, 6, c2.height - 6) }
      const dataUrl = c2.toDataURL('image/jpeg', 0.65) // calidad reducida para Supabase
      setFoto(dataUrl); detenerCam(); setProcesandoFoto(false); setPaso('confirmar')
    }, 100)
  }

  const onQRDetectado = (codigo) => {
    const found = colaboradores.find(c => genCode(c.id, c.nombre).toUpperCase() === codigo.toUpperCase().trim())
    if (!found) { toast_('Código no válido. Verifica tu fotocheck.', 'err'); return }
    setColab(found)
    // Si tiene foto de referencia Y el plan permite facial → verificar rostro
    const tieneDescriptor = found.face_descriptor && found.face_descriptor !== 'null'
    if (tieneDescriptor && puedeUsarFacial()) { setPaso('face'); return }
    setPaso('qr_selfie'); setTimeout(iniciarCamSelfie, 300)
  }

  const obtenerGPS = async () => {
    setCargandoGPS(true); setGpsErr(null)
    try {
      const p = await getOnce()
      setGps(p)
      setCargandoGPS(false)
      // Si el colaborador tiene foto de referencia → verificar rostro antes de selfie
      const colabGPS = colaboradores.find(c => c.id === colabId)
      const tieneDescriptor = colabGPS?.face_descriptor && colabGPS.face_descriptor !== 'null'
      if (tieneDescriptor && puedeUsarFacial()) {
        setColab(colabGPS)
        setPaso('face')
      } else {
        setPaso('gps_cam')
        setTimeout(iniciarCamSelfie, 300)
      }
    }
    catch (e) { setGpsErr(e.message); setCargandoGPS(false) }
  }

  const [guardando, setGuardando] = useState(false)

  const confirmar = async () => {
    setGuardando(true)
    const id = metodo === 'qr' ? colab?.id : colabId
    const nombre = colab?.nombre || colaboradores.find(c => c.id === colabId)?.nombre || ''
    await onRegistro({
      id: uid(),
      metodo: metodo === 'qr' ? 'QR' : metodo === 'pin' ? 'PIN' : 'GPS+Selfie',
      tipo: 'checkin',
      colab_id: id,
      fecha: hoy(), hora: ahora(), timestamp: new Date().toISOString(),
      tipo_marca: tipoMarca,
      foto: foto || null,
      gps_lat: gps?.lat || null,
      gps_lng: gps?.lng || null,
      gps_precision: gps?.precision || null,
    })
    // Audio de confirmación
    confirmarMarca(tipoMarca, nombre)
    setGuardando(false)
    setPaso('inicio'); setTipoMarca(null); setMetodo(null)
    setColab(null); setFoto(null); setGps(null)
  }

  useEffect(() => () => detenerCam(), [])

  const nombreColab = metodo === 'qr' ? colab?.nombre : colaboradores.find(c => c.id === colabId)?.nombre || ''
  const colorMarca = tipoMarca === 'entrada' ? T.verde : tipoMarca === 'salida' ? T.rojo : T.morado

  // ── INICIO ────────────────────────────────────────────────────────────────
  if (paso === 'inicio') return (
    <div style={{ animation: 'slideUp .3s ease', padding: '8px 0' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 56, marginBottom: 8 }}>🌿</div>
        <div style={{ fontWeight: 900, fontSize: 24, color: T.verde }}>Mega Asistencia</div>
        <div style={{ fontSize: 14, color: '#888', marginTop: 4 }}>
          {supabaseEnabled ? '☁️ Conectado a la nube' : '💾 Modo local'}
        </div>
      </div>

      {colaboradores.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, color: '#888' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>👥</div>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Sin colaboradores</div>
          <div style={{ fontSize: 13 }}>El administrador debe registrar al personal desde el Panel Gerente</div>
        </div>
      ) : (
        <>
          <div style={{ fontWeight: 800, fontSize: 16, color: T.gris, textAlign: 'center', marginBottom: 16 }}>
            ¿Qué vas a registrar?
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
            {[
              { tipo: 'entrada', icon: '🟢', label: 'ENTRADA', color: T.verde, bg: T.verdeLight },
              { tipo: 'salida', icon: '🔴', label: 'SALIDA', color: T.rojo, bg: T.rojoLight },
              { tipo: 'campo', icon: '🚗', label: 'SALIDA A CAMPO', color: T.morado, bg: T.moradoLight },
              { tipo: 'descanso', icon: '🍽️', label: 'DESCANSO', color: T.gold, bg: T.goldLight },
            ].map(({ tipo, icon, label, color, bg }) => (
              <button key={tipo} onClick={() => { setTipoMarca(tipo); setPaso('identificar') }}
                style={{ background: bg, border: `3px solid ${color}`, borderRadius: 18, padding: '24px 12px', cursor: 'pointer', textAlign: 'center', transition: 'transform .1s', WebkitTapHighlightColor: 'transparent' }}
                onTouchStart={e => e.currentTarget.style.transform = 'scale(0.96)'}
                onTouchEnd={e => e.currentTarget.style.transform = 'scale(1)'}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>{icon}</div>
                <div style={{ fontWeight: 900, fontSize: 16, color }}>{label}</div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )

  // ── IDENTIFICAR (PIN o QR) ────────────────────────────────────────────────
  if (paso === 'identificar') {
    const hayColabsConPIN = colaboradores.some(c => c.pin)
    return (
      <div style={{ animation: 'slideUp .3s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <BtnVolver onClick={() => setPaso('inicio')} />
          <div style={{ fontWeight: 900, fontSize: 20, color: colorMarca }}>
            {tipoMarca === 'entrada' ? '🟢 Entrada' : tipoMarca === 'salida' ? '🔴 Salida' : tipoMarca === 'campo' ? '🚗 Campo' : '🍽️ Descanso'}
          </div>
        </div>
        <div style={{ fontWeight: 700, fontSize: 15, color: T.gris, marginBottom: 16 }}>¿Cómo quieres identificarte?</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {hayColabsConPIN && (
            <button onClick={() => setPaso('pin')}
              style={{ background: '#1A1A2E', border: `3px solid #FFD54F`, borderRadius: 16, padding: '22px 20px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ fontSize: 44 }}>🔐</span>
              <div>
                <div style={{ fontWeight: 900, fontSize: 18, color: '#FFD54F' }}>PIN personal</div>
                <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>Ingresa tu código de 4 dígitos</div>
              </div>
            </button>
          )}
          <button onClick={() => setPaso('metodo')}
            style={{ background: T.azulLight, border: `3px solid ${T.azul}`, borderRadius: 16, padding: '22px 20px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 44 }}>📷</span>
            <div>
              <div style={{ fontWeight: 900, fontSize: 18, color: T.azul }}>Escanear QR</div>
              <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>Apunta la cámara a tu fotocheck</div>
            </div>
          </button>
          <button onClick={() => {
            if (!puedeUsarGPS()) { onProBloqueado?.('gps'); return }
            setMetodo('gps'); setPaso('gps')
          }}
            style={{ background: puedeUsarGPS() ? T.moradoLight : T.grisLight, border: `3px solid ${puedeUsarGPS() ? T.morado : T.grisMid}`, borderRadius: 16, padding: '22px 20px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 44 }}>{puedeUsarGPS() ? '📍' : '🔒'}</span>
            <div>
              <div style={{ fontWeight: 900, fontSize: 18, color: puedeUsarGPS() ? T.morado : T.grisMid }}>GPS + Selfie {!puedeUsarGPS() ? '· Pro' : ''}</div>
              <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>{puedeUsarGPS() ? 'Registra tu ubicación exacta' : 'Disponible en Plan Pro'}</div>
            </div>
          </button>
        </div>
      </div>
    )
  }

  // ── PIN ───────────────────────────────────────────────────────────────────
  if (paso === 'pin') return (
    <LoginColaboradorPIN
      colaboradores={colaboradores}
      onIdentificado={(c) => {
        setColab(c)
        setColabId(c.id)
        setMetodo('pin')
        // Si tiene foto de referencia Y el plan permite facial → verificar rostro
        const tieneDescriptor = c.face_descriptor && c.face_descriptor !== 'null'
        if (tieneDescriptor && puedeUsarFacial()) setPaso('face')
        else setPaso('confirmar')
      }}
      onUsarQR={() => setPaso('metodo')}
    />
  )

  // ── VERIFICACIÓN FACIAL ───────────────────────────────────────────────────
  if (paso === 'face') {
    const colabParaVerificar = colab || colaboradores.find(c => c.id === colabId)
    return (
      <div style={{ animation: 'slideUp .3s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <BtnVolver onClick={() => setPaso('identificar')} />
          <div style={{ fontWeight: 900, fontSize: 18, color: T.verde }}>🔍 Verificación facial</div>
        </div>
        <VerificacionFacial
          colaborador={colabParaVerificar}
          onVerificado={(fotoVerif, desc) => {
            setFoto(fotoVerif)
            // Si es GPS → aún necesita tomar selfie con coordenadas incrustadas
            if (metodo === 'gps') {
              setPaso('gps_cam')
              setTimeout(iniciarCamSelfie, 300)
            } else {
              setPaso('confirmar')
            }
          }}
          onSinFoto={() => {
            if (metodo === 'gps') {
              setPaso('gps_cam')
              setTimeout(iniciarCamSelfie, 300)
            } else {
              setPaso('confirmar')
            }
          }}
          onRechazado={() => {
            rechazarIdentidad()
            setColab(null)
            setPaso('identificar')
          }}
        />
      </div>
    )
  }

  // ── MÉTODO ────────────────────────────────────────────────────────────────
  if (paso === 'metodo') return (
    <div style={{ animation: 'slideUp .3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <BtnVolver onClick={() => setPaso('inicio')} />
        <div style={{ fontWeight: 900, fontSize: 20, color: colorMarca }}>
          {tipoMarca === 'entrada' ? '🟢 Entrada' : tipoMarca === 'salida' ? '🔴 Salida' : tipoMarca === 'campo' ? '🚗 Campo' : '🍽️ Descanso'}
        </div>
      </div>
      <div style={{ fontWeight: 700, fontSize: 15, color: T.gris, marginBottom: 16 }}>¿Cómo quieres identificarte?</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <button onClick={() => { setMetodo('qr'); setPaso('qr_scan') }}
          style={{ background: T.azulLight, border: `3px solid ${T.azul}`, borderRadius: 16, padding: '22px 20px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 44 }}>📷</span>
          <div>
            <div style={{ fontWeight: 900, fontSize: 18, color: T.azul }}>Escanear QR</div>
            <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>Apunta la cámara a tu fotocheck</div>
          </div>
        </button>
        <button onClick={() => { setMetodo('gps'); setPaso('gps') }}
          style={{ background: T.moradoLight, border: `3px solid ${T.morado}`, borderRadius: 16, padding: '22px 20px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 44 }}>📍</span>
          <div>
            <div style={{ fontWeight: 900, fontSize: 18, color: T.morado }}>GPS + Selfie</div>
            <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>Registra tu ubicación exacta</div>
          </div>
        </button>
      </div>
    </div>
  )

  // ── SCAN QR ───────────────────────────────────────────────────────────────
  if (paso === 'qr_scan') return (
    <div style={{ animation: 'slideUp .3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <BtnVolver onClick={() => setPaso('metodo')} />
        <div style={{ fontWeight: 900, fontSize: 18, color: T.azul }}>📷 Escanear QR</div>
      </div>
      <LectorQR onDetectado={onQRDetectado} />
    </div>
  )

  // ── QR SELFIE ─────────────────────────────────────────────────────────────
  if (paso === 'qr_selfie') return (
    <div style={{ animation: 'slideUp .3s ease', textAlign: 'center' }}>
      <div style={{ fontWeight: 900, fontSize: 20, color: T.verde, marginBottom: 4 }}>👋 Hola, {colab?.nombre.split(' ')[0]}</div>
      <div style={{ fontSize: 14, color: '#888', marginBottom: 16 }}>Toma tu selfie para confirmar</div>
      <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', borderRadius: 16, background: '#000', marginBottom: 16, maxHeight: 280 }} />
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={() => tomarFoto(colab?.nombre || '')} disabled={procesandoFoto} style={{ flex: 1, padding: '18px', borderRadius: 14, background: procesandoFoto ? T.grisMid : T.verde, color: '#fff', border: 'none', fontWeight: 900, fontSize: 18, cursor: procesandoFoto ? 'default' : 'pointer' }}>{procesandoFoto ? '⏳ Procesando...': '📸 Tomar selfie'}</button>
        <button onClick={() => { detenerCam(); setPaso('confirmar') }} style={{ padding: '18px 20px', borderRadius: 14, background: T.grisLight, border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer', color: T.gris }}>Sin foto</button>
      </div>
    </div>
  )

  // ── GPS ───────────────────────────────────────────────────────────────────
  if (paso === 'gps') return (
    <div style={{ animation: 'slideUp .3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <BtnVolver onClick={() => setPaso('metodo')} />
        <div style={{ fontWeight: 900, fontSize: 18, color: T.morado }}>📍 GPS + Selfie</div>
      </div>
      <Field label="¿Quién eres?">
        <Sel value={colabId} onChange={setColabId} style={{ fontSize: 16, padding: '14px' }}>
          {colaboradores.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </Sel>
      </Field>
      {gpsErr && <div style={{ background: T.rojoLight, color: T.rojo, borderRadius: 10, padding: '12px', fontSize: 13, marginBottom: 14 }}>❌ {gpsErr}<br /><small>Activa el GPS e inténtalo de nuevo</small></div>}
      <button onClick={obtenerGPS} disabled={cargandoGPS}
        style={{ width: '100%', padding: '20px', borderRadius: 16, background: cargandoGPS ? T.grisMid : T.morado, color: '#fff', border: 'none', fontWeight: 900, fontSize: 18, cursor: cargandoGPS ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        {cargandoGPS ? <><div style={{ width: 24, height: 24, border: '3px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} /> Obteniendo GPS...</> : <>📡 Obtener mi ubicación</>}
      </button>
      <div style={{ marginTop: 10, fontSize: 12, color: '#aaa', textAlign: 'center' }}>Se solicitará permiso de ubicación</div>
    </div>
  )

  // ── GPS CÁMARA ────────────────────────────────────────────────────────────
  if (paso === 'gps_cam') return (
    <div style={{ animation: 'slideUp .3s ease', textAlign: 'center' }}>
      {gps && <div style={{ background: T.moradoLight, borderRadius: 10, padding: '10px', marginBottom: 14, fontSize: 12, color: T.morado, fontWeight: 700 }}>✅ GPS: {gps.lat}, {gps.lng} · ±{gps.precision}m</div>}
      <div style={{ fontWeight: 900, fontSize: 20, color: T.morado, marginBottom: 4 }}>📸 Ahora tu selfie</div>
      <div style={{ fontSize: 14, color: '#888', marginBottom: 14 }}>La foto incluirá las coordenadas GPS</div>
      <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', borderRadius: 16, background: '#000', marginBottom: 16, maxHeight: 280 }} />
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={() => tomarFoto(nombreColab)} style={{ flex: 1, padding: '18px', borderRadius: 14, background: T.morado, color: '#fff', border: 'none', fontWeight: 900, fontSize: 18, cursor: 'pointer' }}>📸 Tomar selfie</button>
        <button onClick={() => { detenerCam(); setPaso('confirmar') }} style={{ padding: '18px 20px', borderRadius: 14, background: T.grisLight, border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer', color: T.gris }}>Sin foto</button>
      </div>
    </div>
  )

  // ── CONFIRMAR ─────────────────────────────────────────────────────────────
  if (paso === 'confirmar') return (
    <div style={{ animation: 'scaleIn .25s ease', textAlign: 'center' }}>
      <div style={{ fontSize: 72, marginBottom: 8 }}>
        {tipoMarca === 'entrada' ? '✅' : tipoMarca === 'salida' ? '👋' : tipoMarca === 'campo' ? '🚗' : '🍽️'}
      </div>
      <div style={{ fontWeight: 900, fontSize: 22, color: colorMarca, marginBottom: 4 }}>{nombreColab}</div>
      <div style={{ fontSize: 14, color: '#888', marginBottom: 20 }}>
        {colaboradores.find(c => c.id === (metodo === 'qr' ? colab?.id : colabId))?.cargo}
      </div>
      <div style={{ background: colorMarca + '18', border: `3px solid ${colorMarca}`, borderRadius: 18, padding: '20px', marginBottom: 16 }}>
        <div style={{ fontSize: 42, fontWeight: 900, color: colorMarca }}>{ahora()}</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: colorMarca, textTransform: 'uppercase', letterSpacing: 2, marginTop: 4 }}>{tipoMarca}</div>
        <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>{fmt(hoy())}</div>
      </div>
      {foto && <img src={foto} alt="selfie" style={{ width: '100%', maxWidth: 260, borderRadius: 14, border: `3px solid ${colorMarca}`, marginBottom: 8, display: 'block', margin: '0 auto 12px' }} />}
      {!foto && (
        <div style={{ background: T.goldLight, borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: T.gold, textAlign: 'center' }}>
          ⚠️ Sin foto — el registro se guardará sin imagen
        </div>
      )}
      {gps && <a href={mapsUrl(gps.lat, gps.lng)} target="_blank" rel="noreferrer" style={{ display: 'block', fontSize: 13, color: T.azul, marginBottom: 16 }}>📍 Ver ubicación en Google Maps</a>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button onClick={confirmar} disabled={guardando}
          style={{ width: '100%', padding: '20px', borderRadius: 16, background: guardando ? T.grisMid : colorMarca, color: '#fff', border: 'none', fontWeight: 900, fontSize: 20, cursor: guardando ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          {guardando ? (
            <>
              <div style={{ width: 24, height: 24, border: '3px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
              Guardando...
            </>
          ) : `✅ Confirmar ${tipoMarca}`}
        </button>
        <button onClick={() => { setPaso('inicio'); setTipoMarca(null); setMetodo(null); setColab(null); setFoto(null); setGps(null) }}
          disabled={guardando}
          style={{ width: '100%', padding: '16px', borderRadius: 16, background: T.grisLight, border: `2px solid #D0D7DE`, fontWeight: 800, fontSize: 16, cursor: guardando ? 'default' : 'pointer', color: T.gris, minHeight: 52 }}>
          ← Cancelar
        </button>
      </div>
    </div>
  )

  return null
}

// ─── PANEL EQUIPO ─────────────────────────────────────────────────────────────
export function PanelEquipo({ colaboradores, onAdd, onDelete, toast_ }) {
  const [show, setShow] = useState(false)
  const [buscandoDNI, setBuscandoDNI] = useState(false)
  const [form, setForm] = useState({ nombre:'', cargo:'', empresa:EMPRESAS[0], salario:'', ingreso:hoy(), turno:'diurno', horario:'08:00 - 17:00', tiene_descanso:false, horario_descanso:'13:00 - 14:00', dni:'', telefono:'' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const buscarDNI = async () => {
    if (!/^\d{8}$/.test(form.dni)) return toast_('DNI debe tener 8 dígitos', 'err')
    setBuscandoDNI(true)
    try { const r = await consultarDNI(form.dni); set('nombre', r.nombre); toast_('Nombre obtenido de RENIEC') }
    catch (e) { toast_(e.message, 'err') }
    setBuscandoDNI(false)
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div style={{ fontWeight:900, fontSize:18 }}>👥 Equipo</div>
        <Btn onClick={() => setShow(!show)}>+ Nuevo colaborador</Btn>
      </div>
      {!supabaseEnabled && (
        <div style={{ background:T.goldLight, borderLeft:`5px solid ${T.gold}`, borderRadius:10, padding:'12px 16px', marginBottom:16, fontSize:13 }}>
          <b>⚠️ Modo local:</b> datos solo en este dispositivo.
        </div>
      )}
      {show && (
        <Card style={{ marginBottom:20, borderLeft:`5px solid ${T.verde}` }}>
          <div style={{ fontWeight:800, color:T.verde, marginBottom:14 }}>Nuevo colaborador</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8, alignItems:'end' }}>
            <Field label="DNI *"><Inp value={form.dni} onChange={v => set('dni', v.replace(/\D/g,'').slice(0,8))} placeholder="12345678" style={{ letterSpacing:3, fontSize:18, fontWeight:700 }} /></Field>
            <div style={{ marginBottom:14 }}><Btn color={T.azul} onClick={buscarDNI} disabled={buscandoDNI||form.dni.length!==8}>{buscandoDNI?'⏳':reniecEnabled?'🔍 RENIEC':'🔍'}</Btn></div>
          </div>
          {!reniecEnabled && <div style={{ background:T.azulLight, borderRadius:8, padding:'8px 12px', fontSize:12, color:T.azul, marginBottom:12 }}>
            💡 Para RENIEC: Vercel → Settings → Environment Variables → <b>VITE_RENIEC_TOKEN</b>
          </div>}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:12 }}>
            <Field label="Nombre completo *"><Inp value={form.nombre} onChange={v => set('nombre',v)} placeholder="Apellidos y nombres" /></Field>
            <Field label="Teléfono"><Inp value={form.telefono} onChange={v => set('telefono',v)} placeholder="+51 9..." /></Field>
            <Field label="Cargo *"><Inp value={form.cargo} onChange={v => set('cargo',v)} placeholder="Recepcionista..." /></Field>
            <Field label="Empresa *"><Sel value={form.empresa} onChange={v => set('empresa',v)}>{EMPRESAS.map(e=><option key={e}>{e}</option>)}</Sel></Field>
            <Field label="Salario (S/) *"><Inp type="number" value={form.salario} onChange={v => set('salario',v)} placeholder="1130" /></Field>
            <Field label="Fecha ingreso"><Inp type="date" value={form.ingreso} onChange={v => set('ingreso',v)} /></Field>
            <Field label="Turno"><Sel value={form.turno} onChange={v => set('turno',v)}><option value="diurno">☀️ Diurno</option><option value="nocturno">🌙 Nocturno</option><option value="rotativo">🔄 Rotativo</option></Sel></Field>
            <Field label="Horario"><Inp value={form.horario} onChange={v => set('horario',v)} placeholder="08:00 - 17:00" /></Field>
          </div>
          <div style={{ background:T.grisLight, borderRadius:10, padding:'12px 14px', marginTop:8 }}>
            <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', fontSize:14, fontWeight:700 }}>
              <input type="checkbox" checked={form.tiene_descanso} onChange={e => set('tiene_descanso',e.target.checked)} style={{ width:18, height:18 }} />
              🍽️ Tiene descanso / almuerzo
            </label>
            {form.tiene_descanso && (
              <div style={{ marginTop:10 }}>
                <Field label="Horario de descanso" hint="No cuenta como horas trabajadas">
                  <Inp value={form.horario_descanso} onChange={v => set('horario_descanso',v)} placeholder="13:00 - 14:00" />
                </Field>
              </div>
            )}
          </div>
          <div style={{ display:'flex', gap:10, marginTop:16 }}>
            <Btn onClick={async () => {
              if (!form.nombre||!form.cargo||!form.salario) return toast_('Completa nombre, cargo y salario','err')
              await onAdd(form); setShow(false); toast_('Colaborador agregado')
              setForm({ nombre:'', cargo:'', empresa:EMPRESAS[0], salario:'', ingreso:hoy(), turno:'diurno', horario:'08:00 - 17:00', tiene_descanso:false, horario_descanso:'13:00 - 14:00', dni:'', telefono:'' })
            }}>Agregar</Btn>
            <Btn outline color={T.gris} onClick={() => setShow(false)}>Cancelar</Btn>
          </div>
        </Card>
      )}
      {colaboradores.length === 0 ? (
        <Card style={{ textAlign:'center', padding:48, color:'#888' }}>Sin colaboradores registrados.</Card>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:14 }}>
          {colaboradores.map(c => (
            <Card key={c.id} style={{ borderLeft:`4px solid ${T.verde}` }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <div style={{ fontWeight:800, fontSize:16 }}>{c.nombre}</div>
                  <div style={{ fontSize:12, color:'#888' }}>{c.cargo}</div>
                  <Badge label={c.empresa?.replace(' SAC','')} color={T.verde} bg={T.verdeLight} />
                </div>
                <button onClick={async () => { if(confirm(`¿Eliminar a ${c.nombre}?`)){ await onDelete(c.id); toast_('Eliminado') }}}
                  style={{ background:T.rojoLight, color:T.rojo, border:'none', borderRadius:7, padding:'5px 11px', cursor:'pointer', fontSize:12, fontWeight:700 }}>✕</button>
              </div>
              <div style={{ marginTop:12, fontSize:13, color:T.gris, lineHeight:1.9 }}>
                <div>💰 S/ {Number(c.salario||0).toFixed(2)}/mes · {c.turno}</div>
                <div>🕐 {c.horario}{c.tiene_descanso?` (descanso ${c.horario_descanso})`:''}</div>
                {c.ingreso&&<div>📅 Desde: {fmt(c.ingreso)}</div>}
                {c.dni&&<div>🪪 {c.dni}</div>}
                {c.telefono&&<div>📱 {c.telefono}</div>}
              </div>
              <div style={{ marginTop:10, padding:'10px 12px', background:T.verdeLight, borderRadius:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontSize:10, color:T.gris, fontWeight:700, textTransform:'uppercase' }}>Código QR</div>
                  <div style={{ fontFamily:'monospace', fontSize:17, fontWeight:900, color:T.verde, letterSpacing:3 }}>{genCode(c.id,c.nombre)}</div>
                </div>
                <QRCanvas code={genCode(c.id,c.nombre)} size={48} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── APP PRINCIPAL ─────────────────────────────────────────────────────────────
export default function App() {
  // Ruta especial para superadmin — antes de cualquier hook
  if (window.location.pathname === '/superadmin' || window.location.search.includes('superadmin=1')) {
    return <PanelSuperAdmin onSalir={() => { window.history.pushState({}, '', '/'); window.location.reload() }} />
  }
  return <AppMain />
}

function AppMain() {
  const [mesFiltro, setMesFiltro] = useState(hoy().slice(0,7))
  const [toast, setToast] = useState(null)
  const [modoGerente, setModoGerente] = useState(false)
  const [loginGerente, setLoginGerente] = useState(false)
  const [audioOn, setAudioOn] = useState(isAudioEnabled())
  const [verHistorialDia, setVerHistorialDia] = useState(false)
  const [sesion, setSesion] = useState(undefined) // undefined=cargando, null=sin sesión, obj=ok
  const [modalPro, setModalPro] = useState(null) // feature bloqueada

  // Verificar sesión al abrir
  useEffect(() => {
    precargarVoces()

    const init = async () => {
      // Detectar callback de Google OAuth — Supabase usa hash o code en URL
      const hash = window.location.hash
      const search = window.location.search
      const esCallbackOAuth = hash.includes('access_token') ||
                               hash.includes('error') ||
                               search.includes('code=') ||
                               search.includes('auth=google')

      if (esCallbackOAuth) {
        try {
          // Supabase maneja el hash automáticamente al llamar getSession
          const { handleGoogleCallback } = await import('./auth.js')
          // Pequeña pausa para que Supabase procese el token del hash
          await new Promise(res => setTimeout(res, 800))
          const r = await handleGoogleCallback()
          if (r) {
            setSesion({ tipo: 'admin', tenant: getTenant() })
            // Limpiar URL
            window.history.replaceState({}, '', '/')
            return
          }
        } catch (e) {
          console.error('Error callback Google:', e)
        }
      }

      // Verificar sesión normal
      const s = await verificarSesion()
      setSesion(s)
      // Si hay sesión activa, recargar datos con el tenant_id correcto
      if (s) cargarTodo()
    }

    init()
  }, [])
  const [empresaFija, setEmpresaFijaState] = useState(() => getEmpresaFija())
  const [configurandoEmpresa, setConfigurando] = useState(false) // se activa después de cargar sesión y empresas

  const { colaboradores, registros, registrosHoy, empresas, cargando, error, cargarTodo, cargarRegistros, addColaborador, removeColaborador, addRegistro } = useAppData(mesFiltro)
  const toast_ = useCallback((msg, tipo='ok') => { setToast({msg,tipo}); setTimeout(()=>setToast(null),3500) }, [])

  // Activar configuración de empresa solo cuando:
  // 1. Hay sesión activa
  // 2. No hay empresa fija guardada
  // 3. Las empresas ya cargaron (aunque sea lista vacía)
  useEffect(() => {
    if (sesion && !cargando && !getEmpresaFija()) {
      setConfigurando(true)
    }
  }, [sesion, cargando])

  // Filtrar colaboradores por empresa fija del celular
  const colabsDisponibles = useMemo(() =>
    empresaFija ? colaboradores.filter(c => c.empresa === empresaFija) : colaboradores,
    [colaboradores, empresaFija])

  const onAddRegistro = useCallback(async (reg) => {
    try { await addRegistro(reg); toast_(`${(reg.tipoMarca||'Registro').toUpperCase()} guardado`) }
    catch (e) { toast_(e.message,'err') }
  }, [addRegistro, toast_])

  // Pantalla de selección de empresa (primera vez)
  if (configurandoEmpresa) return (
    <PantallaEmpresa empresas={empresas} onSeleccionar={(empresa) => {
      setEmpresaFija(empresa)
      setEmpresaFijaState(empresa)
      setConfigurando(false)
    }} />
  )

  // Modo gerente — pantalla completa separada
  if (loginGerente && !modoGerente) return <LoginGerente onEntrar={() => { setLoginGerente(false); setModoGerente(true) }} onVolver={() => setLoginGerente(false)} />
  if (modoGerente) return (
    <PanelGerente
      data={{ colaboradores, registros }} mes={mesFiltro}
      save={() => {}} toast_={toast_}
      onSalir={() => setModoGerente(false)}
      addColaborador={addColaborador}
      removeColaborador={removeColaborador}
      mesFiltro={mesFiltro} setMesFiltro={async (nuevoMes) => {
        setMesFiltro(nuevoMes)
        await cargarRegistros(nuevoMes)
      }}
      empresas={empresas}
      onEmpresasChange={async (nuevas) => {
        try {
          await saveEmpresas(nuevas)
          setEmpresasGlobal(nuevas)
          // Forzar re-render recargando desde BD
          const lista = await getEmpresas()
          const listaFinal = lista || nuevas
          setEmpresasGlobal(listaFinal)
          // Si la empresa fija ya no existe, resetear
          const empresaActual = getEmpresaFija()
          if (empresaActual && !listaFinal.includes(empresaActual)) {
            setEmpresaFija(null)
            setEmpresaFijaState(null)
          }
          // Recargar todo para que PanelEquipo reciba las empresas actualizadas
          await cargarTodo()
          toast_('✅ Empresas guardadas — ya puedes crear colaboradores')
        } catch (e) {
          toast_('Error al guardar: ' + e.message, 'err')
        }
      }}
    />
  )

  // Pantalla de carga inicial
  if (sesion === undefined) return (
    <div style={{ minHeight:'100vh', background:`linear-gradient(135deg, ${T.verde} 0%, #0D3320 100%)`, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:64, marginBottom:16 }}>🌿</div>
        <div style={{ color:'#fff', fontWeight:900, fontSize:22 }}>Mega Asistencia</div>
        <div style={{ marginTop:20 }}><div style={{ width:36, height:36, border:'3px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.9s linear infinite', margin:'0 auto' }}/></div>
      </div>
    </div>
  )

  // Sin sesión → pantalla de autenticación
  if (!sesion) return (
    <AuthScreen onAutenticado={async (s) => {
      setSesion(s)
      // Recargar datos con el nuevo tenant_id
      await cargarTodo()
    }} />
  )

  return (
    <div style={{ fontFamily:"'Segoe UI',Arial,sans-serif", minHeight:'100vh', background:'#F0F4F8' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes slideUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}} @keyframes scaleIn{from{opacity:0;transform:scale(0.9)}to{opacity:1;transform:scale(1)}}`}</style>

      {/* HEADER MÍNIMO */}
      <div style={{ background:T.verde, padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', boxShadow:'0 2px 12px #0004', position:'sticky', top:0, zIndex:100 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0, flex:1 }}>
          <span style={{ fontSize:20, flexShrink:0 }}>🌿</span>
          <div style={{ minWidth:0 }}>
            <div style={{ color:'#fff', fontWeight:900, fontSize:14 }}>MEGA ASISTENCIA</div>
            {sesion?.tenant?.nombre_org && (
              <div style={{ color:'#A5D6A7', fontSize:9, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {sesion.tenant.nombre_org} · {sesion.tenant.plan === 'pro' ? '⭐ Pro' : '🆓 Free'}
              </div>
            )}
          </div>
        </div>
        <div style={{ display:'flex', gap:6, alignItems:'center', flexShrink:0 }}>
          {empresaFija && empresas.length > 0 && (
            <button onClick={() => setConfigurando(true)}
              style={{ background:'rgba(255,255,255,0.15)', border:'none', borderRadius:8, color:'#A5D6A7', padding:'6px 8px', cursor:'pointer', fontSize:10, fontWeight:700 }}>
              🏢 {empresaFija.replace(' SAC','').replace(' S.A.C.','').split(' ').pop()}
            </button>
          )}
          <button onClick={() => { const v = !audioOn; setAudioOn(v); setAudioEnabled(v) }}
            title={audioOn ? 'Silenciar' : 'Activar sonido'}
            style={{ background:'rgba(255,255,255,0.15)', border:'none', borderRadius:8, color:'#fff', padding:'7px 9px', cursor:'pointer', fontSize:15 }}>
            {audioOn ? '🔊' : '🔇'}
          </button>
          <button onClick={cargarTodo}
            style={{ background:'rgba(255,255,255,0.15)', border:'none', borderRadius:8, color:'#fff', padding:'7px 9px', cursor:'pointer', fontSize:15 }}>🔄</button>
          <button onClick={() => { if(sessionValida()) setModoGerente(true); else setLoginGerente(true) }}
            style={{ background:'rgba(255,213,79,0.2)', border:'1px solid rgba(255,213,79,0.5)', borderRadius:8, color:'#FFD54F', padding:'7px 10px', cursor:'pointer', fontWeight:800, fontSize:13 }}>
            👔
          </button>
          {/* LOGOUT */}
          <button onClick={async () => {
            if (confirm('¿Cerrar sesión y cambiar de usuario?')) {
              await logoutAdmin()
              clearSession()
              setEmpresasGlobal([])
              setEmpresaFijaState(null)
              setSesion(null)
            }
          }}
            title="Cerrar sesión"
            style={{ background:'rgba(255,255,255,0.12)', border:'1px solid rgba(255,255,255,0.25)', borderRadius:8, color:'#ffcccc', padding:'7px 9px', cursor:'pointer', fontSize:15 }}>
            🚪
          </button>
        </div>
      </div>

      {toast && <Toast {...toast} />}
      {modalPro && <PantallaPro feature={modalPro} onCerrar={() => setModalPro(null)} />}

      {/* CONTENIDO */}
      <div style={{ maxWidth:520, margin:'0 auto', padding:'20px 16px', minHeight:'calc(100vh - 60px)' }}>
        {cargando ? (
          <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'50vh' }}>
            <div style={{ textAlign:'center' }}><Spinner /><div style={{ marginTop:12, color:'#888' }}>Cargando...</div></div>
          </div>
        ) : error ? (
          <div style={{ background:T.rojoLight, color:T.rojo, borderRadius:12, padding:'16px', textAlign:'center' }}>
            ⚠️ {error}
            <div style={{ marginTop:10 }}><Btn color={T.rojo} onClick={cargarTodo}>Reintentar</Btn></div>
          </div>
        ) : (
          <>
            <PantallaMarcar colaboradores={colabsDisponibles.length > 0 ? colabsDisponibles : colaboradores} onRegistro={onAddRegistro} toast_={toast_} onProBloqueado={setModalPro} />

            {/* HISTORIAL DEL DÍA */}
            <div style={{ marginTop: 24 }}>
              <button onClick={() => setVerHistorialDia(!verHistorialDia)}
                style={{ width:'100%', background: verHistorialDia ? T.verdeLight : '#fff', border:`2px solid ${T.verde}33`, borderRadius:14, padding:'14px 18px', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', fontFamily:'inherit' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:20 }}>📋</span>
                  <div style={{ textAlign:'left' }}>
                    <div style={{ fontWeight:800, fontSize:15, color:T.verde }}>Mi registro de hoy</div>
                    <div style={{ fontSize:12, color:'#888' }}>{fmt(hoy())} · {registrosHoy.length} marcación{registrosHoy.length !== 1 ? 'es' : ''}</div>
                  </div>
                </div>
                <span style={{ fontSize:18, color:T.verde }}>{verHistorialDia ? '▲' : '▼'}</span>
              </button>

              {verHistorialDia && (
                <div style={{ background:'#fff', borderRadius:'0 0 14px 14px', border:`2px solid ${T.verde}33`, borderTop:'none', overflow:'hidden' }}>
                  {registrosHoy.length === 0 ? (
                    <div style={{ textAlign:'center', padding:24, color:'#aaa', fontSize:13 }}>
                      Sin marcaciones hoy
                    </div>
                  ) : (
                    <div>
                      {/* Selector de colaborador para filtrar */}
                      {colaboradores.length > 1 && (
                        <div style={{ padding:'12px 16px 0' }}>
                          <select onChange={e => {}} style={{ width:'100%', padding:'8px 12px', border:`1.5px solid ${T.verde}44`, borderRadius:8, fontSize:13, fontFamily:'inherit', background:'#f9f9f9' }}>
                            <option value="">Todos los colaboradores</option>
                            {(colabsDisponibles.length > 0 ? colabsDisponibles : colaboradores).map(c => (
                              <option key={c.id} value={c.id}>{c.nombre}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      {[...registrosHoy]
                        .sort((a,b) => (b.hora||'').localeCompare(a.hora||''))
                        .map(r => {
                          const colab = colaboradores.find(c => c.id === (r.colab_id || r.colabId))
                          const tm = r.tipo_marca || r.tipoMarca
                          const color = tm==='entrada' ? T.verde : tm==='salida' ? T.rojo : tm==='campo' ? T.morado : T.gold
                          const icon = tm==='entrada' ? '🟢' : tm==='salida' ? '🔴' : tm==='campo' ? '🚗' : '🍽️'
                          return (
                            <div key={r.id} style={{ display:'flex', gap:12, alignItems:'center', padding:'12px 16px', borderBottom:`1px solid #f5f5f5` }}>
                              {r.foto ? (
                                <img src={r.foto} alt="selfie" style={{ width:44, height:44, borderRadius:10, objectFit:'cover', border:`2px solid ${color}`, flexShrink:0 }} />
                              ) : (
                                <div style={{ width:44, height:44, borderRadius:10, background:color+'22', border:`2px solid ${color}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>{icon}</div>
                              )}
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ fontWeight:700, fontSize:14, color:T.negro, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{colab?.nombre || '—'}</div>
                                <div style={{ fontSize:12, color:'#888' }}>
                                  <span style={{ color, fontWeight:700 }}>{(tm||'').toUpperCase()}</span>
                                  {' · '}{r.hora}
                                  {(r.gps_lat||r.gpsLat) && <span style={{ color:T.morado }}> · 📍 GPS</span>}
                                  {' · '}<span style={{ fontSize:11, color:'#aaa' }}>{r.metodo}</span>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      <div style={{ padding:'10px 16px', textAlign:'center' }}>
                        <button onClick={cargarTodo} style={{ background:'transparent', border:'none', color:T.azul, cursor:'pointer', fontSize:13, fontWeight:700 }}>
                          🔄 Actualizar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
