import { useState, useEffect, useCallback } from 'react'
import { T } from './utils.js'
import { Btn, Card, Inp, Spinner, Badge } from './components.jsx'
import { supabase } from './db.js'
import { superAdminResetPassword } from './auth.js'

// ─── CLAVE MAESTRA DEL SUPERADMIN ────────────────────────────────────────────
// Cambia esta clave por una segura
const SUPERADMIN_KEY = 'MEGA2026SA'
const SUPERADMIN_SESSION = 'mega_superadmin_ok'
const SUPERADMIN_EMAIL = 'ivan@megasostenible.pe'

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function fmt(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  return d.toLocaleDateString('es-PE', { day:'2-digit', month:'short', year:'numeric' })
}
function fmtHace(ts) {
  if (!ts) return 'nunca'
  const diff = Date.now() - new Date(ts).getTime()
  const dias = Math.floor(diff / 86400000)
  if (dias === 0) return 'hoy'
  if (dias === 1) return 'ayer'
  if (dias < 30) return `hace ${dias}d`
  if (dias < 365) return `hace ${Math.floor(dias/30)}m`
  return `hace ${Math.floor(dias/365)}a`
}

// ─── COMPONENTES UI ───────────────────────────────────────────────────────────
function KPI({ icon, label, value, color = T.verde }) {
  return (
    <div style={{ background:'#fff', borderRadius:12, padding:'16px 20px', border:`2px solid ${color}22`, textAlign:'center' }}>
      <div style={{ fontSize:28, marginBottom:4 }}>{icon}</div>
      <div style={{ fontWeight:900, fontSize:24, color }}>{value}</div>
      <div style={{ fontSize:12, color:'#888', marginTop:2 }}>{label}</div>
    </div>
  )
}

// ─── LOGIN SUPERADMIN ─────────────────────────────────────────────────────────
function LoginSuperAdmin({ onEntrar }) {
  const [clave, setClave] = useState('')
  const [error, setError] = useState('')

  const entrar = () => {
    if (clave === SUPERADMIN_KEY) {
      sessionStorage.setItem(SUPERADMIN_SESSION, '1')
      onEntrar()
    } else {
      setError('Clave incorrecta')
      setClave('')
    }
  }

  return (
    <div style={{ minHeight:'100vh', background:'#0D0D1A', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:'#1a1a2e', borderRadius:20, padding:40, maxWidth:360, width:'100%', textAlign:'center', border:'2px solid #FFD54F33' }}>
        <div style={{ fontSize:52, marginBottom:12 }}>🛡️</div>
        <div style={{ color:'#FFD54F', fontWeight:900, fontSize:22, marginBottom:4 }}>Super Admin</div>
        <div style={{ color:'#888', fontSize:13, marginBottom:28 }}>Mega Asistencia — Panel de Control</div>
        <input
          type="password" value={clave}
          onChange={e => { setClave(e.target.value); setError('') }}
          onKeyDown={e => e.key === 'Enter' && entrar()}
          placeholder="Clave maestra"
          style={{ width:'100%', padding:'14px', borderRadius:10, border:`2px solid ${error?'#B71C1C':'#FFD54F44'}`, background:'#0D0D1A', color:'#fff', fontSize:16, textAlign:'center', letterSpacing:4, fontFamily:'monospace', outline:'none', boxSizing:'border-box' }}
        />
        {error && <div style={{ color:'#ff6b6b', fontSize:13, marginTop:8 }}>{error}</div>}
        <button onClick={entrar}
          style={{ marginTop:16, width:'100%', padding:'14px', borderRadius:10, background:'#FFD54F', color:'#0D0D1A', border:'none', fontWeight:900, fontSize:16, cursor:'pointer' }}>
          Ingresar
        </button>
        <div style={{ marginTop:16, fontSize:11, color:'#444' }}>
          Solo personal autorizado de Mega Sostenible SAC
        </div>
      </div>
    </div>
  )
}

// ─── PANEL PRINCIPAL ──────────────────────────────────────────────────────────
export function PanelSuperAdmin({ onSalir }) {
  const [autenticado, setAutenticado] = useState(() => sessionStorage.getItem(SUPERADMIN_SESSION) === '1')
  const [tenants, setTenants] = useState([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroPlan, setFiltroPlan] = useState('todos')
  const [seleccionado, setSeleccionado] = useState(null)
  const [procesando, setProcesando] = useState(null)
  const [toast, setToast] = useState(null)

  const toast_ = (msg, tipo='ok') => {
    setToast({ msg, tipo })
    setTimeout(() => setToast(null), 3500)
  }

  const cargar = useCallback(async () => {
    if (!supabase) return
    setCargando(true)
    try {
      const { data, error } = await supabase
        .from('tenant_stats')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setTenants(data || [])
    } catch (e) {
      toast_('Error cargando datos: ' + e.message, 'err')
    }
    setCargando(false)
  }, [])

  useEffect(() => { if (autenticado) cargar() }, [autenticado])

  const cambiarPlan = async (tenantId, nuevoPlan) => {
    setProcesando(tenantId)
    try {
      const { error } = await supabase.rpc('cambiar_plan', {
        p_tenant_id: tenantId,
        p_plan: nuevoPlan
      })
      if (error) throw error
      toast_(`✅ Plan cambiado a ${nuevoPlan.toUpperCase()}`)
      await cargar()
      setSeleccionado(prev => prev?.id === tenantId ? { ...prev, plan: nuevoPlan } : prev)
    } catch (e) { toast_('Error: ' + e.message, 'err') }
    setProcesando(null)
  }

  const toggleActivo = async (tenantId, activo) => {
    setProcesando(tenantId)
    try {
      const { error } = await supabase.rpc('toggle_tenant', {
        p_tenant_id: tenantId,
        p_activo: !activo
      })
      if (error) throw error
      toast_(`✅ Cuenta ${!activo ? 'activada' : 'desactivada'}`)
      await cargar()
    } catch (e) { toast_('Error: ' + e.message, 'err') }
    setProcesando(null)
  }

  if (!autenticado) return <LoginSuperAdmin onEntrar={() => setAutenticado(true)} />

  // Filtros
  const tenantsFiltrados = tenants.filter(t => {
    const matchBusqueda = !busqueda ||
      t.nombre_org?.toLowerCase().includes(busqueda.toLowerCase()) ||
      t.email?.toLowerCase().includes(busqueda.toLowerCase())
    const matchPlan = filtroPlan === 'todos' || t.plan === filtroPlan
    return matchBusqueda && matchPlan
  })

  // KPIs globales
  const totalPro = tenants.filter(t => t.plan === 'pro').length
  const totalActivos = tenants.filter(t => t.activo).length
  const totalColabs = tenants.reduce((s, t) => s + (t.total_colabs || 0), 0)
  const mrr = totalPro * 49

  return (
    <div style={{ minHeight:'100vh', background:'#0D0D1A', color:'#fff' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeIn{from{opacity:0}to{opacity:1}}`}</style>

      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed', top:20, left:'50%', transform:'translateX(-50%)', zIndex:999, background: toast.tipo==='err'?'#B71C1C':T.verde, color:'#fff', padding:'12px 24px', borderRadius:12, fontWeight:700, fontSize:14, boxShadow:'0 4px 20px #0008', animation:'fadeIn .2s ease' }}>
          {toast.msg}
        </div>
      )}

      {/* HEADER */}
      <div style={{ background:'#1a1a2e', padding:'14px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid #FFD54F22', position:'sticky', top:0, zIndex:100 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:22 }}>🛡️</span>
          <div>
            <div style={{ fontWeight:900, fontSize:16, color:'#FFD54F' }}>Super Admin</div>
            <div style={{ fontSize:10, color:'#888' }}>Mega Asistencia SaaS</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <button onClick={cargar} style={{ background:'#333', border:'none', borderRadius:8, color:'#fff', padding:'8px 12px', cursor:'pointer', fontSize:14 }}>🔄</button>
          <button onClick={() => { sessionStorage.removeItem(SUPERADMIN_SESSION); onSalir() }}
            style={{ background:'#B71C1C22', border:'1px solid #B71C1C44', borderRadius:8, color:'#ff6b6b', padding:'8px 12px', cursor:'pointer', fontSize:13, fontWeight:700 }}>
            Salir 🚪
          </button>
        </div>
      </div>

      <div style={{ maxWidth:900, margin:'0 auto', padding:'20px 16px' }}>

        {/* KPIs */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:24 }}>
          <KPI icon="🏢" label="Cuentas totales" value={tenants.length} color='#FFD54F' />
          <KPI icon="⭐" label="Plan Pro" value={totalPro} color={T.verde} />
          <KPI icon="👥" label="Colaboradores" value={totalColabs} color={T.azul} />
          <KPI icon="💰" label="MRR estimado" value={`S/ ${mrr}`} color='#E65100' />
        </div>

        {/* Buscador y filtros */}
        <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
          <div style={{ flex:1, minWidth:200 }}>
            <Inp value={busqueda} onChange={setBusqueda} placeholder="🔍 Buscar por nombre o email..." />
          </div>
          <div style={{ display:'flex', gap:6 }}>
            {['todos','free','pro'].map(p => (
              <button key={p} onClick={() => setFiltroPlan(p)}
                style={{ padding:'10px 16px', borderRadius:8, border:`2px solid ${filtroPlan===p?'#FFD54F':'#333'}`, background:filtroPlan===p?'#FFD54F22':'transparent', color:filtroPlan===p?'#FFD54F':'#888', cursor:'pointer', fontWeight:700, fontSize:12, textTransform:'uppercase' }}>
                {p}
              </button>
            ))}
          </div>
        </div>

        {cargando ? (
          <div style={{ textAlign:'center', padding:60 }}><Spinner /></div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {tenantsFiltrados.length === 0 ? (
              <div style={{ textAlign:'center', padding:40, color:'#888' }}>Sin resultados</div>
            ) : tenantsFiltrados.map(t => {
              const esPro = t.plan === 'pro'
              const estaProcesando = procesando === t.id
              return (
                <div key={t.id}
                  style={{ background: t.activo ? '#1a1a2e' : '#111', border:`1px solid ${esPro?'#FFD54F44':'#333'}`, borderRadius:12, padding:'16px 20px', cursor:'pointer', transition:'border-color .15s' }}
                  onClick={() => setSeleccionado(seleccionado?.id === t.id ? null : t)}>

                  {/* Fila principal */}
                  <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                    <div style={{ fontSize:28, flexShrink:0 }}>{esPro ? '⭐' : '🆓'}</div>
                    <div style={{ flex:1, minWidth:180 }}>
                      <div style={{ fontWeight:800, fontSize:15, color: t.activo?'#fff':'#666' }}>
                        {t.nombre_org}
                        {!t.activo && <span style={{ fontSize:11, color:'#B71C1C', marginLeft:8, background:'#B71C1C22', padding:'1px 6px', borderRadius:4 }}>INACTIVO</span>}
                      </div>
                      <div style={{ fontSize:12, color:'#888', marginTop:2 }}>{t.email}</div>
                    </div>

                    {/* Stats inline */}
                    <div style={{ display:'flex', gap:16, alignItems:'center', flexShrink:0 }}>
                      <div style={{ textAlign:'center' }}>
                        <div style={{ fontWeight:800, fontSize:16, color: esPro?'#FFD54F':T.verde }}>{t.total_colabs || 0}</div>
                        <div style={{ fontSize:10, color:'#888' }}>colabs</div>
                      </div>
                      <div style={{ textAlign:'center' }}>
                        <div style={{ fontWeight:800, fontSize:16, color:'#A5D6A7' }}>{t.total_devices || 0}</div>
                        <div style={{ fontSize:10, color:'#888' }}>devices</div>
                      </div>
                      <div style={{ textAlign:'center' }}>
                        <div style={{ fontWeight:800, fontSize:16, color:'#90CAF9' }}>{t.total_registros || 0}</div>
                        <div style={{ fontSize:10, color:'#888' }}>registros</div>
                      </div>
                      <div style={{ textAlign:'center', minWidth:50 }}>
                        <div style={{ fontSize:11, color:'#888' }}>{fmtHace(t.ultimo_registro)}</div>
                        <div style={{ fontSize:10, color:'#555' }}>último uso</div>
                      </div>
                    </div>

                    {/* Acciones rápidas */}
                    <div style={{ display:'flex', gap:6, flexShrink:0 }} onClick={e => e.stopPropagation()}>
                      {estaProcesando ? (
                        <div style={{ width:32, height:32, border:'3px solid rgba(255,255,255,0.1)', borderTopColor:'#FFD54F', borderRadius:'50%', animation:'spin 0.9s linear infinite' }} />
                      ) : (
                        <>
                          {esPro ? (
                            <button onClick={() => cambiarPlan(t.id, 'free')}
                              style={{ background:'#333', border:'1px solid #555', borderRadius:8, color:'#aaa', padding:'6px 12px', cursor:'pointer', fontSize:11, fontWeight:700 }}>
                              → Free
                            </button>
                          ) : (
                            <button onClick={() => cambiarPlan(t.id, 'pro')}
                              style={{ background:'#FFD54F22', border:'2px solid #FFD54F', borderRadius:8, color:'#FFD54F', padding:'6px 12px', cursor:'pointer', fontSize:11, fontWeight:800 }}>
                              ⭐ Pro
                            </button>
                          )}
                          <button onClick={() => toggleActivo(t.id, t.activo)}
                            style={{ background: t.activo?'#B71C1C22':'#1B6B3A22', border:`1px solid ${t.activo?'#B71C1C44':T.verde+'44'}`, borderRadius:8, color:t.activo?'#ff6b6b':T.verde, padding:'6px 10px', cursor:'pointer', fontSize:12 }}>
                            {t.activo ? '⛔' : '✅'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Detalle expandido */}
                  {seleccionado?.id === t.id && (
                    <div style={{ marginTop:16, paddingTop:16, borderTop:'1px solid #333', animation:'fadeIn .2s ease' }}>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:10, marginBottom:14 }}>
                        <div style={{ background:'#0D0D1A', borderRadius:8, padding:'10px 14px' }}>
                          <div style={{ fontSize:10, color:'#888', marginBottom:4 }}>PLAN ACTUAL</div>
                          <div style={{ fontWeight:800, fontSize:18, color: esPro?'#FFD54F':T.verde }}>{t.plan?.toUpperCase()}</div>
                        </div>
                        <div style={{ background:'#0D0D1A', borderRadius:8, padding:'10px 14px' }}>
                          <div style={{ fontSize:10, color:'#888', marginBottom:4 }}>MÁX. COLABS</div>
                          <div style={{ fontWeight:800, fontSize:18, color:'#fff' }}>{t.max_colabs >= 999999 ? '∞' : t.max_colabs}</div>
                        </div>
                        <div style={{ background:'#0D0D1A', borderRadius:8, padding:'10px 14px' }}>
                          <div style={{ fontSize:10, color:'#888', marginBottom:4 }}>MÁX. DEVICES</div>
                          <div style={{ fontWeight:800, fontSize:18, color:'#fff' }}>{t.max_devices >= 999999 ? '∞' : t.max_devices}</div>
                        </div>
                        <div style={{ background:'#0D0D1A', borderRadius:8, padding:'10px 14px' }}>
                          <div style={{ fontSize:10, color:'#888', marginBottom:4 }}>REGISTRADO</div>
                          <div style={{ fontWeight:700, fontSize:13, color:'#fff' }}>{fmt(t.created_at)}</div>
                        </div>
                        <div style={{ background:'#0D0D1A', borderRadius:8, padding:'10px 14px' }}>
                          <div style={{ fontSize:10, color:'#888', marginBottom:4 }}>ÚLTIMO REGISTRO</div>
                          <div style={{ fontWeight:700, fontSize:13, color:'#fff' }}>{fmt(t.ultimo_registro)}</div>
                        </div>
                        <div style={{ background:'#0D0D1A', borderRadius:8, padding:'10px 14px' }}>
                          <div style={{ fontSize:10, color:'#888', marginBottom:4 }}>INGRESO MENSUAL</div>
                          <div style={{ fontWeight:800, fontSize:18, color:'#E65100' }}>{esPro ? 'S/ 49' : 'S/ 0'}</div>
                        </div>
                      </div>

                      {/* ID para soporte */}
                      <div style={{ fontSize:10, color:'#444', fontFamily:'monospace', wordBreak:'break-all' }}>
                        ID: {t.id}
                      </div>

                      {/* Cambio de plan con botones grandes */}
                      <div style={{ marginTop:12, display:'flex', gap:10 }}>
                        <button onClick={() => cambiarPlan(t.id, 'free')} disabled={!esPro || estaProcesando}
                          style={{ flex:1, padding:'12px', borderRadius:10, border:'2px solid #555', background: !esPro?T.verdeLight+'33':'transparent', color: !esPro?T.verde:'#666', cursor: esPro?'pointer':'default', fontWeight:800, fontSize:13 }}>
                          🆓 Plan Free {!esPro && '← actual'}
                        </button>
                        <button onClick={() => cambiarPlan(t.id, 'pro')} disabled={esPro || estaProcesando}
                          style={{ flex:1, padding:'12px', borderRadius:10, border:'2px solid #FFD54F44', background: esPro?'#FFD54F22':'transparent', color: esPro?'#FFD54F':'#666', cursor: !esPro?'pointer':'default', fontWeight:800, fontSize:13 }}>
                          ⭐ Plan Pro {esPro && '← actual'}
                        </button>
                      </div>

                      {/* Resetear contraseña */}
                      <div style={{ marginTop:10 }}>
                        <button onClick={async () => {
                          if (!confirm(`¿Enviar email de reseteo de contraseña a ${t.email}?`)) return
                          setProcesando(t.id)
                          try {
                            await superAdminResetPassword(t.email)
                            toast_(`✅ Email de reseteo enviado a ${t.email}`)
                          } catch (e) { toast_('Error: ' + e.message, 'err') }
                          setProcesando(null)
                        }} disabled={estaProcesando}
                          style={{ width:'100%', padding:'11px', borderRadius:10, border:'2px solid #0D47A144', background:'#0D47A122', color:'#90CAF9', cursor:'pointer', fontWeight:700, fontSize:13, fontFamily:'inherit' }}>
                          🔑 Enviar reseteo de contraseña a {t.email}
                        </button>
                        <div style={{ fontSize:10, color:'#555', marginTop:4, textAlign:'center' }}>
                          El usuario recibirá un email con un enlace para crear una nueva contraseña
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop:24, textAlign:'center', fontSize:11, color:'#444' }}>
          {tenantsFiltrados.length} de {tenants.length} cuentas · MRR total: S/ {mrr}/mes
        </div>
      </div>
    </div>
  )
}
