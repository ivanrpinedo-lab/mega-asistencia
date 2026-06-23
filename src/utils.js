// ─── TOKENS ──────────────────────────────────────────────────────────────────
export const T = {
  verde: '#1B6B3A', verdeMid: '#2E7D52', verdeLight: '#E8F5E9',
  gold: '#E65100', goldLight: '#FFF3E0',
  azul: '#0D47A1', azulLight: '#E3F2FD',
  rojo: '#B71C1C', rojoLight: '#FFEBEE',
  morado: '#4A148C', moradoLight: '#F3E5F5',
  gris: '#37474F', grisLight: '#F5F7F8', grisMid: '#B0BEC5',
  blanco: '#FFFFFF', negro: '#1A1A1A', bg: '#EEF2F5',
  naranja: '#BF360C', naranjaLight: '#FBE9E7',
}

// EMPRESAS — se carga dinámicamente desde Supabase/config
// El valor por defecto se usa solo si aún no hay empresas configuradas
export const EMPRESAS_DEFAULT = ['Mi Empresa']
export let EMPRESAS = [...EMPRESAS_DEFAULT]

// Actualizar EMPRESAS globalmente cuando se cargan desde Supabase
export function setEmpresasGlobal(lista) {
  EMPRESAS.length = 0
  lista.forEach(e => EMPRESAS.push(e))
}

// ─── STORAGE ─────────────────────────────────────────────────────────────────
const KEY = 'mega_asist_v5'
export const loadData = () => {
  try { const s = localStorage.getItem(KEY); if (s) return JSON.parse(s) } catch {}
  return { colaboradores: [], registros: [], ubicaciones: [] }
}
export const saveData = (data) => {
  try { localStorage.setItem(KEY, JSON.stringify(data)) } catch {}
}

let _id = Date.now()
export const uid = () => String(++_id)

// ─── FECHA / HORA ────────────────────────────────────────────────────────────
export const hoy = () => new Date().toISOString().slice(0, 10)
export const ahora = () => new Date().toTimeString().slice(0, 5)
export const fmt = d => {
  if (!d) return '—'
  const [y, m, dd] = d.split('-')
  return `${dd}/${m}/${y}`
}
export const fmtTs = iso => {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// ─── QR CODE ÚNICO ───────────────────────────────────────────────────────────
export const genCode = (id, nombre) => {
  const base = (nombre || '').toUpperCase().replace(/\s+/g, '').slice(0, 3)
  const num = Math.abs(id.split('').reduce((h, c, i) => ((h << 5) - h) + c.charCodeAt(0) * (i + 7), 0)) % 9000 + 1000
  return `${base}-${num}`
}

// ─── DIFF HORAS ──────────────────────────────────────────────────────────────
export const diffH = (a, b) => {
  if (!a || !b) return 0
  const [ah, am] = a.split(':').map(Number)
  const [bh, bm] = b.split(':').map(Number)
  return Math.max(0, (bh * 60 + bm - ah * 60 - am) / 60)
}
