import { useState, useEffect } from 'react'
import { T } from './utils.js'
import { Btn, Card, Inp, Field, Spinner } from './components.jsx'
import {
  getFeriados, saveFeriados, getConfigFeriados, saveConfigFeriados,
  FERIADOS_DEFAULT, TIPO_FERIADO, fmtFecha,
} from './feriados.js'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export function PanelFeriados({ toast_ }) {
  const [feriados, setFeriados] = useState([])
  const [config, setConfig] = useState({ afecta_calculo: true, sector: 'privado', incluir_tipo_publico: false })
  const [cargando, setCargando] = useState(true)
  const [filtrAnio, setFiltrAnio] = useState(new Date().getFullYear().toString())
  const [nuevo, setNuevo] = useState({ fecha: '', nombre: '', tipo: 'personalizado' })
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    const cargar = async () => {
      setCargando(true)
      const [f, c] = await Promise.all([getFeriados(), getConfigFeriados()])
      setFeriados(f)
      setConfig(c)
      setCargando(false)
    }
    cargar()
  }, [])

  const guardarTodo = async () => {
    setGuardando(true)
    try {
      await saveFeriados(feriados)
      await saveConfigFeriados(config)
      toast_('✅ Feriados y configuración guardados')
    } catch (e) {
      toast_('Error al guardar: ' + e.message, 'err')
    }
    setGuardando(false)
  }

  const agregarFeriado = () => {
    if (!nuevo.fecha || !nuevo.nombre.trim()) return toast_('Completa fecha y nombre', 'err')
    if (feriados.some(f => f.fecha === nuevo.fecha)) return toast_('Ya existe un feriado en esa fecha', 'err')
    setFeriados([...feriados, { ...nuevo, nombre: nuevo.nombre.trim() }].sort((a,b) => a.fecha.localeCompare(b.fecha)))
    setNuevo({ fecha: '', nombre: '', tipo: 'personalizado' })
    toast_('Feriado agregado — recuerda guardar')
  }

  const eliminar = (fecha) => {
    setFeriados(feriados.filter(f => f.fecha !== fecha))
  }

  const restaurar = () => {
    if (confirm('¿Restaurar la lista de feriados por defecto? Se perderán los feriados personalizados.')) {
      setFeriados([...FERIADOS_DEFAULT])
      toast_('Lista restaurada — recuerda guardar')
    }
  }

  // Filtrar por año
  const anios = [...new Set(feriados.map(f => f.fecha.slice(0,4)))].sort()
  const feriadosFiltrados = feriados.filter(f => f.fecha.startsWith(filtrAnio))

  // Agrupar por mes
  const porMes = {}
  feriadosFiltrados.forEach(f => {
    const m = parseInt(f.fecha.slice(5,7)) - 1
    if (!porMes[m]) porMes[m] = []
    porMes[m].push(f)
  })

  if (cargando) return <div style={{ textAlign:'center', padding:32 }}><Spinner /></div>

  return (
    <div>
      {/* CONFIG GENERAL */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 800, color: T.verde, fontSize: 15, marginBottom: 14 }}>
          ⚙️ Configuración de feriados
        </div>

        {/* ¿Afecta cálculo de ausencias? */}
        <div style={{ background: T.grisLight, borderRadius: 10, padding: '14px', marginBottom: 12 }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={config.afecta_calculo}
              onChange={e => setConfig(c => ({ ...c, afecta_calculo: e.target.checked }))}
              style={{ width: 20, height: 20, marginTop: 2, cursor: 'pointer', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Los feriados no cuentan como faltas</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>
                Si está activo: un colaborador que no asiste en feriado no cuenta como ausencia en el cálculo de pagos y asistencia.
              </div>
            </div>
          </label>
        </div>

        {/* Sector */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: T.gris, marginBottom: 8 }}>Sector de la empresa</div>
          <div style={{ display: 'flex', gap: 10 }}>
            {[['privado','🏢 Privado'],['publico','🏛️ Público']].map(([val,label]) => (
              <button key={val} onClick={() => setConfig(c => ({ ...c, sector: val }))}
                style={{ flex:1, padding:'12px', borderRadius:10, border:`2px solid ${config.sector===val?T.verde:'#ddd'}`, background:config.sector===val?T.verdeLight:'#fff', fontWeight:config.sector===val?800:400, cursor:'pointer', fontSize:14 }}>
                {label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>
            {config.sector === 'privado'
              ? 'Los feriados marcados como "Solo público" no aplican a tu empresa.'
              : 'Todos los feriados nacionales y del sector público aplican.'}
          </div>
        </div>

        {/* Incluir feriados de sector público si es privado */}
        {config.sector === 'privado' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, padding: '10px', background: '#FFF3E0', borderRadius: 8 }}>
            <input type="checkbox" checked={config.incluir_tipo_publico}
              onChange={e => setConfig(c => ({ ...c, incluir_tipo_publico: e.target.checked }))}
              style={{ width: 16, height: 16, cursor: 'pointer' }} />
            <span>Incluir también feriados de sector público (opcional)</span>
          </label>
        )}
      </Card>

      {/* AGREGAR FERIADO */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 800, color: T.verde, fontSize: 15, marginBottom: 12 }}>
          ➕ Agregar feriado o puente
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <Field label="Fecha">
            <input type="date" value={nuevo.fecha}
              onChange={e => setNuevo(n => ({ ...n, fecha: e.target.value }))}
              style={{ width:'100%', padding:'10px 12px', border:'1.5px solid #D0D7DE', borderRadius:8, fontSize:14, fontFamily:'inherit' }} />
          </Field>
          <Field label="Tipo">
            <select value={nuevo.tipo} onChange={e => setNuevo(n => ({ ...n, tipo: e.target.value }))}
              style={{ width:'100%', padding:'10px 12px', border:'1.5px solid #D0D7DE', borderRadius:8, fontSize:14, fontFamily:'inherit', background:'#fff' }}>
              {Object.entries(TIPO_FERIADO).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Nombre del feriado">
          <Inp value={nuevo.nombre} onChange={v => setNuevo(n => ({ ...n, nombre: v }))}
            placeholder="Ej. Puente declarado, Aniversario de Juanjuí..." />
        </Field>
        <div style={{ marginTop: 10, display: 'flex', gap: 10 }}>
          <Btn color={T.azul} onClick={agregarFeriado}>+ Agregar</Btn>
          <button onClick={restaurar}
            style={{ background:'transparent', border:'1px solid #ddd', borderRadius:8, padding:'8px 14px', cursor:'pointer', fontSize:12, color:'#888' }}>
            🔄 Restaurar lista por defecto
          </button>
        </div>
      </Card>

      {/* LISTA POR AÑO */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <div style={{ fontWeight:800, fontSize:15, color:T.gris }}>
            📅 Feriados — {feriadosFiltrados.length} en {filtrAnio}
          </div>
          <div style={{ display:'flex', gap:6 }}>
            {anios.map(a => (
              <button key={a} onClick={() => setFiltrAnio(a)}
                style={{ padding:'6px 12px', borderRadius:8, border:`2px solid ${filtrAnio===a?T.verde:'#ddd'}`, background:filtrAnio===a?T.verdeLight:'#fff', fontWeight:filtrAnio===a?800:400, cursor:'pointer', fontSize:13 }}>
                {a}
              </button>
            ))}
          </div>
        </div>

        {feriadosFiltrados.length === 0 ? (
          <div style={{ textAlign:'center', padding:24, color:'#aaa' }}>Sin feriados en {filtrAnio}</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {Object.entries(porMes).sort(([a],[b]) => parseInt(a)-parseInt(b)).map(([mes, items]) => (
              <div key={mes}>
                <div style={{ fontSize:11, fontWeight:800, color:T.grisMid, textTransform:'uppercase', letterSpacing:0.5, padding:'8px 0 4px', borderBottom:'1px solid #f0f0f0', marginBottom:6 }}>
                  {MESES[parseInt(mes)]}
                </div>
                {items.map(f => {
                  const tipo = TIPO_FERIADO[f.tipo] || TIPO_FERIADO.personalizado
                  const esDefault = FERIADOS_DEFAULT.some(d => d.fecha === f.fecha && d.nombre === f.nombre)
                  return (
                    <div key={f.fecha} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:8, background:tipo.bg, marginBottom:4 }}>
                      <div style={{ width:44, textAlign:'center', fontSize:13, fontWeight:900, color:tipo.color, flexShrink:0 }}>
                        {f.fecha.slice(8)} {MESES[parseInt(f.fecha.slice(5,7))-1].slice(0,3)}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:700, fontSize:13, color:tipo.color }}>{f.nombre}</div>
                        <span style={{ fontSize:10, background:tipo.color+'22', color:tipo.color, borderRadius:4, padding:'1px 6px', fontWeight:700 }}>
                          {tipo.label}
                        </span>
                      </div>
                      {!esDefault && (
                        <button onClick={() => eliminar(f.fecha)}
                          style={{ background:'transparent', border:'none', color:'#aaa', cursor:'pointer', fontSize:16, padding:'2px 6px', flexShrink:0 }}>✕</button>
                      )}
                      {esDefault && (
                        <button onClick={() => eliminar(f.fecha)}
                          style={{ background:'transparent', border:'1px solid #ddd', color:'#ccc', cursor:'pointer', fontSize:11, padding:'2px 8px', borderRadius:6, flexShrink:0 }}>Quitar</button>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* GUARDAR */}
      <Btn full color={T.verde} onClick={guardarTodo} disabled={guardando}>
        {guardando ? '⏳ Guardando...' : '💾 Guardar feriados y configuración'}
      </Btn>
      <div style={{ fontSize:12, color:'#888', textAlign:'center', marginTop:8 }}>
        Los cambios se sincronizan en todos los dispositivos vinculados
      </div>
    </div>
  )
}
