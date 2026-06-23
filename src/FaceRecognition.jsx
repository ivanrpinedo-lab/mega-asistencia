/**
 * FaceRecognition.jsx — Reconocimiento facial con face-api.js
 * Corre 100% en el dispositivo, sin servidor externo
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import * as faceapi from 'face-api.js'
import { T } from './utils.js'
import { Spinner } from './components.jsx'

const MODELS_URL = '/models'
const UMBRAL_SIMILITUD = 0.50

// ─── CARGA DE MODELOS (singleton) ─────────────────────────────────────────────
let modelsLoaded = false
let modelsLoading = false
const modelsCallbacks = []

export async function loadFaceModels() {
  if (modelsLoaded) return true
  if (modelsLoading) return new Promise(res => modelsCallbacks.push(res))
  modelsLoading = true
  try {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL),
    ])
    modelsLoaded = true
    modelsLoading = false
    modelsCallbacks.forEach(cb => cb(true))
    modelsCallbacks.length = 0
    return true
  } catch (e) {
    modelsLoading = false
    modelsCallbacks.forEach(cb => cb(false))
    modelsCallbacks.length = 0
    throw new Error('No se pudieron cargar los modelos: ' + e.message)
  }
}

// ─── EXTRAER DESCRIPTOR ───────────────────────────────────────────────────────
export async function extraerDescriptor(fuente) {
  await loadFaceModels()
  try {
    const det = await faceapi
      .detectSingleFace(fuente, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptor()
    if (!det) return null
    return Array.from(det.descriptor)
  } catch { return null }
}

// ─── COMPARAR DESCRIPTORES ────────────────────────────────────────────────────
export function compararDescriptores(desc1, desc2) {
  if (!desc1 || !desc2) return { match: false, distancia: 999, similitud: 0 }
  const d1 = new Float32Array(desc1)
  const d2 = new Float32Array(desc2)
  const distancia = faceapi.euclideanDistance(d1, d2)
  const similitud = Math.round(Math.max(0, (1 - distancia) * 100))
  return { match: distancia < UMBRAL_SIMILITUD, distancia: Math.round(distancia * 100) / 100, similitud }
}

// ─── HOOK: CÁMARA ─────────────────────────────────────────────────────────────
export function useFaceCapture() {
  const videoEl = useRef(null)
  const streamRef = useRef(null)
  const [listo, setListo] = useState(false)
  const [error, setError] = useState(null)

  // Callback ref — detecta cuando <video> aparece en el DOM
  const videoRef = useCallback(node => {
    videoEl.current = node
    if (node && streamRef.current) {
      node.srcObject = streamRef.current
      node.onloadedmetadata = () => { node.play().catch(() => {}); setListo(true) }
      if (node.readyState >= 1) { node.play().catch(() => {}); setListo(true) }
    }
  }, [])

  const iniciarCamara = useCallback(async (facingMode = 'user') => {
    setError(null)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
      streamRef.current = stream
      const el = videoEl.current
      if (el) {
        el.srcObject = stream
        el.onloadedmetadata = () => { el.play().catch(() => {}); setListo(true) }
        if (el.readyState >= 1) { el.play().catch(() => {}); setListo(true) }
      }
      // Si el video no está aún, el videoRef callback lo manejará cuando aparezca
    } catch (e) {
      setError('Cámara no disponible: ' + e.message)
    }
  }, [])

  const detenerCamara = useCallback(() => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
    if (videoEl.current) videoEl.current.srcObject = null
    setListo(false)
  }, [])

  const capturar = useCallback(async (watermarkText = '') => {
    const el = videoEl.current
    if (!el) throw new Error('Cámara no lista')
    const canvas = document.createElement('canvas')
    canvas.width = el.videoWidth || 640
    canvas.height = el.videoHeight || 480
    const ctx = canvas.getContext('2d')
    ctx.drawImage(el, 0, 0)
    const descriptor = await extraerDescriptor(el)
    if (watermarkText) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      ctx.fillRect(0, canvas.height - 44, canvas.width, 44)
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 12px monospace'
      ctx.fillText(watermarkText, 8, canvas.height - 26)
      ctx.font = '10px monospace'
      ctx.fillText(descriptor ? '✅ Rostro verificado' : '⚠️ Sin verificación', 8, canvas.height - 8)
    }
    return { foto: canvas.toDataURL('image/jpeg', 0.75), descriptor }
  }, [])

  useEffect(() => () => detenerCamara(), [])

  return { videoRef, listo, error, iniciarCamara, detenerCamara, capturar }
}

// ─── COMPONENTE: REGISTRO DE FOTO DE REFERENCIA ───────────────────────────────
export function RegistroFotoReferencia({ nombreColab, onGuardar, onCancelar }) {
  const { videoRef, listo, error, iniciarCamara, detenerCamara, capturar } = useFaceCapture()
  const [estado, setEstado] = useState('inicio')
  const [resultado, setResultado] = useState(null)
  const [modelosCargando, setModelosCargando] = useState(true)

  useEffect(() => {
    loadFaceModels().then(() => setModelosCargando(false)).catch(() => setModelosCargando(false))
  }, [])

  const iniciar = async () => {
    setEstado('camara')
    await new Promise(res => setTimeout(res, 100))
    await iniciarCamara('user')
  }

  const tomar = async () => {
    setEstado('procesando')
    try {
      const { foto, descriptor } = await capturar(`Referencia: ${nombreColab}`)
      if (!descriptor) { setEstado('sin_rostro'); return }
      setResultado({ foto, descriptor })
      setEstado('ok')
      detenerCamara()
    } catch { setEstado('error') }
  }

  return (
    <div style={{ textAlign: 'center' }}>
      {modelosCargando && <div style={{ padding: 20 }}><Spinner /><div style={{ marginTop: 12, fontSize: 13, color: '#888' }}>Cargando modelos...</div></div>}

      {!modelosCargando && estado === 'inicio' && (
        <div>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🤳</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Foto de referencia</div>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>Toma una foto con buena luz y el rostro centrado. Se usará para verificar identidad.</div>
          <button onClick={iniciar} style={{ background: T.verde, color: '#fff', border: 'none', borderRadius: 12, padding: '14px 28px', fontWeight: 800, fontSize: 16, cursor: 'pointer', width: '100%' }}>📸 Abrir cámara</button>
          <div style={{ marginTop: 10 }}><button onClick={onCancelar} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: 13 }}>Omitir por ahora</button></div>
        </div>
      )}

      {estado === 'camara' && (
        <div>
          <div style={{ position: 'relative', marginBottom: 14 }}>
            <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', borderRadius: 14, background: '#111', display: 'block', minHeight: 200 }} />
            <div style={{ position: 'absolute', top: '10%', left: '25%', width: '50%', height: '70%', border: '3px solid #FFD54F', borderRadius: '50%', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, textAlign: 'center', color: '#FFD54F', fontSize: 12, fontWeight: 700, textShadow: '0 1px 4px #000' }}>Centra el rostro en el óvalo</div>
          </div>
          {error && <div style={{ background: '#FFEBEE', color: '#B71C1C', borderRadius: 9, padding: '10px', fontSize: 13, marginBottom: 12 }}>{error}</div>}
          <button onClick={tomar} style={{ background: T.verde, color: '#fff', border: 'none', borderRadius: 12, padding: '16px', fontWeight: 800, fontSize: 18, cursor: 'pointer', width: '100%' }}>📸 Tomar foto de referencia</button>
        </div>
      )}

      {estado === 'procesando' && <div style={{ padding: 32 }}><Spinner /><div style={{ marginTop: 16, fontSize: 14, color: '#888' }}>Analizando rostro...</div></div>}

      {estado === 'sin_rostro' && (
        <div>
          <div style={{ fontSize: 48, marginBottom: 12 }}>😶</div>
          <div style={{ fontWeight: 700, color: T.rojo, marginBottom: 8 }}>No se detectó rostro</div>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>Asegúrate de que el rostro esté centrado con buena luz.</div>
          <button onClick={iniciar} style={{ background: T.gold, color: '#fff', border: 'none', borderRadius: 12, padding: '14px', fontWeight: 800, fontSize: 16, cursor: 'pointer', width: '100%' }}>🔄 Intentar de nuevo</button>
        </div>
      )}

      {estado === 'ok' && resultado && (
        <div>
          <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
          <div style={{ fontWeight: 700, color: T.verde, marginBottom: 14 }}>Rostro registrado correctamente</div>
          <img src={resultado.foto} alt="referencia" style={{ width: '100%', maxWidth: 240, borderRadius: 12, border: `3px solid ${T.verde}`, marginBottom: 16, display: 'block', margin: '0 auto 16px' }} />
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={iniciar} style={{ flex: 1, background: '#F0F4F8', border: 'none', borderRadius: 10, padding: '12px', fontWeight: 700, cursor: 'pointer', fontSize: 14, color: '#666' }}>🔄 Repetir</button>
            <button onClick={() => onGuardar(resultado.foto, resultado.descriptor)} style={{ flex: 2, background: T.verde, color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>✅ Confirmar y guardar</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── COMPONENTE: VERIFICACIÓN FACIAL AL MARCAR ASISTENCIA ─────────────────────
export function VerificacionFacial({ colaborador, onVerificado, onSinFoto, onRechazado }) {
  const { videoRef, listo, error: camError, iniciarCamara, detenerCamara, capturar } = useFaceCapture()
  const [estado, setEstado] = useState('cargando')
  const [resultado, setResultado] = useState(null)
  const [intentos, setIntentos] = useState(0)
  const [msgError, setMsgError] = useState('')

  useEffect(() => {
    const init = async () => {
      try {
        await loadFaceModels()
        if (!colaborador?.face_descriptor || colaborador.face_descriptor === 'null') {
          setEstado('sin_referencia'); return
        }
        // Mostrar UI con el video primero, luego iniciar cámara
        setEstado('listo')
        await new Promise(res => setTimeout(res, 100))
        await iniciarCamara('user')
      } catch { setEstado('error_modelos') }
    }
    init()
    return () => detenerCamara()
  }, [])

  const reintentar = async () => {
    setMsgError(''); setResultado(null)
    setEstado('reiniciando')
    detenerCamara()
    await new Promise(res => setTimeout(res, 400))
    setEstado('listo')
    await new Promise(res => setTimeout(res, 100))
    try { await iniciarCamara('user') }
    catch (e) { setMsgError('No se pudo abrir la cámara: ' + e.message); setEstado('error_cam') }
  }

  const verificar = async () => {
    setEstado('verificando')
    try {
      const { foto, descriptor } = await capturar(
        `${colaborador.nombre} · ${new Date().toLocaleTimeString('es-PE')} ${new Date().toLocaleDateString('es-PE')}`
      )
      if (!descriptor) {
        setIntentos(i => i + 1)
        setMsgError('No se detectó rostro. Centra tu cara en el óvalo con buena iluminación.')
        setEstado('error_intento')
        await new Promise(res => setTimeout(res, 300))
        await iniciarCamara('user')
        setEstado('listo')
        return
      }
      const comparacion = compararDescriptores(
        descriptor,
        typeof colaborador.face_descriptor === 'string' ? JSON.parse(colaborador.face_descriptor) : colaborador.face_descriptor
      )
      setResultado({ foto, descriptor, ...comparacion })
      if (comparacion.match) { detenerCamara(); setEstado('ok') }
      else {
        const nuevosIntentos = intentos + 1
        setIntentos(nuevosIntentos)
        setMsgError(`Rostro no coincide (${comparacion.similitud}% similitud). ${nuevosIntentos >= 3 ? 'Máximo de intentos alcanzado.' : 'Intenta de nuevo.'}`)
        if (nuevosIntentos < 3) {
          setEstado('error_intento')
          await new Promise(res => setTimeout(res, 300))
          await iniciarCamara('user')
          setEstado('listo')
        } else { setEstado('rechazado') }
      }
    } catch (e) {
      setMsgError('Error: ' + e.message)
      setEstado('error_intento')
      await new Promise(res => setTimeout(res, 300))
      await iniciarCamara('user')
      setEstado('listo')
    }
  }

  return (
    <div style={{ textAlign: 'center' }}>
      {(estado === 'cargando' || estado === 'reiniciando') && (
        <div style={{ padding: 32 }}>
          <Spinner />
          <div style={{ marginTop: 12, fontSize: 13, color: '#888' }}>{estado === 'reiniciando' ? 'Reiniciando cámara...' : 'Cargando reconocimiento facial...'}</div>
        </div>
      )}

      {estado === 'sin_referencia' && (
        <div style={{ padding: 20 }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontWeight: 700, color: T.gold, marginBottom: 8 }}>Sin foto de referencia</div>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>{colaborador.nombre} no tiene foto registrada. El gerente debe registrarla desde Panel → Equipo → 📸 Registrar</div>
          <button onClick={onSinFoto} style={{ background: T.gold, color: '#fff', border: 'none', borderRadius: 12, padding: '14px', fontWeight: 800, fontSize: 15, cursor: 'pointer', width: '100%' }}>Continuar sin verificación</button>
        </div>
      )}

      {(estado === 'listo' || estado === 'error_intento') && (
        <div>
          {msgError && <div style={{ background: '#FFF8E1', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: T.gold, fontWeight: 600 }}>⚠️ {msgError}</div>}
          {intentos > 0 && <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>Intento {intentos} de 3</div>}
          <div style={{ position: 'relative', marginBottom: 14 }}>
            <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', borderRadius: 14, background: '#111', display: 'block', maxHeight: 320, minHeight: 200 }} />
            <div style={{ position: 'absolute', top: '8%', left: '22%', width: '56%', height: '72%', border: `3px solid ${intentos > 0 ? T.gold : '#FFD54F'}`, borderRadius: '50%', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, textAlign: 'center', color: '#FFD54F', fontSize: 12, fontWeight: 700, textShadow: '0 1px 4px #000' }}>{colaborador.nombre} — centra tu rostro</div>
          </div>
          {camError && <div style={{ background: '#FFEBEE', color: '#B71C1C', borderRadius: 9, padding: '10px', fontSize: 13, marginBottom: 12 }}>{camError}</div>}
          {!listo && !camError && <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>Iniciando cámara...</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button onClick={verificar} style={{ background: T.verde, color: '#fff', border: 'none', borderRadius: 14, padding: '18px', fontWeight: 900, fontSize: 18, cursor: 'pointer' }}>
              🔍 {intentos > 0 ? 'Reintentar verificación' : 'Verificar identidad'}
            </button>
            <button onClick={onSinFoto} style={{ background: 'transparent', border: '1px solid #ccc', borderRadius: 10, padding: '10px', fontWeight: 600, fontSize: 13, cursor: 'pointer', color: '#888' }}>Continuar sin verificar</button>
          </div>
        </div>
      )}

      {estado === 'verificando' && <div style={{ padding: 24 }}><Spinner /><div style={{ marginTop: 14, fontSize: 14, color: '#888' }}>Comparando rostro...</div></div>}

      {estado === 'rechazado' && (
        <div style={{ padding: 20 }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>❌</div>
          <div style={{ fontWeight: 800, color: T.rojo, marginBottom: 8 }}>Identidad no verificada</div>
          <div style={{ background: '#FFEBEE', borderRadius: 10, padding: '12px', fontSize: 13, color: T.rojo, marginBottom: 20 }}>{msgError}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button onClick={reintentar} style={{ background: T.gold, color: '#fff', border: 'none', borderRadius: 12, padding: '14px', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>🔄 Volver a intentar</button>
            {onRechazado && <button onClick={onRechazado} style={{ background: T.rojo, color: '#fff', border: 'none', borderRadius: 12, padding: '14px', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>🚨 Llamar al encargado</button>}
            <button onClick={onSinFoto} style={{ background: 'transparent', border: '1px solid #ccc', borderRadius: 10, padding: '10px', fontWeight: 600, fontSize: 13, cursor: 'pointer', color: '#888' }}>Continuar sin verificar</button>
          </div>
        </div>
      )}

      {(estado === 'error_modelos' || estado === 'error_cam') && (
        <div style={{ padding: 20 }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontWeight: 700, color: T.rojo, marginBottom: 8 }}>{estado === 'error_modelos' ? 'Error cargando reconocimiento facial' : 'Error de cámara'}</div>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>{msgError || 'Verifica que la cámara esté disponible y que hayas dado permisos.'}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button onClick={reintentar} style={{ background: T.verde, color: '#fff', border: 'none', borderRadius: 12, padding: '14px', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>🔄 Reintentar</button>
            <button onClick={onSinFoto} style={{ background: T.gold, color: '#fff', border: 'none', borderRadius: 12, padding: '14px', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>Continuar sin verificación</button>
          </div>
        </div>
      )}

      {estado === 'ok' && resultado && (
        <div>
          <div style={{ fontSize: 60, marginBottom: 8 }}>✅</div>
          <div style={{ fontWeight: 900, fontSize: 20, color: T.verde, marginBottom: 4 }}>Identidad confirmada</div>
          <div style={{ fontSize: 14, color: '#888', marginBottom: 16 }}>{colaborador.nombre}</div>
          <div style={{ background: T.verdeLight, borderRadius: 12, padding: '12px 20px', marginBottom: 16, display: 'inline-block' }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: T.verde }}>{resultado.similitud}% similitud</div>
            <div style={{ fontSize: 12, color: '#888' }}>Umbral mínimo: {Math.round((1 - UMBRAL_SIMILITUD) * 100)}%</div>
          </div>
          {resultado.foto && <img src={resultado.foto} alt="verificacion" style={{ width: '100%', maxWidth: 240, borderRadius: 12, border: `3px solid ${T.verde}`, display: 'block', margin: '0 auto 16px' }} />}
          <button onClick={() => onVerificado(resultado.foto, resultado.descriptor)} style={{ background: T.verde, color: '#fff', border: 'none', borderRadius: 14, padding: '18px', fontWeight: 900, fontSize: 18, cursor: 'pointer', width: '100%' }}>
            ✅ Confirmar asistencia
          </button>
        </div>
      )}
    </div>
  )
}
