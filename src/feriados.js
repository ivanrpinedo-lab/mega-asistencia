/**
 * feriados.js — Gestión de feriados para Mega Asistencia
 * Lista precargada de feriados peruanos 2025-2026
 * El admin puede editar, agregar o quitar desde Ajustes
 */

import { getConfig, setConfig } from './db.js'

// ─── FERIADOS PRECARGADOS PERÚ ────────────────────────────────────────────────
// Formato: { fecha: 'YYYY-MM-DD', nombre: string, tipo: 'nacional'|'publico'|'regional'|'personalizado' }

export const FERIADOS_PERU_2025 = [
  { fecha: '2025-01-01', nombre: 'Año Nuevo', tipo: 'nacional' },
  { fecha: '2025-04-17', nombre: 'Jueves Santo', tipo: 'nacional' },
  { fecha: '2025-04-18', nombre: 'Viernes Santo', tipo: 'nacional' },
  { fecha: '2025-04-19', nombre: 'Sábado Santo', tipo: 'nacional' },
  { fecha: '2025-05-01', nombre: 'Día del Trabajo', tipo: 'nacional' },
  { fecha: '2025-06-07', nombre: 'Batalla de Arica', tipo: 'publico' },
  { fecha: '2025-06-29', nombre: 'San Pedro y San Pablo', tipo: 'nacional' },
  { fecha: '2025-07-28', nombre: 'Fiestas Patrias', tipo: 'nacional' },
  { fecha: '2025-07-29', nombre: 'Fiestas Patrias', tipo: 'nacional' },
  { fecha: '2025-08-30', nombre: 'Santa Rosa de Lima', tipo: 'nacional' },
  { fecha: '2025-10-08', nombre: 'Combate de Angamos', tipo: 'nacional' },
  { fecha: '2025-10-09', nombre: 'Día de la Nación Peruana', tipo: 'publico' },
  { fecha: '2025-11-01', nombre: 'Todos los Santos', tipo: 'nacional' },
  { fecha: '2025-12-08', nombre: 'Inmaculada Concepción', tipo: 'nacional' },
  { fecha: '2025-12-09', nombre: 'Batalla de Ayacucho', tipo: 'nacional' },
  { fecha: '2025-12-25', nombre: 'Navidad', tipo: 'nacional' },
]

export const FERIADOS_PERU_2026 = [
  { fecha: '2026-01-01', nombre: 'Año Nuevo', tipo: 'nacional' },
  { fecha: '2026-04-02', nombre: 'Jueves Santo', tipo: 'nacional' },
  { fecha: '2026-04-03', nombre: 'Viernes Santo', tipo: 'nacional' },
  { fecha: '2026-04-04', nombre: 'Sábado Santo', tipo: 'nacional' },
  { fecha: '2026-05-01', nombre: 'Día del Trabajo', tipo: 'nacional' },
  { fecha: '2026-06-07', nombre: 'Batalla de Arica', tipo: 'publico' },
  { fecha: '2026-06-29', nombre: 'San Pedro y San Pablo', tipo: 'nacional' },
  { fecha: '2026-07-28', nombre: 'Fiestas Patrias', tipo: 'nacional' },
  { fecha: '2026-07-29', nombre: 'Fiestas Patrias', tipo: 'nacional' },
  { fecha: '2026-08-30', nombre: 'Santa Rosa de Lima', tipo: 'nacional' },
  { fecha: '2026-10-08', nombre: 'Combate de Angamos', tipo: 'nacional' },
  { fecha: '2026-10-09', nombre: 'Día de la Nación Peruana', tipo: 'publico' },
  { fecha: '2026-11-01', nombre: 'Todos los Santos', tipo: 'nacional' },
  { fecha: '2026-12-08', nombre: 'Inmaculada Concepción', tipo: 'nacional' },
  { fecha: '2026-12-09', nombre: 'Batalla de Ayacucho', tipo: 'nacional' },
  { fecha: '2026-12-25', nombre: 'Navidad', tipo: 'nacional' },
]

export const FERIADOS_DEFAULT = [...FERIADOS_PERU_2025, ...FERIADOS_PERU_2026]

// ─── TIPOS DE FERIADO ─────────────────────────────────────────────────────────
export const TIPO_FERIADO = {
  nacional:      { label: 'Nacional',        color: '#1B6B3A', bg: '#E8F5E9' },
  publico:       { label: 'Solo público',    color: '#0D47A1', bg: '#E3F2FD' },
  regional:      { label: 'Regional/Local',  color: '#E65100', bg: '#FFF3E0' },
  personalizado: { label: 'Personalizado',   color: '#4A148C', bg: '#F3E5F5' },
}

// ─── CONFIGURACIÓN DE FERIADOS ────────────────────────────────────────────────

// Cargar lista de feriados del tenant (mezcla default + personalizados)
export async function getFeriados() {
  try {
    const raw = await getConfig('feriados')
    if (raw) {
      const data = JSON.parse(raw)
      return Array.isArray(data) ? data : FERIADOS_DEFAULT
    }
  } catch {}
  return FERIADOS_DEFAULT
}

export async function saveFeriados(lista) {
  await setConfig('feriados', JSON.stringify(lista))
}

// Cargar config de si afectan cálculos
export async function getConfigFeriados() {
  try {
    const raw = await getConfig('feriados_config')
    if (raw) return JSON.parse(raw)
  } catch {}
  return {
    afecta_calculo: true,          // feriados no cuentan como faltas
    sector: 'privado',             // 'privado' | 'publico'
    incluir_tipo_publico: false,   // incluir feriados solo del sector público
  }
}

export async function saveConfigFeriados(config) {
  await setConfig('feriados_config', JSON.stringify(config))
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

// Verificar si una fecha es feriado según la configuración
export function esFeriado(fecha, feriados, config) {
  return feriados.some(f => {
    if (f.fecha !== fecha) return false
    // Si es sector privado y el feriado es solo para público, no aplica
    if (config?.sector === 'privado' && f.tipo === 'publico' && !config?.incluir_tipo_publico) return false
    return true
  })
}

// Obtener info del feriado
export function infoFeriado(fecha, feriados, config) {
  return feriados.find(f => {
    if (f.fecha !== fecha) return false
    if (config?.sector === 'privado' && f.tipo === 'publico' && !config?.incluir_tipo_publico) return false
    return true
  })
}

// Contar días hábiles del mes descontando feriados
export function diasHabilesConFeriados(mes, feriados, config) {
  const [y, m] = mes.split('-').map(Number)
  const diasMes = new Date(y, m, 0).getDate()
  let habiles = 0
  for (let d = 1; d <= diasMes; d++) {
    const fecha = `${mes}-${String(d).padStart(2, '0')}`
    const dow = new Date(fecha + 'T12:00:00').getDay()
    if (dow === 0) continue // domingo
    if (config?.afecta_calculo && esFeriado(fecha, feriados, config)) continue
    habiles++
  }
  return habiles
}

// Formatear fecha para mostrar
export function fmtFecha(fecha) {
  if (!fecha) return ''
  const [y, m, d] = fecha.split('-')
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  return `${parseInt(d)} ${meses[parseInt(m)-1]} ${y}`
}
