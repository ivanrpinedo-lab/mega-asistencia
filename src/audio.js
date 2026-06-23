/**
 * audio.js — Sonidos y voz para Mega Asistencia
 * Usa Web Audio API (sin archivos externos) + SpeechSynthesis para voz
 */

const AUDIO_KEY = 'mega_audio_enabled'

export function isAudioEnabled() {
  return localStorage.getItem(AUDIO_KEY) !== 'false'
}
export function setAudioEnabled(val) {
  localStorage.setItem(AUDIO_KEY, val ? 'true' : 'false')
}

// Precargar voces al iniciar la app — llamar en App.jsx al montar
export function precargarVoces() {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.getVoices()
}

// ─── TONO POSITIVO (entrada confirmada) ──────────────────────────────────────
export function tonoExito() {
  if (!isAudioEnabled()) return
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const notas = [523, 659, 784] // Do, Mi, Sol — acorde mayor
    notas.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = freq
      const t = ctx.currentTime + i * 0.12
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.3, t + 0.05)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4)
      osc.start(t)
      osc.stop(t + 0.4)
    })
  } catch {}
}

// ─── TONO NEGATIVO (error / rechazo) ─────────────────────────────────────────
export function tonoError() {
  if (!isAudioEnabled()) return
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const notas = [300, 250] // tonos descendentes
    notas.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sawtooth'
      osc.frequency.value = freq
      const t = ctx.currentTime + i * 0.2
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.25, t + 0.05)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
      osc.start(t)
      osc.stop(t + 0.35)
    })
  } catch {}
}

// ─── VOZ (Text-to-Speech en español) ─────────────────────────────────────────
function getVozEspanol() {
  const voces = window.speechSynthesis.getVoices()
  return (
    voces.find(v => v.lang === 'es-PE') ||
    voces.find(v => v.lang === 'es-MX') ||
    voces.find(v => v.lang === 'es-ES') ||
    voces.find(v => v.lang.startsWith('es')) ||
    voces[0] ||
    null
  )
}

export function hablar(texto) {
  if (!isAudioEnabled()) return
  if (!('speechSynthesis' in window)) return
  try {
    window.speechSynthesis.cancel()
    const decir = () => {
      const msg = new SpeechSynthesisUtterance(texto)
      msg.lang = 'es-PE'
      msg.rate = 0.95
      msg.pitch = 1.05
      msg.volume = 1.0
      const voz = getVozEspanol()
      if (voz) msg.voice = voz
      window.speechSynthesis.speak(msg)
    }
    // Si las voces ya están cargadas, hablar de inmediato
    if (window.speechSynthesis.getVoices().length > 0) {
      decir()
    } else {
      // Esperar a que carguen las voces (primera vez)
      window.speechSynthesis.addEventListener('voiceschanged', decir, { once: true })
    }
  } catch (e) {
    console.warn('TTS error:', e)
  }
}

// ─── COMBINADOS ───────────────────────────────────────────────────────────────
export function confirmarEntrada(nombre) {
  tonoExito()
  hablar(`Bienvenido ${nombre.split(' ')[0]}`)
}

export function confirmarSalida(nombre) {
  tonoExito()
  hablar(`Hasta luego ${nombre.split(' ')[0]}`)
}

export function confirmarCampo(nombre) {
  tonoExito()
  hablar(`${nombre.split(' ')[0]}, salida a campo registrada`)
}

export function confirmarDescanso(nombre) {
  tonoExito()
  hablar(`${nombre.split(' ')[0]}, descanso registrado`)
}

export function rechazarIdentidad() {
  tonoError()
  hablar('Identidad no verificada. Intenta de nuevo.')
}

export function errorGeneral(msg = '') {
  tonoError()
  if (msg) hablar(msg)
}

export function confirmarMarca(tipoMarca, nombre) {
  switch (tipoMarca) {
    case 'entrada':   confirmarEntrada(nombre);  break
    case 'salida':    confirmarSalida(nombre);   break
    case 'campo':     confirmarCampo(nombre);    break
    case 'descanso':  confirmarDescanso(nombre); break
    default:          tonoExito();               break
  }
}
