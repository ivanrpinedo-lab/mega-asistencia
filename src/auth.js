/**
 * auth.js — Autenticación multi-tenant
 * Supabase Auth: email/contraseña + Google OAuth
 */

import { supabase } from './db.js'

// ─── CLAVES DE ALMACENAMIENTO LOCAL ──────────────────────────────────────────
const TENANT_KEY   = 'mega_tenant'    // datos del tenant activo
const DEVICE_KEY   = 'mega_device'    // datos del dispositivo vinculado
const SESSION_KEY  = 'mega_auth_session'

// ─── PLANES ───────────────────────────────────────────────────────────────────
export const PLANES = {
  free: {
    nombre: 'Free',
    max_colabs: 5,
    max_devices: 2,
    gps: false,
    facial: false,
    exportar: false,
    precio: 'S/ 0',
  },
  pro: {
    nombre: 'Pro',
    max_colabs: Infinity,
    max_devices: Infinity,
    gps: true,
    facial: true,
    exportar: true,
    precio: 'S/ 49/mes',
  },
}

// ─── TENANT EN MEMORIA ────────────────────────────────────────────────────────
let _tenant = null
let _device = null

export function getTenant() {
  if (_tenant) return _tenant
  try { _tenant = JSON.parse(localStorage.getItem(TENANT_KEY) || 'null') } catch {}
  return _tenant
}

export function getDevice() {
  if (_device) return _device
  try { _device = JSON.parse(localStorage.getItem(DEVICE_KEY) || 'null') } catch {}
  return _device
}

export function getTenantId() {
  return getTenant()?.tenant_id || null
}

export function getPlan() {
  const plan = getTenant()?.plan || 'free'
  return PLANES[plan] || PLANES.free
}

export function puedeUsarGPS()    { return getPlan().gps }
export function puedeUsarFacial() { return getPlan().facial }

function saveTenant(data) {
  _tenant = data
  localStorage.setItem(TENANT_KEY, JSON.stringify(data))
}

function saveDevice(data) {
  _device = data
  localStorage.setItem(DEVICE_KEY, JSON.stringify(data))
}

export function clearSession() {
  _tenant = null
  _device = null
  localStorage.removeItem(TENANT_KEY)
  localStorage.removeItem(DEVICE_KEY)
  localStorage.removeItem(SESSION_KEY)
  localStorage.removeItem('mega_empresa_fija') // limpiar empresa seleccionada
  // Limpiar cache de PIN por tenant (todos los posibles)
  Object.keys(localStorage).filter(k => k.startsWith('mega_gerente_pin')).forEach(k => {
    localStorage.removeItem(k)
  })
}

// ─── REGISTRO DE NUEVO ADMIN ──────────────────────────────────────────────────
export async function registrarAdmin({ email, password, nombreOrg }) {
  if (!supabase) throw new Error('Supabase no configurado')

  // 1. Crear usuario en Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nombre_org: nombreOrg } }
  })
  if (authError) throw new Error(authError.message)

  // 2. Crear tenant en la base de datos
  const { data: tenantData, error: tenantError } = await supabase
    .rpc('crear_tenant', { p_email: email, p_nombre_org: nombreOrg })
  if (tenantError) throw new Error(tenantError.message)

  saveTenant({
    tenant_id: tenantData,
    email,
    nombre_org: nombreOrg,
    plan: 'free',
    max_colabs: 5,
    max_devices: 2,
    es_admin: true,
  })

  return tenantData
}

// ─── LOGIN CON EMAIL + CONTRASEÑA ─────────────────────────────────────────────
export async function loginAdmin({ email, password }) {
  if (!supabase) throw new Error('Supabase no configurado')

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)

  // Cargar datos del tenant
  const { data: tenant, error: tError } = await supabase
    .from('tenants')
    .select('*')
    .eq('email', email)
    .single()
  if (tError || !tenant) throw new Error('No se encontró la organización para este email')

  saveTenant({
    tenant_id: tenant.id,
    email: tenant.email,
    nombre_org: tenant.nombre_org,
    plan: tenant.plan,
    max_colabs: tenant.max_colabs,
    max_devices: tenant.max_devices,
    es_admin: true,
  })

  return tenant
}

// ─── LOGIN CON GOOGLE ─────────────────────────────────────────────────────────
export async function loginGoogle() {
  if (!supabase) throw new Error('Supabase no configurado')

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
      queryParams: { prompt: 'select_account' },
    }
  })
  if (error) throw new Error(error.message)
}

// ─── MANEJAR CALLBACK DE GOOGLE ───────────────────────────────────────────────
export async function handleGoogleCallback(nombreOrg = '') {
  if (!supabase) return null

  // Supabase detecta automáticamente el token del hash de la URL
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error || !session) {
    // Intentar intercambiar el código de autorización si hay 'code' en la URL
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (code) {
      const { data, error: exchError } = await supabase.auth.exchangeCodeForSession(code)
      if (exchError || !data.session) return null
    } else {
      return null
    }
  }

  // Obtener sesión actualizada
  const { data: { session: sesActual } } = await supabase.auth.getSession()
  if (!sesActual) return null

  const email = sesActual.user.email
  const displayName = sesActual.user.user_metadata?.full_name || ''

  // Buscar o crear tenant
  let { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('email', email)
    .single()

  if (!tenant) {
    const org = nombreOrg || displayName || email.split('@')[0]
    await supabase.rpc('crear_tenant', { p_email: email, p_nombre_org: org })
    const { data: newTenant } = await supabase.from('tenants').select('*').eq('email', email).single()
    tenant = newTenant
  }

  if (!tenant) throw new Error('No se pudo crear la organización')

  saveTenant({
    tenant_id: tenant.id,
    email: tenant.email,
    nombre_org: tenant.nombre_org,
    plan: tenant.plan,
    max_colabs: tenant.max_colabs,
    max_devices: tenant.max_devices,
    es_admin: true,
  })

  return tenant
}

// ─── LOGOUT ADMIN ─────────────────────────────────────────────────────────────
export async function logoutAdmin() {
  if (supabase) await supabase.auth.signOut()
  clearSession()
}

// ─── GESTIÓN DE DISPOSITIVOS ──────────────────────────────────────────────────

// Admin genera un código para vincular un celular
export async function generarCodigoDevice(nombre = 'Celular') {
  const tenantId = getTenantId()
  if (!tenantId || !supabase) throw new Error('No autenticado')

  // Verificar límite de dispositivos
  const { count } = await supabase
    .from('devices')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)

  const plan = getPlan()
  if (count >= plan.max_devices) {
    throw new Error(`Plan ${plan.nombre} permite máximo ${plan.max_devices} dispositivos. Actualiza a Pro para ilimitados.`)
  }

  const { data, error } = await supabase.rpc('generar_codigo_device', {
    p_tenant_id: tenantId,
    p_nombre: nombre,
  })
  if (error) throw new Error(error.message)
  return data
}

// Celular de trabajo se vincula con un código
export async function vincularDispositivo(codigo) {
  if (!supabase) throw new Error('Supabase no configurado')

  const { data, error } = await supabase.rpc('validar_codigo_device', {
    p_codigo: codigo.toUpperCase().trim()
  })
  if (error) throw new Error(error.message)
  if (data.error) throw new Error(data.error)

  saveDevice(data)
  saveTenant({
    tenant_id: data.tenant_id,
    nombre_org: data.nombre_org,
    plan: data.plan,
    max_colabs: data.max_colabs,
    max_devices: data.max_devices,
    es_admin: false,
  })

  return data
}

// Listar dispositivos del tenant
export async function getDevices() {
  const tenantId = getTenantId()
  if (!tenantId || !supabase) return []

  const { data } = await supabase
    .from('devices')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('vinculado_at', { ascending: false })

  return data || []
}

// Eliminar un dispositivo
export async function deleteDevice(id) {
  if (!supabase) return
  await supabase.from('devices').delete().eq('id', id)
}

// ─── VERIFICAR SESIÓN AL ABRIR LA APP ────────────────────────────────────────
export async function verificarSesion() {
  // Si hay dispositivo vinculado → es celular de trabajo, OK
  const device = getDevice()
  const tenant = getTenant()
  if (device && tenant) return { tipo: 'device', tenant, device }

  // Si hay sesión de admin activa
  if (supabase) {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      const t = getTenant()
      if (t?.es_admin) return { tipo: 'admin', tenant: t }
      // Sesión de auth pero sin tenant en localStorage → recargar
      try {
        const result = await handleGoogleCallback()
        if (result) return { tipo: 'admin', tenant: getTenant() }
      } catch {}
    }
  }

  return null // No autenticado → mostrar pantalla de login/vinculación
}

// ─── CAMBIAR CONTRASEÑA DEL USUARIO ACTUAL ────────────────────────────────────
export async function cambiarPassword(nuevaPassword) {
  if (!supabase) throw new Error('Supabase no configurado')
  if (!nuevaPassword || nuevaPassword.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres')
  const { error } = await supabase.auth.updateUser({ password: nuevaPassword })
  if (error) throw new Error(error.message)
}

// ─── SUPERADMIN: OBTENER TODOS LOS TENANTS ────────────────────────────────────
export async function getTodosLosTenants() {
  if (!supabase) throw new Error('Supabase no configurado')
  const { data, error } = await supabase.from('tenants').select('*').order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data || []
}

// ─── SUPERADMIN: ENVIAR EMAIL DE RESETEO DE CLAVE A UN TENANT ────────────────
export async function superAdminResetPassword(email) {
  if (!supabase) throw new Error('Supabase no configurado')
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '?reset=1',
  })
  if (error) throw new Error(error.message)
}
