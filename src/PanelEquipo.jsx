import { useState, useEffect } from 'react'
import { T, EMPRESAS, uid, hoy, fmt, genCode } from './utils.js'
import { Btn, Card, Inp, Sel, Field, Badge, Divider } from './components.jsx'
import { QRCanvas } from './Fotocheck.jsx'
import { supabaseEnabled, reniecEnabled, consultarDNI, upsertColaborador, updatePinColaborador, updateFaceData } from './db.js'
import { RegistroFotoReferencia } from './FaceRecognition.jsx'

const DIAS = [
  { k:'L', label:'Lun', full:'Lunes' },
  { k:'M', label:'Mar', full:'Martes' },
  { k:'X', label:'Mié', full:'Miércoles' },
  { k:'J', label:'Jue', full:'Jueves' },
  { k:'V', label:'Vie', full:'Viernes' },
  { k:'S', label:'Sáb', full:'Sábado' },
  { k:'D', label:'Dom', full:'Domingo' },
]

function SelectorDias({ form, set }) {
  const dias = form.dias_laborables || { L:true, M:true, X:true, J:true, V:true, S:false, D:false }
  const especiales = form.horarios_especiales || {}

  const toggleDia = (k) => {
    const nuevo = { ...dias, [k]: !dias[k] }
    set('dias_laborables', nuevo)
    // Si se desactiva el día, limpiar su horario especial
    if (dias[k]) {
      const nuevosEsp = { ...especiales }
      delete nuevosEsp[k]
      set('horarios_especiales', nuevosEsp)
    }
  }

  const setHorarioEspecial = (k, campo, valor) => {
    set('horarios_especiales', {
      ...especiales,
      [k]: { ...(especiales[k] || { entrada: form.horario?.split(' - ')[0] || '08:00', salida: form.horario?.split(' - ')[1] || '17:00' }), [campo]: valor }
    })
  }

  const diasActivos = DIAS.filter(d => dias[d.k])
  const diasConHorarioDiferente = diasActivos.filter(d => especiales[d.k])

  return (
    <div style={{ background:'#F0F8FF', border:`2px solid ${T.azul}22`, borderRadius:12, padding:'14px', marginBottom:12 }}>
      <div style={{ fontWeight:800, color:T.azul, fontSize:14, marginBottom:10 }}>
        📅 Días laborables y horarios
      </div>

      {/* Selector de días */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
        {DIAS.map(d => (
          <button key={d.k} onClick={() => toggleDia(d.k)}
            style={{
              padding:'10px 14px', borderRadius:10, border:'none', cursor:'pointer',
              background: dias[d.k]
                ? (especiales[d.k] ? T.gold : T.azul)
                : T.grisLight,
              color: dias[d.k] ? '#fff' : T.grisMid,
              fontWeight: dias[d.k] ? 800 : 400, fontSize:14,
              transition:'all .15s', WebkitTapHighlightColor:'transparent',
              minWidth:52, textAlign:'center',
            }}
            title={d.full}>
            <div>{d.label}</div>
            {dias[d.k] && especiales[d.k] && <div style={{ fontSize:9, marginTop:2 }}>diff</div>}
          </button>
        ))}
      </div>

      <div style={{ fontSize:12, color:'#888', marginBottom:8 }}>
        <span style={{ background:T.azul, color:'#fff', borderRadius:4, padding:'2px 6px', fontSize:10, marginRight:6 }}>Azul</span>Horario normal
        <span style={{ background:T.gold, color:'#fff', borderRadius:4, padding:'2px 6px', fontSize:10, marginLeft:10, marginRight:6 }}>Naranja</span>Horario diferente
        <span style={{ background:T.grisLight, color:T.grisMid, borderRadius:4, padding:'2px 6px', fontSize:10, marginLeft:10, marginRight:6 }}>Gris</span>No labora
      </div>

      {/* Resumen de días activos */}
      <div style={{ fontSize:13, color:T.gris, marginBottom:10 }}>
        <b>Labora:</b> {diasActivos.map(d=>d.full).join(', ') || 'Ningún día seleccionado'}
      </div>

      {/* Horarios especiales por día */}
      {diasActivos.length > 0 && (
        <div>
          <div style={{ fontWeight:700, fontSize:12, color:T.azul, marginBottom:8 }}>
            ¿Algún día tiene horario diferente al normal ({form.horario})?
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {diasActivos.map(d => (
              <div key={d.k}>
                <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13 }}>
                  <input type="checkbox"
                    checked={!!especiales[d.k]}
                    onChange={e => {
                      if (e.target.checked) {
                        // Activar horario especial con valores del horario normal como default
                        const [ent, sal] = (form.horario || '08:00 - 17:00').split(' - ')
                        set('horarios_especiales', { ...especiales, [d.k]: { entrada: ent?.trim() || '08:00', salida: sal?.trim() || '17:00' } })
                      } else {
                        const nuevo = { ...especiales }; delete nuevo[d.k]
                        set('horarios_especiales', nuevo)
                      }
                    }}
                    style={{ width:16, height:16 }} />
                  <span style={{ fontWeight:600 }}>{d.full}</span> tiene horario diferente
                </label>
                {especiales[d.k] && (
                  <div style={{ display:'flex', gap:10, marginTop:6, marginLeft:24, flexWrap:'wrap' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ fontSize:12, color:'#888', minWidth:50 }}>Entrada:</span>
                      <input type="time" value={especiales[d.k].entrada || '08:00'}
                        onChange={e => setHorarioEspecial(d.k, 'entrada', e.target.value)}
                        style={{ padding:'6px 10px', border:`1.5px solid ${T.azul}`, borderRadius:8, fontSize:14, fontFamily:'inherit' }} />
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ fontSize:12, color:'#888', minWidth:50 }}>Salida:</span>
                      <input type="time" value={especiales[d.k].salida || '17:00'}
                        onChange={e => setHorarioEspecial(d.k, 'salida', e.target.value)}
                        style={{ padding:'6px 10px', border:`1.5px solid ${T.azul}`, borderRadius:8, fontSize:14, fontFamily:'inherit' }} />
                    </div>
                    <div style={{ fontSize:12, color:T.azul, alignSelf:'center' }}>
                      → {especiales[d.k].entrada} a {especiales[d.k].salida}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function FormColaborador({ inicial, onGuardar, onCancelar, titulo, toast_, listaEmpresas = [] }) {
  const empresasForm = listaEmpresas.length > 0 ? listaEmpresas : []
  const primeraEmpresa = empresasForm[0] || ''
  const defaults = {
    nombre:'', cargo:'', empresa: primeraEmpresa, salario:'', ingreso:hoy(),
    turno:'diurno', horario:'08:00 - 17:00', tiene_descanso:false,
    horario_descanso:'13:00 - 14:00', dni:'', telefono:'', pin:'',
    dias_laborables: { L:true, M:true, X:true, J:true, V:true, S:false, D:false },
    horarios_especiales: {},
  }

  const buildForm = (src) => ({
    ...defaults,
    ...(src || {}),
    dias_laborables: src?.dias_laborables || defaults.dias_laborables,
    horarios_especiales: src?.horarios_especiales || defaults.horarios_especiales,
    pin: src?.pin || '',
    tiene_descanso: src?.tiene_descanso || false,
    horario_descanso: src?.horario_descanso || defaults.horario_descanso,
  })

  const [form, setForm] = useState(() => buildForm(inicial))
  const [buscandoDNI, setBuscandoDNI] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // CRÍTICO: cuando cambia el colaborador a editar, reiniciar el form completamente
  useEffect(() => {
    setForm(buildForm(inicial))
  }, [inicial?.id])

  // Cuando cambia la lista de empresas (recién guardadas), actualizar si la empresa actual no existe
  useEffect(() => {
    if (empresasForm.length > 0 && form.empresa && !empresasForm.includes(form.empresa)) {
      set('empresa', empresasForm[0])
    }
    // Si no hay empresa seleccionada y hay empresas disponibles, seleccionar la primera
    if (empresasForm.length > 0 && !form.empresa) {
      set('empresa', empresasForm[0])
    }
  }, [listaEmpresas.length])

  const buscarDNI = async () => {
    if (!/^\d{8}$/.test(form.dni)) return toast_('DNI debe tener 8 dígitos', 'err')
    setBuscandoDNI(true)
    try {
      const r = await consultarDNI(form.dni)
      set('nombre', r.nombre)
      // Scroll al campo nombre para que sea visible en móvil
      setTimeout(() => {
        document.getElementById('campo-nombre')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
      toast_(`✅ ${r.nombre}`)
    }
    catch (e) { toast_(e.message, 'err') }
    setBuscandoDNI(false)
  }

  const pinValido = form.pin === '' || (form.pin.length === 4 && /^\d{4}$/.test(form.pin))

  return (
    <Card style={{ marginBottom:20, borderLeft:`5px solid ${T.verde}` }}>
      <div style={{ fontWeight:800, color:T.verde, marginBottom:14, fontSize:15 }}>{titulo}</div>

      {/* DNI + RENIEC */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8, alignItems:'end' }}>
        <Field label="DNI *">
          <Inp value={form.dni} onChange={v => set('dni', v.replace(/\D/g,'').slice(0,8))}
            placeholder="12345678" style={{ letterSpacing:3, fontSize:18, fontWeight:700 }} />
        </Field>
        <div style={{ marginBottom:14 }}>
          <Btn color={T.azul} onClick={buscarDNI} disabled={buscandoDNI||form.dni.length!==8}>
            {buscandoDNI ? '⏳' : reniecEnabled ? '🔍 RENIEC' : '🔍'}
          </Btn>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:12 }}>
        <Field label="Nombre completo *">
          <div id="campo-nombre">
            <Inp value={form.nombre} onChange={v => set('nombre',v)} placeholder="Apellidos y nombres"
              style={{ background: form.nombre ? '#E8F5E9' : '', fontWeight: form.nombre ? 700 : 400 }} />
          </div>
          {form.nombre && <div style={{ fontSize:12, color:T.verde, fontWeight:700, marginTop:3 }}>✅ {form.nombre}</div>}
        </Field>
        <Field label="Teléfono">
          <Inp value={form.telefono} onChange={v => set('telefono',v)} placeholder="+51 9..." />
        </Field>
        <Field label="Cargo *">
          <Inp value={form.cargo} onChange={v => set('cargo',v)} placeholder="Recepcionista..." />
        </Field>
        <Field label="Empresa *">
          <Sel value={form.empresa} onChange={v => set('empresa',v)}>
            {empresasForm.length === 0
              ? <option value="">— Configura empresas en Ajustes primero —</option>
              : empresasForm.map(e=><option key={e}>{e}</option>)
            }
          </Sel>
          {empresasForm.length === 0 && (
            <div style={{ fontSize:11, color:T.rojo, marginTop:4 }}>
              ⚠️ Ve a Panel Gerente → ⚙️ Ajustes → Empresas y guarda primero las empresas
            </div>
          )}
        </Field>
        <Field label="Salario mensual (S/) *">
          <Inp type="number" value={form.salario} onChange={v => set('salario',v)} placeholder="1130" />
        </Field>
        <Field label="Fecha ingreso">
          <Inp type="date" value={form.ingreso} onChange={v => set('ingreso',v)} />
        </Field>
        <Field label="Turno">
          <Sel value={form.turno} onChange={v => set('turno',v)}>
            <option value="diurno">☀️ Diurno</option>
            <option value="nocturno">🌙 Nocturno</option>
            <option value="rotativo">🔄 Rotativo</option>
          </Sel>
        </Field>
        <Field label="Horario de trabajo">
          <Inp value={form.horario} onChange={v => set('horario',v)} placeholder="08:00 - 17:00" />
        </Field>
      </div>

      {/* Descanso */}
      <div style={{ background:T.grisLight, borderRadius:10, padding:'12px 14px', marginTop:4, marginBottom:12 }}>
        <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', fontSize:14, fontWeight:700 }}>
          <input type="checkbox" checked={form.tiene_descanso} onChange={e => set('tiene_descanso',e.target.checked)}
            style={{ width:18, height:18 }} />
          🍽️ Tiene descanso / almuerzo
        </label>
        {form.tiene_descanso && (
          <div style={{ marginTop:10 }}>
            <Field label="Horario de descanso" hint="Ej. 13:00 - 14:00 — no cuenta como horas trabajadas">
              <Inp value={form.horario_descanso} onChange={v => set('horario_descanso',v)} placeholder="13:00 - 14:00" />
            </Field>
          </div>
        )}
      </div>

      {/* DÍAS LABORABLES */}
      <SelectorDias form={form} set={set} />

      {/* PIN personal */}
      <div style={{ background:'#1A1A2E', borderRadius:12, padding:'16px', marginBottom:14 }}>
        <div style={{ fontWeight:800, color:'#FFD54F', marginBottom:4, fontSize:14 }}>🔐 PIN personal del colaborador</div>
        <div style={{ color:'#aaa', fontSize:12, marginBottom:10 }}>
          4 dígitos numéricos. El colaborador lo usará para marcar asistencia desde cualquier celular.
          Déjalo en blanco si prefiere usar solo QR.
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <input
            type="number" value={form.pin} maxLength={4}
            onChange={e => set('pin', e.target.value.replace(/\D/g,'').slice(0,4))}
            placeholder="Ej. 1234"
            style={{ width:120, padding:'12px', border:`2px solid ${pinValido?'#FFD54F':'#B71C1C'}`, borderRadius:10, fontSize:22, fontWeight:800, letterSpacing:6, textAlign:'center', background:'#2a2a2a', color:'#FFD54F', fontFamily:'monospace' }}
          />
          <div style={{ fontSize:12, color: pinValido ? '#aaa' : '#ff6b6b' }}>
            {form.pin === '' ? 'Sin PIN — solo QR' : form.pin.length < 4 ? `Faltan ${4-form.pin.length} dígitos` : '✅ PIN listo'}
          </div>
        </div>
        {form.pin && form.pin.length === 4 && (
          <div style={{ marginTop:8, fontSize:11, color:'#888' }}>
            ⚠️ Recuerda comunicar este PIN al colaborador en privado.
          </div>
        )}
      </div>

      <div style={{ display:'flex', gap:10 }}>
        <Btn onClick={async () => {
          if (!form.nombre||!form.cargo||!form.salario) return toast_('Completa nombre, cargo y salario','err')
          if (form.pin && (form.pin.length !== 4 || !/^\d{4}$/.test(form.pin))) return toast_('El PIN debe tener exactamente 4 dígitos','err')
          await onGuardar(form)
        }}>Guardar</Btn>
        <Btn outline color={T.gris} onClick={onCancelar}>Cancelar</Btn>
      </div>
    </Card>
  )
}

export function PanelEquipo({ colaboradores, onAdd, onDelete, toast_, empresas: empresasProp = [] }) {
  // Usar empresas del prop (del tenant activo) o fallback a array vacío
  const listaEmpresas = empresasProp.length > 0 ? empresasProp : ['Mi Empresa']
  const [show, setShow] = useState(false) // 'nuevo' | 'editar' | false
  const [colabEditando, setColabEditando] = useState(null)
  const [verPin, setVerPin] = useState({}) // {id: true/false}
  const [modalFace, setModalFace] = useState(null) // colaborador para registrar foto

  const toggleVerPin = (id) => setVerPin(p => ({...p, [id]: !p[id]}))

  return (
    <div>
      {/* MODAL FOTO DE REFERENCIA */}
      {modalFace && (
        <div style={{ position:'fixed', inset:0, background:'#00000099', zIndex:400, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
          onClick={e => e.target===e.currentTarget && setModalFace(null)}>
          <div style={{ background:'#fff', borderRadius:16, width:'100%', maxWidth:480, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 12px 48px #0004' }}>
            <div style={{ background:T.verde, padding:'16px 20px', borderRadius:'16px 16px 0 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ color:'#fff', fontWeight:800, fontSize:15 }}>📸 Foto de referencia — {modalFace.nombre}</span>
              <button onClick={() => setModalFace(null)} style={{ background:'transparent', border:'none', color:'#fff', fontSize:22, cursor:'pointer' }}>✕</button>
            </div>
            <div style={{ padding:24 }}>
              <RegistroFotoReferencia
                nombreColab={modalFace.nombre}
                onGuardar={async (foto, descriptor) => {
                  try {
                    await updateFaceData(modalFace.id, foto, descriptor)
                    await onAdd({ ...modalFace, face_foto: foto, face_descriptor: descriptor, _update: true })
                    setModalFace(null)
                    toast_(`✅ Foto de referencia guardada para ${modalFace.nombre}`)
                  } catch (e) { toast_(e.message, 'err') }
                }}
                onCancelar={() => setModalFace(null)}
              />
            </div>
          </div>
        </div>
      )}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div style={{ fontWeight:900, fontSize:18 }}>👥 Equipo ({colaboradores.length})</div>
        <Btn onClick={() => { setShow('nuevo'); setColabEditando(null) }}>+ Nuevo colaborador</Btn>
      </div>

      {!supabaseEnabled && (
        <div style={{ background:T.goldLight, borderLeft:`5px solid ${T.gold}`, borderRadius:10, padding:'12px 16px', marginBottom:16, fontSize:13 }}>
          <b>⚠️ Modo local:</b> datos solo en este dispositivo.
        </div>
      )}

      {/* Aviso si no hay empresas configuradas */}
      {listaEmpresas.length === 0 && (
        <div style={{ background:'#FFF3E0', border:`2px solid ${T.gold}`, borderRadius:12, padding:'16px 20px', marginBottom:16, display:'flex', alignItems:'center', gap:14 }}>
          <span style={{ fontSize:32 }}>⚠️</span>
          <div>
            <div style={{ fontWeight:800, color:T.gold, marginBottom:4 }}>Primero configura las empresas</div>
            <div style={{ fontSize:13, color:'#888' }}>
              Ve a <b>⚙️ Ajustes → 🏢 Empresas</b>, agrega tus empresas y toca <b>💾 Guardar</b>. Luego regresa aquí.
            </div>
          </div>
        </div>
      )}

      {/* Formulario nuevo */}
      {show === 'nuevo' && (
        <FormColaborador
          titulo="➕ Nuevo colaborador"
          toast_={toast_}
          listaEmpresas={listaEmpresas}
          onCancelar={() => setShow(false)}
          onGuardar={async (form) => {
            if (!form.empresa) return toast_('Selecciona una empresa primero', 'err')
            await onAdd(form)
            setShow(false)
            toast_(`${form.nombre} agregado${form.pin ? ` · PIN: ${form.pin}` : ''}`)
          }}
        />
      )}

      {/* Formulario edición */}
      {show === 'editar' && colabEditando && (
        <FormColaborador
          titulo={`✏️ Editar — ${colabEditando.nombre}`}
          inicial={colabEditando}
          toast_={toast_}
          listaEmpresas={listaEmpresas}
          onCancelar={() => { setShow(false); setColabEditando(null) }}
          onGuardar={async (form) => {
            try {
              await upsertColaborador({ ...colabEditando, ...form })
              if (form.pin) await updatePinColaborador(colabEditando.id, form.pin)
              await onAdd({ ...colabEditando, ...form, _update: true })
              setShow(false)
              setColabEditando(null)
              toast_(`Datos actualizados${form.pin ? ` · PIN: ${form.pin}` : ''}`)
            } catch (e) { toast_(e.message, 'err') }
          }}
        />
      )}

      {colaboradores.length === 0 ? (
        <Card style={{ textAlign:'center', padding:48, color:'#888' }}>
          <div style={{ fontSize:48, marginBottom:12 }}>👥</div>
          Sin colaboradores registrados.
        </Card>
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
                <div style={{ display:'flex', gap:6 }}>
                  <button onClick={() => { setColabEditando(c); setShow('editar'); window.scrollTo(0,0) }}
                    style={{ background:T.azulLight, color:T.azul, border:'none', borderRadius:7, padding:'5px 11px', cursor:'pointer', fontSize:12, fontWeight:700 }}>✏️</button>
                  <button onClick={async () => { if(confirm(`¿Eliminar a ${c.nombre}?`)){ await onDelete(c.id); toast_('Eliminado') }}}
                    style={{ background:T.rojoLight, color:T.rojo, border:'none', borderRadius:7, padding:'5px 11px', cursor:'pointer', fontSize:12, fontWeight:700 }}>✕</button>
                </div>
              </div>

              <div style={{ marginTop:12, fontSize:13, color:T.gris, lineHeight:2 }}>
                <div>💰 S/ {Number(c.salario||0).toFixed(2)}/mes · {c.turno}</div>
                <div>🕐 {c.horario}{c.tiene_descanso?` · descanso ${c.horario_descanso}`:''}</div>
                {c.dias_laborables && (
                  <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginTop:4 }}>
                    {DIAS.map(d => {
                      const labora = c.dias_laborables?.[d.k]
                      const esp = c.horarios_especiales?.[d.k]
                      if (!labora) return null
                      return (
                        <span key={d.k} title={esp ? `${d.full}: ${esp.entrada} - ${esp.salida}` : d.full}
                          style={{ background: esp ? T.goldLight : T.verdeLight, color: esp ? T.gold : T.verde, border:`1px solid ${esp?T.gold:T.verde}`, borderRadius:5, padding:'2px 7px', fontSize:11, fontWeight:700 }}>
                          {d.label}{esp?'*':''}
                        </span>
                      )
                    })}
                    {Object.keys(c.horarios_especiales||{}).length > 0 && (
                      <span style={{ fontSize:10, color:'#888', alignSelf:'center' }}>* horario diferente</span>
                    )}
                  </div>
                )}
                {c.ingreso&&<div>📅 Desde: {fmt(c.ingreso)}</div>}
                {c.dni&&<div>🪪 {c.dni}</div>}
                {c.telefono&&<div>📱 {c.telefono}</div>}
              </div>

              <Divider />

              {/* QR */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10, padding:'8px 12px', background:T.verdeLight, borderRadius:10 }}>
                <div>
                  <div style={{ fontSize:10, color:T.gris, fontWeight:700, textTransform:'uppercase' }}>Código QR</div>
                  <div style={{ fontFamily:'monospace', fontSize:17, fontWeight:900, color:T.verde, letterSpacing:3 }}>{genCode(c.id,c.nombre)}</div>
                </div>
                <QRCanvas code={genCode(c.id,c.nombre)} size={48} />
              </div>

              {/* FOTO REFERENCIA */}
              <div style={{ padding:'8px 12px', background: c.face_foto ? T.azulLight : T.grisLight, borderRadius:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontSize:10, color: c.face_foto ? T.azul : T.grisMid, fontWeight:700, textTransform:'uppercase' }}>
                    {c.face_foto ? '✅ Reconocimiento facial' : '⚠️ Sin foto de referencia'}
                  </div>
                  <div style={{ fontSize:12, color: c.face_foto ? T.azul : T.grisMid }}>
                    {c.face_foto ? 'Verificación facial activa' : 'Sin verificación facial'}
                  </div>
                </div>
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  {c.face_foto && <img src={c.face_foto} alt="ref" style={{ width:36, height:36, borderRadius:'50%', objectFit:'cover', border:`2px solid ${T.azul}` }} />}
                  <button onClick={() => setModalFace(c)}
                    style={{ background: c.face_foto ? T.azulLight : T.verde, color: c.face_foto ? T.azul : '#fff', border:`1px solid ${c.face_foto ? T.azul : T.verde}`, borderRadius:8, padding:'5px 10px', cursor:'pointer', fontSize:12, fontWeight:700 }}>
                    {c.face_foto ? '📸 Actualizar' : '📸 Registrar'}
                  </button>
                </div>
              </div>
              {/* PIN */}
              <div style={{ padding:'8px 12px', background:'#1A1A2E', borderRadius:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontSize:10, color:'#FFD54F', fontWeight:700, textTransform:'uppercase' }}>PIN Personal</div>
                  {c.pin ? (
                    <div style={{ fontFamily:'monospace', fontSize:20, fontWeight:900, color:'#FFD54F', letterSpacing:6 }}>
                      {verPin[c.id] ? c.pin : '••••'}
                    </div>
                  ) : (
                    <div style={{ fontSize:12, color:'#666' }}>Sin PIN asignado</div>
                  )}
                </div>
                {c.pin && (
                  <button onClick={() => toggleVerPin(c.id)}
                    style={{ background:'rgba(255,213,79,0.15)', border:'1px solid rgba(255,213,79,0.3)', borderRadius:8, padding:'6px 12px', cursor:'pointer', color:'#FFD54F', fontSize:12, fontWeight:700 }}>
                    {verPin[c.id] ? '🙈 Ocultar' : '👁️ Ver'}
                  </button>
                )}
                {!c.pin && (
                  <button onClick={() => { setColabEditando(c); setShow('editar'); window.scrollTo(0,0) }}
                    style={{ background:'rgba(255,213,79,0.15)', border:'1px solid rgba(255,213,79,0.3)', borderRadius:8, padding:'6px 12px', cursor:'pointer', color:'#FFD54F', fontSize:12, fontWeight:700 }}>
                    + Asignar PIN
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
