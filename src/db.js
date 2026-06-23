import { createClient } from '@supabase/supabase-js'

// ─── CONFIG ───────────────────────────────────────────────────────────────────
// Estas variables se configuran en Vercel → Settings → Environment Variables
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
const RENIEC_TOKEN = import.meta.env.VITE_RENIEC_TOKEN || ''

export const supabaseEnabled = !!(SUPABASE_URL && SUPABASE_KEY)
export const reniecEnabled = !!RENIEC_TOKEN

export const supabase = supabaseEnabled
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null

// Obtener tenant_id activo desde localStorage (sin import circular)
function getTenantIdActivo() {
  try {
    const t = JSON.parse(localStorage.getItem('mega_tenant') || 'null')
    return t?.tenant_id || null
  } catch { return null }
}

// ─── RENIEC ───────────────────────────────────────────────────────────────────
export async function consultarDNI(dni) {
  if (!/^\d{8}$/.test(dni)) throw new Error('DNI debe tener 8 dígitos')
  // Llama a la API route interna de Vercel (evita CORS)
  const res = await fetch(`/api/reniec?dni=${dni}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'No se encontró el DNI')
  return { nombre: data.nombre, dni: data.dni }
}

// ─── CAPA DE DATOS (Supabase o localStorage) ──────────────────────────────────
// Si Supabase está configurado → usa la nube (todos los dispositivos sincronizan)
// Si no → usa localStorage (solo el dispositivo actual)

const LS_KEY = 'mega_asist_v5'

function lsLoad() {
  try { const s = localStorage.getItem(LS_KEY); return s ? JSON.parse(s) : null } catch { return null }
}
function lsSave(data) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)) } catch {}
}

// ── Colaboradores ─────────────────────────────────────────────────────────────
export async function getColaboradores() {
  if (supabase) {
    const tid = getTenantIdActivo()
    // Sin tenant_id → datos en cero, no mostrar datos de otros
    if (!tid) return []
    const { data, error } = await supabase
      .from('colaboradores').select('*')
      .eq('tenant_id', tid)
      .order('nombre')
    if (error) throw error
    return data || []
  }
  return lsLoad()?.colaboradores || []
}

export async function upsertColaborador(colab) {
  if (supabase) {
    const tid = getTenantIdActivo()
    const data = {
      ...colab,
      pin: colab.pin ? String(colab.pin).trim() : null,
      tenant_id: colab.tenant_id || tid,
    }
    const { data: result, error } = await supabase
      .from('colaboradores').upsert(data).select().single()
    if (error) throw error
    return result
  }
  const d = lsLoad() || { colaboradores: [], registros: [] }
  const idx = d.colaboradores.findIndex(c => c.id === colab.id)
  if (idx >= 0) d.colaboradores[idx] = colab
  else d.colaboradores.push(colab)
  lsSave(d); return colab
}

// Función dedicada para actualizar SOLO el PIN de un colaborador
export async function updatePinColaborador(id, pin) {
  const pinStr = pin ? String(pin).trim() : null
  if (supabase) {
    const { error } = await supabase
      .from('colaboradores')
      .update({ pin: pinStr })
      .eq('id', id)
    if (error) throw error
    return
  }
  const d = lsLoad() || { colaboradores: [], registros: [] }
  const idx = d.colaboradores.findIndex(c => c.id === id)
  if (idx >= 0) { d.colaboradores[idx].pin = pinStr; lsSave(d) }
}

export async function deleteColaborador(id) {
  if (supabase) {
    const { error } = await supabase.from('colaboradores').delete().eq('id', id)
    if (error) throw error
    return
  }
  const d = lsLoad() || { colaboradores: [], registros: [] }
  d.colaboradores = d.colaboradores.filter(c => c.id !== id)
  d.registros = d.registros.filter(r => r.colab_id !== id)
  lsSave(d)
}

// ── Registros de asistencia ───────────────────────────────────────────────────
// Normaliza un registro de Supabase para que el frontend funcione
// con ambos nombres (snake_case y camelCase)
function normReg(r) {
  if (!r) return r
  return {
    ...r,
    // Aliases camelCase para compatibilidad con el frontend
    colabId:       r.colab_id,
    tipoMarca:     r.tipo_marca,
    gpsLat:        r.gps_lat,
    gpsLng:        r.gps_lng,
    gpsPrecision:  r.gps_precision,
    autorizadoPor: r.autorizado_por,
  }
}

export async function getRegistros(mes, colabId = null) {
  if (supabase) {
    const tid = getTenantIdActivo()
    if (!tid) return []
    const [y, m] = mes.split('-').map(Number)
    const ultimoDia = new Date(y, m, 0).getDate()
    const fechaFin = `${mes}-${String(ultimoDia).padStart(2, '0')}`
    let q = supabase.from('registros').select('*')
      .eq('tenant_id', tid)
      .gte('fecha', `${mes}-01`)
      .lte('fecha', fechaFin)
      .order('timestamp', { ascending: false })
    if (colabId) q = q.eq('colab_id', colabId)
    const { data, error } = await q
    if (error) throw error
    return (data || []).map(normReg)
  }
  const d = lsLoad() || { colaboradores: [], registros: [] }
  return d.registros.filter(r => {
    const mesOk = r.fecha?.startsWith(mes)
    const colabOk = !colabId || r.colab_id === colabId || r.colabId === colabId
    return mesOk && colabOk
  })
}

export async function getRegistrosHoy(fecha) {
  if (supabase) {
    const tid = getTenantIdActivo()
    if (!tid) return []
    const { data, error } = await supabase.from('registros').select('*')
      .eq('tenant_id', tid)
      .eq('fecha', fecha)
    if (error) throw error
    return (data || []).map(normReg)
  }
  const d = lsLoad() || { colaboradores: [], registros: [] }
  return d.registros.filter(r => r.fecha === fecha)
}

// Comprime un dataURL de imagen para no exceder límites de Supabase
function comprimirFoto(dataURL, maxWidth = 320, calidad = 0.5) {
  if (!dataURL) return null
  try {
    // Si ya es pequeña, no comprimir
    if (dataURL.length < 50000) return dataURL
    const canvas = document.createElement('canvas')
    const img = new Image()
    img.src = dataURL
    // Reducir tamaño
    const scale = Math.min(1, maxWidth / (img.width || 320))
    canvas.width = (img.width || 320) * scale
    canvas.height = (img.height || 240) * scale
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', calidad)
  } catch { return dataURL }
}

export async function insertRegistro(reg) {
  const r_local = { ...reg, colab_id: reg.colab_id || reg.colabId }

  const r_db = {
    id:             reg.id,
    colab_id:       reg.colab_id || reg.colabId,
    tipo:           reg.tipo,
    tipo_marca:     reg.tipo_marca || reg.tipoMarca,
    metodo:         reg.metodo,
    fecha:          reg.fecha,
    hora:           reg.hora,
    timestamp:      reg.timestamp || new Date().toISOString(),
    foto:           comprimirFoto(reg.foto),
    gps_lat:        reg.gps_lat || reg.gpsLat || null,
    gps_lng:        reg.gps_lng || reg.gpsLng || null,
    gps_precision:  reg.gps_precision || reg.gpsPrecision || null,
    monto:          reg.monto || null,
    motivo:         reg.motivo || null,
    autorizado_por: reg.autorizado_por || reg.autorizadoPor || null,
    observaciones:  reg.observaciones || null,
    tenant_id:      reg.tenant_id || getTenantIdActivo(),
  }
  Object.keys(r_db).forEach(k => { if (r_db[k] === undefined) r_db[k] = null })

  if (supabase) {
    const { data, error } = await supabase.from('registros').insert(r_db).select().single()
    if (error) throw error
    return data
  }
  const d = lsLoad() || { colaboradores: [], registros: [] }
  d.registros.push(r_local)
  lsSave(d); return r_local
}

export async function deleteRegistro(id) {
  if (supabase) {
    const { error } = await supabase.from('registros').delete().eq('id', id)
    if (error) throw error
    return
  }
  const d = lsLoad() || { colaboradores: [], registros: [] }
  d.registros = d.registros.filter(r => r.id !== id)
  lsSave(d)
}

// ─── SQL para crear las tablas en Supabase ────────────────────────────────────
// Pegar esto en Supabase → SQL Editor → Run
export const SUPABASE_SQL = `
-- Tabla colaboradores
create table if not exists colaboradores (
  id text primary key,
  nombre text not null,
  dni text,
  telefono text,
  cargo text,
  empresa text,
  salario numeric default 0,
  ingreso date,
  turno text default 'diurno',
  horario text default '08:00 - 17:00',
  horario_descanso text,
  tiene_descanso boolean default false,
  created_at timestamptz default now()
);

-- Tabla registros
create table if not exists registros (
  id text primary key,
  colab_id text references colaboradores(id) on delete cascade,
  tipo text,
  tipo_marca text,
  metodo text,
  fecha date,
  hora text,
  timestamp timestamptz default now(),
  foto text,
  gps_lat text,
  gps_lng text,
  gps_precision int,
  monto numeric,
  motivo text,
  autorizado_por text,
  observaciones text
);

-- Seguridad: acceso público (la app maneja autenticación por PIN)
alter table colaboradores enable row level security;
alter table registros enable row level security;
create policy "public_all_colaboradores" on colaboradores for all using (true) with check (true);
create policy "public_all_registros" on registros for all using (true) with check (true);
`

// ─── SQL ADICIONAL para agregar columna pin ───────────────────────────────────
// Ejecutar en Supabase SQL Editor si ya tienes la tabla creada:
// ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS pin text;

// ─── CONFIG (PIN GERENTE en Supabase) ─────────────────────────────────────────
// SQL para crear la tabla de configuración:
// create table if not exists config (key text primary key, value text);
// alter table config enable row level security;
// create policy "public_config" on config for all using (true) with check (true);

// ─── CONFIG (por tenant) ──────────────────────────────────────────────────────
// La key incluye el tenant_id para aislar configuraciones entre usuarios

export async function getConfig(key) {
  const tid = getTenantIdActivo()
  // Clave con tenant prefix para aislar entre usuarios
  const fullKey = tid ? `${tid}:${key}` : key
  if (supabase) {
    try {
      const { data } = await supabase.from('config')
        .select('value').eq('key', fullKey).single()
      return data?.value || null
    } catch { return null }
  }
  return localStorage.getItem(`cfg_${fullKey}`)
}

export async function setConfig(key, value) {
  const tid = getTenantIdActivo()
  const fullKey = tid ? `${tid}:${key}` : key
  if (supabase) {
    await supabase.from('config').upsert({ key: fullKey, value })
    return
  }
  localStorage.setItem(`cfg_${fullKey}`, value)
}

// ─── FOTO Y DESCRIPTOR FACIAL DEL COLABORADOR ────────────────────────────────
// face_descriptor: array de 128 números (Float32Array serializado)
// face_foto: dataURL de la foto de referencia

export async function updateFaceData(id, fotoRef, descriptor) {
  if (supabase) {
    const { error } = await supabase
      .from('colaboradores')
      .update({
        face_foto: fotoRef || null,
        face_descriptor: descriptor ? JSON.stringify(descriptor) : null,
      })
      .eq('id', id)
    if (error) throw error
    return
  }
  const d = lsLoad() || { colaboradores: [], registros: [] }
  const idx = d.colaboradores.findIndex(c => c.id === id)
  if (idx >= 0) {
    d.colaboradores[idx].face_foto = fotoRef
    d.colaboradores[idx].face_descriptor = descriptor
    lsSave(d)
  }
}

// ─── GESTIÓN DE EMPRESAS ──────────────────────────────────────────────────────
// Las empresas se guardan en config con key 'empresas' como JSON array

export async function getEmpresas() {
  try {
    const val = await getConfig('empresas')
    if (val) {
      const lista = JSON.parse(val)
      if (Array.isArray(lista) && lista.length > 0) return lista
    }
  } catch {}
  // Default si no hay nada configurado
  return null // null = sin configurar todavía
}

export async function saveEmpresas(lista) {
  await setConfig('empresas', JSON.stringify(lista))
}
