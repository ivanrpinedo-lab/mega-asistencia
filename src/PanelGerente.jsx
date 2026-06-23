import { useState, useMemo, useRef, useEffect } from 'react'
import { T, EMPRESAS, hoy, fmt, fmtTs, diffH, genCode } from './utils.js'
import { Btn, Card, Inp, Sel, Field, Badge, Spinner, Divider, BtnVolver } from './components.jsx'
import { mapsUrl, haversine } from './useGPS.js'
import { getConfig, setConfig } from './db.js'
import { PanelEquipo } from './PanelEquipo.jsx'
import { PanelFotocheck } from './Fotocheck.jsx'
import { PanelFeriados } from './PanelFeriados.jsx'
import { getFeriados, getConfigFeriados, esFeriado, infoFeriado, diasHabilesConFeriados, TIPO_FERIADO } from './feriados.js'

// ─── PIN DE ACCESO ────────────────────────────────────────────────────────────
const PIN_KEY = 'mega_gerente_pin'
const SESSION_KEY = 'mega_gerente_session'
const SESSION_TTL = 8 * 60 * 60 * 1000

// PIN con prefijo de tenant para aislar entre usuarios
function getPinKey() {
  try {
    const t = JSON.parse(localStorage.getItem('mega_tenant') || 'null')
    return t?.tenant_id ? `${PIN_KEY}_${t.tenant_id}` : PIN_KEY
  } catch { return PIN_KEY }
}

export async function getPinAsync() {
  try {
    const pinNube = await getConfig('gerente_pin')
    if (pinNube) {
      localStorage.setItem(getPinKey(), pinNube)
      return pinNube
    }
  } catch {}
  return localStorage.getItem(getPinKey()) || '1234'
}

export function getPin() {
  return localStorage.getItem(getPinKey()) || '1234'
}

export async function setPinAsync(p) {
  localStorage.setItem(getPinKey(), p)
  try { await setConfig('gerente_pin', p) } catch {}
}

export function setPin(p) {
  localStorage.setItem(getPinKey(), p)
  setConfig('gerente_pin', p).catch(() => {})
}

function sessionValida() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}')
    return s.ts && Date.now() - s.ts < SESSION_TTL
  } catch { return false }
}
function abrirSession() {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ ts: Date.now() }))
}
function cerrarSession() {
  localStorage.removeItem(SESSION_KEY)
}

// ─── CÁLCULO LABORAL REMYPE ───────────────────────────────────────────────────
const JORNADA = 8
const FACTOR_E1 = 1.25
const FACTOR_E2 = 1.35
const TOLERANCIA_MIN = 15  // minutos de tolerancia antes de marcar tardanza

// Convierte "HH:MM" a minutos totales
function horaAMin(hora) {
  if (!hora) return 0
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

// Hora límite con tolerancia: "08:00" + 15 min = "08:15"
function horaLimite(horarioEntrada, toleranciaMin = TOLERANCIA_MIN) {
  const base = horaAMin(horarioEntrada)
  const limite = base + toleranciaMin
  const h = Math.floor(limite / 60).toString().padStart(2, '0')
  const m = (limite % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}

export function calcularMetricasColab(registros, salario, mes, colab = null, feriados = [], configFeriados = null) {
  const regsCheckin = registros.filter(r =>
    r.tipo === 'checkin' && r.fecha?.startsWith(mes)
  )

  // Determinar hora de entrada pactada del colaborador
  const horarioPactado = colab?.horario || '08:00 - 17:00'
  const entradaPactada = horarioPactado.split(' - ')[0]?.trim() || '08:00'
  const limiteTardanza = horaLimite(entradaPactada, TOLERANCIA_MIN)

  // Pares entrada/salida por día — también considera horarios especiales por día
  const porDia = {}
  regsCheckin.forEach(r => {
    const tm = r.tipo_marca || r.tipoMarca
    if (!porDia[r.fecha]) porDia[r.fecha] = {}
    if (tm === 'entrada') porDia[r.fecha].entrada = r.hora
    if (tm === 'salida') porDia[r.fecha].salida = r.hora
    if (tm === 'campo') porDia[r.fecha].campo = true
    if (tm === 'descanso') porDia[r.fecha].descanso = true
  })

  let diasTrabajados = 0, horasTotales = 0, horasExtra = 0
  let tardanzas = 0, diasCampo = 0
  const detalleTardanzas = [] // para mostrar en detalle

  Object.entries(porDia).forEach(([fecha, d]) => {
    if (d.entrada) {
      diasTrabajados++
      if (d.campo) diasCampo++

      // Calcular horas trabajadas
      if (d.salida) {
        let h = diffH(d.entrada, d.salida)
        // Restar descanso si tiene
        const descansoColab = colab?.tiene_descanso ? colab.horario_descanso : null
        if (descansoColab) {
          const [descEnt, descSal] = descansoColab.split(' - ')
          h = Math.max(0, h - diffH(descEnt?.trim(), descSal?.trim()))
        }
        horasTotales += h
        const extra = Math.max(0, h - JORNADA)
        horasExtra += extra
      }

      // Calcular tardanza con tolerancia
      // Verificar si ese día tiene horario especial
      const dow = ['D','L','M','X','J','V','S'][new Date(fecha + 'T12:00:00').getDay()]
      const horarioEsp = colab?.horarios_especiales?.[dow]
      const entradaDia = horarioEsp?.entrada || entradaPactada
      const limiteDia = horaLimite(entradaDia, TOLERANCIA_MIN)

      if (d.entrada > limiteDia) {
        tardanzas++
        const minsLate = horaAMin(d.entrada) - horaAMin(entradaDia)
        detalleTardanzas.push({ fecha, entrada: d.entrada, limite: limiteDia, minsLate })
      }
    }
  })

  // Ausencias — usando feriados si están disponibles
  const [y, m] = mes.split('-').map(Number)
  const diasMes = new Date(y, m, 0).getDate()
  let diasHabiles = 0
  for (let d = 1; d <= diasMes; d++) {
    const fecha = `${mes}-${String(d).padStart(2, '0')}`
    const dow = new Date(y, m - 1, d).getDay()
    if (dow === 0) continue // domingo
    // Si tiene feriados configurados, descontar días feriados
    if (feriados && configFeriados?.afecta_calculo && esFeriado(fecha, feriados, configFeriados)) continue
    diasHabiles++
  }
  const ausencias = Math.max(0, diasHabiles - diasTrabajados)

  // Cálculo de pago
  const valorDia = salario / 30
  const valorHora = valorDia / JORNADA
  const salarioBase = diasTrabajados * valorDia
  const primeras2h = Math.min(horasExtra, 2)
  const siguientesH = Math.max(0, horasExtra - 2)
  const costoExtra = primeras2h * valorHora * FACTOR_E1 + siguientesH * valorHora * FACTOR_E2

  // Adelantos del mes
  const adelantos = registros
    .filter(r => r.tipo === 'adelanto' && r.fecha?.startsWith(mes))
    .reduce((s, r) => s + (Number(r.monto) || 0), 0)

  // Descuentos
  const descTardanza = tardanzas * (valorHora * 0.5) // 30 min por tardanza
  const descAusencia = ausencias > diasHabiles * 0.5 ? 0 : ausencias * valorDia // solo si <50% de ausencias

  const totalBruto = salarioBase + costoExtra
  const totalDescuentos = descTardanza + adelantos
  const totalNeto = Math.max(0, totalBruto - totalDescuentos)

  // Puntos GPS del mes
  const gpsPoints = regsCheckin.filter(r => r.gpsLat)
  const fotosTomadas = regsCheckin.filter(r => r.foto).length

  return {
    diasTrabajados, diasHabiles, diasCampo, horasTotales, horasExtra,
    tardanzas, ausencias, gpsPoints, fotosTomadas,
    salarioBase, costoExtra, adelantos,
    descTardanza, totalBruto, totalDescuentos, totalNeto,
    porDia, detalleTardanzas,
    entradaPactada, limiteTardanza,
    pctAsistencia: diasHabiles > 0 ? Math.round(diasTrabajados / diasHabiles * 100) : 0,
  }
}

// ─── COMPONENTES AUXILIARES ───────────────────────────────────────────────────

function KpiCard({ icon, label, value, sub, color = T.verde, small = false }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14, padding: small ? '14px 16px' : '18px 20px',
      borderTop: `4px solid ${color}`, boxShadow: '0 2px 10px #00000012',
    }}>
      <div style={{ fontSize: small ? 22 : 28 }}>{icon}</div>
      <div style={{ fontSize: small ? 22 : 28, fontWeight: 900, color, marginTop: 4, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 13, color: T.gris, fontWeight: 700, marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: T.grisMid, marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

function BarraProgreso({ valor, max, color = T.verde, height = 8 }) {
  const pct = max > 0 ? Math.min(100, (valor / max) * 100) : 0
  return (
    <div style={{ height, background: '#eee', borderRadius: height, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: height, transition: 'width .6s ease' }} />
    </div>
  )
}

// ─── MINI MAPA GPS (Canvas) ───────────────────────────────────────────────────
function MiniMapaGPS({ puntos, width = 320, height = 200 }) {
  const ref = useRef()
  useEffect(() => {
    if (!ref.current || puntos.length === 0) return
    const canvas = ref.current
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, width, height)

    const lats = puntos.map(p => parseFloat(p.lat))
    const lngs = puntos.map(p => parseFloat(p.lng))
    const minLat = Math.min(...lats), maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
    const pad = 24

    const toX = lng => pad + (maxLng === minLng ? width / 2 : (lng - minLng) / (maxLng - minLng) * (width - pad * 2))
    const toY = lat => pad + (maxLat === minLat ? height / 2 : (maxLat - lat) / (maxLat - minLat) * (height - pad * 2))

    // Fondo
    ctx.fillStyle = '#E8F5E9'
    ctx.fillRect(0, 0, width, height)

    // Grid suave
    ctx.strokeStyle = '#C8E6C9'
    ctx.lineWidth = 1
    for (let i = 0; i <= 4; i++) {
      const x = pad + i * (width - pad * 2) / 4
      const y = pad + i * (height - pad * 2) / 4
      ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, height - pad); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(width - pad, y); ctx.stroke()
    }

    // Línea de ruta
    if (puntos.length > 1) {
      ctx.beginPath()
      ctx.strokeStyle = T.azul
      ctx.lineWidth = 2
      ctx.setLineDash([4, 3])
      puntos.forEach((p, i) => {
        const x = toX(parseFloat(p.lng)), y = toY(parseFloat(p.lat))
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      })
      ctx.stroke()
      ctx.setLineDash([])
    }

    // Puntos
    puntos.forEach((p, i) => {
      const x = toX(parseFloat(p.lng)), y = toY(parseFloat(p.lat))
      const isFirst = i === 0, isLast = i === puntos.length - 1
      const r = isFirst || isLast ? 8 : 5
      const color = isFirst ? T.verde : isLast ? T.rojo : T.azul

      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.stroke()

      // Label
      if (isFirst || isLast) {
        ctx.fillStyle = color
        ctx.font = 'bold 10px sans-serif'
        ctx.fillText(isFirst ? 'INICIO' : 'FIN', x + 10, y + 4)
      }

      // Hora
      if (p.hora) {
        ctx.fillStyle = '#555'
        ctx.font = '9px sans-serif'
        ctx.fillText(p.hora, x + 10, y + 15)
      }
    })

    // Distancia total
    if (puntos.length > 1) {
      let dist = 0
      for (let i = 1; i < puntos.length; i++) {
        dist += haversine(puntos[i - 1].lat, puntos[i - 1].lng, puntos[i].lat, puntos[i].lng)
      }
      ctx.fillStyle = T.verde
      ctx.font = 'bold 11px sans-serif'
      ctx.fillText(`${(dist * 1000).toFixed(0)} m recorridos`, 8, height - 6)
    }
  }, [puntos, width, height])

  if (puntos.length === 0) return (
    <div style={{ background: T.grisLight, borderRadius: 10, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.grisMid, fontSize: 13 }}>
      Sin puntos GPS registrados este mes
    </div>
  )

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: `2px solid ${T.verdeMid}` }}>
      <canvas ref={ref} width={width} height={height} style={{ display: 'block', width: '100%' }} />
    </div>
  )
}

// ─── PERFIL INDIVIDUAL DEL COLABORADOR ───────────────────────────────────────
function PerfilColab({ colab, metricas, registros, mes }) {
  const [tabActiva, setTabActiva] = useState('resumen')

  const tabs = [
    { k: 'resumen', label: '📊 Resumen' },
    { k: 'detalle', label: '📅 Día a día' },
    { k: 'mapa', label: '📍 Mapa GPS' },
    { k: 'fotos', label: '📸 Fotos' },
    { k: 'pago', label: '💰 Liquidación' },
  ]

  const checkins = registros.filter(r => r.tipo === 'checkin' && r.fecha?.startsWith(mes))
  const gpsPoints = checkins.filter(r => r.gpsLat)
  const fotos = checkins.filter(r => r.foto)

  return (
    <div>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t.k} onClick={() => setTabActiva(t.k)} style={{
            padding: '8px 14px', borderRadius: 9,
            border: `2px solid ${tabActiva === t.k ? T.verde : '#ddd'}`,
            background: tabActiva === t.k ? T.verdeLight : '#fff',
            fontWeight: tabActiva === t.k ? 800 : 400,
            color: tabActiva === t.k ? T.verde : T.gris,
            cursor: 'pointer', fontSize: 13,
          }}>{t.label}</button>
        ))}
      </div>

      {/* RESUMEN */}
      {tabActiva === 'resumen' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 12, marginBottom: 20 }}>
            <KpiCard icon="📅" label="Días trabajados" value={metricas.diasTrabajados} sub={`de ${metricas.diasHabiles} hábiles`} color={T.verde} small />
            <KpiCard icon="✅" label="Asistencia" value={`${metricas.pctAsistencia}%`} sub="del mes" color={metricas.pctAsistencia >= 90 ? T.verde : metricas.pctAsistencia >= 75 ? T.gold : T.rojo} small />
            <KpiCard icon="🕐" label="Horas trabajadas" value={metricas.horasTotales.toFixed(1) + 'h'} sub={`+${metricas.horasExtra.toFixed(1)}h extra`} color={T.azul} small />
            <KpiCard icon="⏰" label="Tardanzas" value={metricas.tardanzas} sub={`Límite: ${metricas.limiteTardanza} (+15 min)`} color={metricas.tardanzas === 0 ? T.verde : metricas.tardanzas <= 2 ? T.gold : T.rojo} small />
            <KpiCard icon="🚗" label="Días en campo" value={metricas.diasCampo} color={T.morado} small />
            <KpiCard icon="📍" label="Check-ins GPS" value={gpsPoints.length} color={T.morado} small />
            <KpiCard icon="📸" label="Fotos tomadas" value={fotos.length} color={T.azul} small />
          </div>

          {/* Barra de asistencia visual */}
          <Card style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 700, color: T.gris, marginBottom: 12, fontSize: 14 }}>Asistencia del mes</div>
            {feriados.length > 0 && configFeriados?.afecta_calculo && (
              <div style={{ fontSize: 11, color: '#888', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ background: '#E65100', color: '#fff', borderRadius: 4, padding: '1px 6px', fontSize: 10 }}>🎉</span> Feriado
                <span style={{ background: T.verde, color: '#fff', borderRadius: 4, padding: '1px 6px', fontSize: 10 }}>✅</span> Completo
                <span style={{ background: T.gold, color: '#fff', borderRadius: 4, padding: '1px 6px', fontSize: 10 }}>🕐</span> Solo entrada
                <span style={{ background: T.rojo, color: '#fff', borderRadius: 4, padding: '1px 6px', fontSize: 10 }}>❌</span> Ausente
              </div>
            )}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {Object.keys(metricas.porDia).sort().map(fecha => {
                const d = metricas.porDia[fecha]
                const feriadoInfo = infoFeriado(fecha, feriados, configFeriados)
                const esFer = !!feriadoInfo && configFeriados?.afecta_calculo
                const color = esFer ? '#E65100' : d.entrada && d.salida ? T.verde : d.entrada ? T.gold : T.rojo
                const icon = esFer ? '🎉' : d.entrada && d.salida ? '✅' : d.entrada ? '🕐' : d.campo ? '🚗' : '❌'
                const titulo = esFer
                  ? `${fmt(fecha)} — 🎉 ${feriadoInfo.nombre}`
                  : `${fmt(fecha)} — ${d.entrada || '—'} a ${d.salida || '—'}`
                return (
                  <div key={fecha} title={titulo}
                    style={{ width: 32, height: 32, borderRadius: 6, background: color + '22', border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'default' }}>
                    {icon}
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      )}

      {/* DETALLE DÍA A DÍA */}
      {tabActiva === 'detalle' && (
        <Card>
          <div style={{ fontSize:12, color:T.gris, marginBottom:10, padding:'8px 12px', background:T.verdeLight, borderRadius:8 }}>
            ⏰ Tolerancia: <b>15 minutos</b> · Hora pactada: <b>{metricas.entradaPactada}</b> · Tardanza si llega después de las <b>{metricas.limiteTardanza}</b>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: T.grisLight }}>
                  {['Fecha', 'Entrada', 'Salida', 'Horas', 'Extra', 'Tardanza', 'Tipo', 'GPS', 'Foto'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: T.gris, textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(metricas.porDia).sort(([a], [b]) => a.localeCompare(b)).map(([fecha, d]) => {
                  const horas = d.entrada && d.salida ? diffH(d.entrada, d.salida) : 0
                  const extra = Math.max(0, horas - JORNADA)
                  const regsDelDia = checkins.filter(r => r.fecha === fecha)
                  const tieneGPS = regsDelDia.some(r => r.gpsLat)
                  const tieneFoto = regsDelDia.some(r => r.foto)
                  const tardanzaDetalle = metricas.detalleTardanzas?.find(t => t.fecha === fecha)
                  return (
                    <tr key={fecha} style={{ borderBottom: '1px solid #f0f0f0', background: tardanzaDetalle ? '#FFF3E0' : '' }}>
                      <td style={{ padding: '9px 12px', fontWeight: 600 }}>{fmt(fecha)}</td>
                      <td style={{ padding: '9px 12px', color: tardanzaDetalle ? T.gold : T.verde, fontWeight: 700 }}>{d.entrada || '—'}</td>
                      <td style={{ padding: '9px 12px', color: T.rojo, fontWeight: 700 }}>{d.salida || '—'}</td>
                      <td style={{ padding: '9px 12px', fontWeight: 700 }}>{horas > 0 ? horas.toFixed(1) + 'h' : '—'}</td>
                      <td style={{ padding: '9px 12px', color: extra > 0 ? T.morado : T.grisMid, fontWeight: extra > 0 ? 700 : 400 }}>{extra > 0 ? `+${extra.toFixed(1)}h` : '—'}</td>
                      <td style={{ padding: '9px 12px' }}>
                        {tardanzaDetalle
                          ? <Badge label={`⏰ ${tardanzaDetalle.minsLate} min`} color={T.gold} bg={T.goldLight} />
                          : <span style={{ color: T.verde, fontWeight: 700, fontSize: 12 }}>✅</span>}
                      </td>
                      <td style={{ padding: '9px 12px' }}>{d.campo ? <Badge label="🚗 Campo" color={T.morado} /> : <Badge label="🏢 Oficina" color={T.azul} />}</td>
                      <td style={{ padding: '9px 12px' }}>{tieneGPS ? <Badge label="📍" color={T.verde} /> : '—'}</td>
                      <td style={{ padding: '9px 12px' }}>{tieneFoto ? <Badge label="📸" color={T.azul} /> : '—'}</td>
                    </tr>
                  )
                })}
                {Object.keys(metricas.porDia).length === 0 && (
                  <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', color: '#888' }}>Sin registros este mes</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* MAPA GPS */}
      {tabActiva === 'mapa' && (
        <div>
          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, color: T.morado, marginBottom: 14, fontSize: 15 }}>
              📍 Ubicaciones registradas este mes ({gpsPoints.length} puntos)
            </div>
            <MiniMapaGPS puntos={gpsPoints.map(r => ({ lat: r.gpsLat, lng: r.gpsLng, hora: r.hora, tipo: r.tipoMarca }))} width={600} height={280} />
          </Card>

          {/* Lista de puntos GPS */}
          <Card>
            <div style={{ fontWeight: 700, marginBottom: 12, color: T.gris }}>Detalle de puntos GPS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
              {gpsPoints.length === 0
                ? <div style={{ color: '#888', textAlign: 'center', padding: 24 }}>Sin puntos GPS registrados</div>
                : gpsPoints.sort((a, b) => a.timestamp?.localeCompare(b.timestamp || '') || 0).map((r, i) => (
                  <div key={r.id || i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 12px', background: T.grisLight, borderRadius: 9 }}>
                    <span style={{ fontSize: 18 }}>{r.tipoMarca === 'entrada' ? '🟢' : r.tipoMarca === 'salida' ? '🔴' : '🚗'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{r.tipoMarca?.toUpperCase()} — {r.hora} · {fmt(r.fecha)}</div>
                      <div style={{ fontFamily: 'monospace', fontSize: 11, color: T.morado }}>{r.gpsLat}, {r.gpsLng} · ±{r.gpsPrecision}m</div>
                    </div>
                    <a href={mapsUrl(r.gpsLat, r.gpsLng)} target="_blank" rel="noreferrer"
                      style={{ fontSize: 12, color: T.azul, whiteSpace: 'nowrap' }}>🗺️ Ver</a>
                  </div>
                ))}
            </div>
          </Card>
        </div>
      )}

      {/* FOTOS */}
      {tabActiva === 'fotos' && (
        <div>
          <div style={{ fontWeight: 700, color: T.gris, marginBottom: 14 }}>
            📸 Fotos de check-in ({fotos.length} registros con foto)
          </div>
          {fotos.length === 0
            ? <Card style={{ textAlign: 'center', padding: 32, color: '#888' }}>Sin fotos registradas este mes</Card>
            : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 14 }}>
                {fotos.sort((a, b) => a.timestamp?.localeCompare(b.timestamp || '') || 0).map((r, i) => (
                  <div key={r.id || i} style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px #0001', border: `2px solid ${r.tipoMarca === 'entrada' ? T.verde : r.tipoMarca === 'salida' ? T.rojo : T.morado}` }}>
                    <img src={r.foto} alt="selfie" style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }} />
                    <div style={{ padding: '8px 10px' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: r.tipoMarca === 'entrada' ? T.verde : r.tipoMarca === 'salida' ? T.rojo : T.morado }}>
                        {r.tipoMarca?.toUpperCase()}
                      </div>
                      <div style={{ fontSize: 11, color: '#888' }}>{r.hora} · {fmt(r.fecha)}</div>
                      {r.gpsLat && <div style={{ fontSize: 10, color: T.morado, marginTop: 2 }}>📍 GPS verificado</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
      )}

      {/* LIQUIDACIÓN */}
      {tabActiva === 'pago' && (
        <Card>
          <div style={{ fontWeight: 800, fontSize: 16, color: T.verde, marginBottom: 18 }}>
            💰 Liquidación — {colab.nombre}
          </div>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
            Régimen REMYPE Microempresa · Salario base: S/ {Number(colab.salario).toFixed(2)}/mes
          </div>

          {[
            { seccion: 'INGRESOS', rows: [] },
            { label: 'Salario base proporcional', detalle: `${metricas.diasTrabajados} días × S/ ${(Number(colab.salario) / 30).toFixed(2)}`, monto: metricas.salarioBase, positivo: true },
            { label: 'Horas extra (primeras 2h × 1.25)', detalle: `${Math.min(metricas.horasExtra, 2).toFixed(1)}h`, monto: Math.min(metricas.horasExtra, 2) * (Number(colab.salario) / 30 / JORNADA) * FACTOR_E1, positivo: true },
            { label: 'Horas extra (siguientes × 1.35)', detalle: `${Math.max(0, metricas.horasExtra - 2).toFixed(1)}h`, monto: Math.max(0, metricas.horasExtra - 2) * (Number(colab.salario) / 30 / JORNADA) * FACTOR_E2, positivo: true },
            { total: 'TOTAL BRUTO', monto: metricas.totalBruto },
            { separador: true },
            { seccion: 'DESCUENTOS', rows: [] },
            { label: 'Tardanzas', detalle: `${metricas.tardanzas} × 30 min`, monto: metricas.descTardanza, positivo: false },
            { label: 'Adelantos descontados', detalle: 'registrados en el mes', monto: metricas.adelantos, positivo: false },
            { total: 'TOTAL DESCUENTOS', monto: metricas.totalDescuentos },
            { separador: true },
            { totalFinal: 'NETO A PAGAR', monto: metricas.totalNeto },
          ].map((row, i) => {
            if (row.separador) return <div key={i} style={{ height: 12 }} />
            if (row.seccion) return (
              <div key={i} style={{ background: T.grisLight, borderRadius: 8, padding: '8px 14px', marginBottom: 8, fontWeight: 800, fontSize: 11, color: T.gris, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {row.seccion}
              </div>
            )
            if (row.total) return (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: T.goldLight, borderRadius: 8, marginBottom: 6, fontWeight: 800 }}>
                <span>{row.total}</span>
                <span style={{ color: T.gold }}>S/ {row.monto.toFixed(2)}</span>
              </div>
            )
            if (row.totalFinal) return (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 20px', background: T.verdeLight, borderRadius: 12, marginTop: 12, border: `2px solid ${T.verde}` }}>
                <span style={{ fontWeight: 900, fontSize: 16, color: T.verde }}>{row.totalFinal}</span>
                <span style={{ fontWeight: 900, fontSize: 24, color: T.verde }}>S/ {row.monto.toFixed(2)}</span>
              </div>
            )
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 14px', borderBottom: '1px solid #f5f5f5' }}>
                <div>
                  <div style={{ fontSize: 14 }}>{row.label}</div>
                  {row.detalle && <div style={{ fontSize: 11, color: '#888' }}>{row.detalle}</div>}
                </div>
                <div style={{ fontWeight: 700, color: row.positivo ? T.verde : row.monto > 0 ? T.rojo : T.grisMid }}>
                  {row.positivo ? '+' : row.monto > 0 ? '−' : ''}S/ {(row.monto || 0).toFixed(2)}
                </div>
              </div>
            )
          })}
        </Card>
      )}
    </div>
  )
}

// ─── DASHBOARD GENERAL ────────────────────────────────────────────────────────
function DashboardGeneral({ data, mes, colabsFiltrados, feriados = [], configFeriados = null }) {
  const metricas = useMemo(() =>
    colabsFiltrados.map(c => ({
      colab: c,
      m: calcularMetricasColab(data.registros.filter(r => r.colabId === c.id || r.colab_id === c.id), Number(c.salario) || 0, mes, c, feriados, configFeriados),
    })), [data, colabsFiltrados, mes, feriados])

  const totales = useMemo(() => ({
    diasPromedio: metricas.reduce((s, x) => s + x.m.diasTrabajados, 0) / Math.max(metricas.length, 1),
    pctAsistencia: metricas.reduce((s, x) => s + x.m.pctAsistencia, 0) / Math.max(metricas.length, 1),
    totalExtra: metricas.reduce((s, x) => s + x.m.horasExtra, 0),
    totalTardanzas: metricas.reduce((s, x) => s + x.m.tardanzas, 0),
    totalNeto: metricas.reduce((s, x) => s + x.m.totalNeto, 0),
    totalGPS: metricas.reduce((s, x) => s + (x.m.gpsPoints?.length || 0), 0),
  }), [metricas])

  const [y, m] = mes.split('-').map(Number)
  const mesLabel = new Date(y, m - 1, 1).toLocaleDateString('es-PE', { month: 'long', year: 'numeric' })

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 900, fontSize: 22, color: T.verde }}>Panel Gerente</div>
        <div style={{ fontSize: 14, color: '#888', textTransform: 'capitalize' }}>{mesLabel} · {colabsFiltrados.length} colaboradores</div>
      </div>

      {/* KPIs globales */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 14, marginBottom: 24 }}>
        <KpiCard icon="✅" label="Asistencia promedio" value={`${totales.pctAsistencia.toFixed(0)}%`} color={totales.pctAsistencia >= 85 ? T.verde : T.gold} />
        <KpiCard icon="⏱️" label="Horas extra totales" value={`${totales.totalExtra.toFixed(1)}h`} sub="del equipo en el mes" color={T.morado} />
        <KpiCard icon="⏰" label="Tardanzas totales" value={totales.totalTardanzas} color={totales.totalTardanzas === 0 ? T.verde : T.rojo} />
        <KpiCard icon="📍" label="Check-ins con GPS" value={totales.totalGPS} color={T.azul} />
        <KpiCard icon="💰" label="Total a pagar" value={`S/ ${totales.totalNeto.toFixed(0)}`} sub="suma de netos" color={T.verde} />
      </div>

      {/* Tabla comparativa del equipo */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: T.gris, marginBottom: 16 }}>Comparativa del equipo</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: T.verdeLight }}>
                {['Colaborador', 'Empresa', 'Asistencia', 'Días', 'Horas', 'Extra', 'Tardanzas', 'GPS', 'Neto a pagar'].map(h => (
                  <th key={h} style={{ padding: '11px 12px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: T.verde, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metricas.map(({ colab, m }) => (
                <tr key={colab.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '11px 12px', fontWeight: 700 }}>{colab.nombre}</td>
                  <td style={{ padding: '11px 12px', color: '#888', fontSize: 12 }}>{(colab.empresa||'').replace(' SAC', '')}</td>
                  <td style={{ padding: '11px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 700, color: m.pctAsistencia >= 90 ? T.verde : m.pctAsistencia >= 75 ? T.gold : T.rojo }}>{m.pctAsistencia}%</span>
                      <div style={{ flex: 1, minWidth: 60 }}><BarraProgreso valor={m.pctAsistencia} max={100} color={m.pctAsistencia >= 90 ? T.verde : m.pctAsistencia >= 75 ? T.gold : T.rojo} /></div>
                    </div>
                  </td>
                  <td style={{ padding: '11px 12px' }}>{m.diasTrabajados}/{m.diasHabiles}</td>
                  <td style={{ padding: '11px 12px' }}>{m.horasTotales.toFixed(1)}h</td>
                  <td style={{ padding: '11px 12px', color: m.horasExtra > 0 ? T.morado : T.grisMid, fontWeight: m.horasExtra > 0 ? 700 : 400 }}>
                    {m.horasExtra > 0 ? `+${m.horasExtra.toFixed(1)}h` : '—'}
                  </td>
                  <td style={{ padding: '11px 12px' }}>
                    <span style={{ color: m.tardanzas === 0 ? T.verde : m.tardanzas <= 2 ? T.gold : T.rojo, fontWeight: 700 }}>{m.tardanzas}</span>
                  </td>
                  <td style={{ padding: '11px 12px', color: T.morado }}>{m.gpsPoints?.length || 0}</td>
                  <td style={{ padding: '11px 12px', fontWeight: 800, color: T.verde }}>S/ {m.totalNeto.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: T.verdeLight, fontWeight: 900 }}>
                <td colSpan={8} style={{ padding: '12px 12px', color: T.verde }}>TOTAL A PAGAR</td>
                <td style={{ padding: '12px 12px', color: T.verde, fontSize: 16 }}>S/ {totales.totalNeto.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* Alertas */}
      {(metricas.some(x => x.m.tardanzas >= 3) || metricas.some(x => x.m.pctAsistencia < 75)) && (
        <Card style={{ borderLeft: `5px solid ${T.rojo}` }}>
          <div style={{ fontWeight: 800, color: T.rojo, marginBottom: 12 }}>⚠️ Alertas del mes</div>
          {metricas.filter(x => x.m.tardanzas >= 3).map(({ colab, m }) => (
            <div key={colab.id} style={{ background: T.rojoLight, borderRadius: 8, padding: '8px 14px', marginBottom: 8, fontSize: 13 }}>
              <b>{colab.nombre}</b> — {m.tardanzas} tardanzas este mes (≥3 = amonestación según reglamento)
            </div>
          ))}
          {metricas.filter(x => x.m.pctAsistencia < 75).map(({ colab, m }) => (
            <div key={colab.id} style={{ background: T.goldLight, borderRadius: 8, padding: '8px 14px', marginBottom: 8, fontSize: 13 }}>
              <b>{colab.nombre}</b> — solo {m.pctAsistencia}% de asistencia este mes
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}

// ─── PANEL GERENTE PRINCIPAL ──────────────────────────────────────────────────
export function PanelGerente({ data, mes, save, toast_, onSalir, addColaborador, removeColaborador, mesFiltro, setMesFiltro, empresas = [], onEmpresasChange }) {
  const [subView, setSubView] = useState('menu')
  const [colabSelId, setColabSelId] = useState(null)
  const [empresaFiltro, setEmpresaFiltro] = useState('todas')
  const [cambiandoPin, setCambiandoPin] = useState(false)
  const [pinNuevo, setPinNuevo] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [nuevaEmpresa, setNuevaEmpresa] = useState('')
  const [editandoEmpresas, setEditandoEmpresas] = useState([...empresas])
  const [feriados, setFeriados] = useState([])
  const [configFeriados, setConfigFeriados] = useState({ afecta_calculo: true, sector: 'privado', incluir_tipo_publico: false })

  // Cargar feriados al montar
  useEffect(() => {
    Promise.all([getFeriados(), getConfigFeriados()]).then(([f, c]) => {
      setFeriados(f)
      setConfigFeriados(c)
    })
  }, [])

  // Resetear cuando cambian las empresas del tenant activo
  useEffect(() => {
    setEditandoEmpresas([...empresas])
  }, [JSON.stringify(empresas)])

  const colabsFiltrados = data.colaboradores.filter(c =>
    empresaFiltro === 'todas' || c.empresa === empresaFiltro
  )
  const colabSel = data.colaboradores.find(c => c.id === colabSelId)

  const [y, m] = mes.split('-').map(Number)
  const mesLabel = new Date(y, m - 1, 1).toLocaleDateString('es-PE', { month: 'long', year: 'numeric' })

  return (
    <div style={{ minHeight: '100vh', background: '#1A1A2E' }}>
      {/* HEADER COMPACTO */}
      <div style={{ background: '#0D0D1A', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 14px #0008', position: 'sticky', top: 0, zIndex: 200, gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>👔</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: '#fff', fontWeight: 900, fontSize: 13 }}>PANEL GERENTE</div>
            <div style={{ color: '#aaa', fontSize: 9, textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mesLabel}</div>
          </div>
        </div>
        {/* Controles — siempre visibles, sin overflow */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          {empresas.length > 1 && (
            <select value={empresaFiltro} onChange={e => setEmpresaFiltro(e.target.value)}
              style={{ fontSize: 10, padding: '4px 6px', borderRadius: 6, border: 'none', background: '#333', color: '#fff', maxWidth: 80 }}>
              <option value="todas">Todas</option>
              {empresas.map(e => <option key={e} value={e}>{e.replace(' SAC','').replace(' S.A.C.','').replace('Mega ','')}</option>)}
            </select>
          )}
          {setMesFiltro && (
            <input type="month" value={mesFiltro || mes} onChange={e => setMesFiltro(e.target.value)}
              style={{ fontSize: 10, padding: '4px 6px', borderRadius: 6, border: 'none', background: '#333', color: '#fff', maxWidth: 110 }} />
          )}
          {subView !== 'menu' && (
            <button onClick={() => setSubView('menu')}
              style={{ background: '#333', border: 'none', borderRadius: 7, color: '#fff', padding: '6px 10px', cursor: 'pointer', fontSize: 11, whiteSpace: 'nowrap', flexShrink: 0 }}>
              ☰
            </button>
          )}
          <button onClick={() => { cerrarSession(); onSalir() }}
            style={{ background: T.rojo, color: '#fff', border: 'none', borderRadius: 7, padding: '7px 10px', cursor: 'pointer', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
            🔒
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '20px 16px' }}>

        {/* MENÚ PRINCIPAL — cuadrícula de botones grandes */}
        {subView === 'menu' && (
          <div style={{ animation: 'slideUp .3s ease' }}>
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{ fontSize: 48 }}>👔</div>
              <div style={{ color: '#fff', fontWeight: 900, fontSize: 22, marginTop: 8 }}>Panel Gerente</div>
              <div style={{ color: '#aaa', fontSize: 13, marginTop: 4, textTransform: 'capitalize' }}>{mesLabel}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[
                { k: 'dashboard',      icon: '📊', label: 'Dashboard',       sub: 'KPIs y resumen',         color: T.verde,   bg: '#1B4332' },
                { k: 'colaboradores',  icon: '👤', label: 'Por colaborador', sub: 'Detalle individual',      color: T.azul,    bg: '#0D1F47' },
                { k: 'equipo',         icon: '👥', label: 'Equipo',          sub: 'Agregar y gestionar',     color: '#00BCD4', bg: '#003040' },
                { k: 'historial',      icon: '📋', label: 'Historial',       sub: 'Todas las marcaciones',   color: T.morado,  bg: '#2D0045' },
                { k: 'fotochecks',     icon: '🪪', label: 'Fotochecks',      sub: 'Códigos QR e imprimir',   color: T.gold,    bg: '#3D1500' },
                { k: 'feriados',       icon: '📅', label: 'Feriados',         sub: 'Días feriados del año',   color: '#E65100', bg: '#2D0E00' },
                { k: 'ajustes',        icon: '⚙️', label: 'Ajustes',         sub: 'PIN y configuración',     color: '#78909C', bg: '#1C2B30' },
              ].map(n => (
                <button key={n.k} onClick={() => setSubView(n.k)}
                  style={{ background: n.bg, border: `2px solid ${n.color}44`, borderRadius: 18, padding: '22px 16px', cursor: 'pointer', textAlign: 'left', WebkitTapHighlightColor: 'transparent', transition: 'transform .1s' }}
                  onTouchStart={e => e.currentTarget.style.transform = 'scale(0.96)'}
                  onTouchEnd={e => e.currentTarget.style.transform = 'scale(1)'}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>{n.icon}</div>
                  <div style={{ color: '#fff', fontWeight: 800, fontSize: 16, marginBottom: 4 }}>{n.label}</div>
                  <div style={{ color: '#aaa', fontSize: 12 }}>{n.sub}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* BREADCRUMB cuando hay una sección activa */}
        {subView !== 'menu' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <BtnVolver onClick={() => setSubView('menu')} label="← Menú" color="#1A1A2E" />
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>
              {{ dashboard: '📊 Dashboard', colaboradores: '👤 Por colaborador', equipo: '👥 Equipo', historial: '📋 Historial', fotochecks: '🪪 Fotochecks', feriados: '📅 Feriados', ajustes: '⚙️ Ajustes' }[subView]}
            </div>
          </div>
        )}

        {/* DASHBOARD */}
        {subView === 'dashboard' && (
          <div style={{ background: '#F0F4F8', borderRadius: 16, padding: 20 }}>
            <DashboardGeneral data={data} mes={mesFiltro||mes} colabsFiltrados={colabsFiltrados} feriados={feriados} configFeriados={configFeriados} />
          </div>
        )}

        {/* POR COLABORADOR */}
        {subView === 'colaboradores' && (
          <div style={{ background: '#F0F4F8', borderRadius: 16, padding: 20 }}>
            {!colabSel ? (
              <div>
                <div style={{ fontWeight: 900, fontSize: 20, color: T.negro, marginBottom: 20 }}>👤 Selecciona un colaborador</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
                  {colabsFiltrados.map(c => {
                    const m = calcularMetricasColab(data.registros.filter(r => r.colabId === c.id || r.colab_id === c.id), Number(c.salario) || 0, mes, c, feriados, configFeriados)
                    return (
                      <button key={c.id} onClick={() => setColabSelId(c.id)}
                        style={{ background: '#fff', borderRadius: 14, padding: 20, border: `2px solid #eee`, cursor: 'pointer', textAlign: 'left', transition: 'all .15s', boxShadow: '0 2px 8px #0001' }}
                        onMouseOver={e => e.currentTarget.style.borderColor = T.verde}
                        onMouseOut={e => e.currentTarget.style.borderColor = '#eee'}>
                        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>{c.nombre}</div>
                        <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>{c.cargo} · {c.empresa.replace(' SAC', '')}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                          <div style={{ textAlign: 'center', background: T.verdeLight, borderRadius: 8, padding: '8px 4px' }}>
                            <div style={{ fontWeight: 900, color: T.verde, fontSize: 18 }}>{m.pctAsistencia}%</div>
                            <div style={{ fontSize: 10, color: '#888' }}>Asistencia</div>
                          </div>
                          <div style={{ textAlign: 'center', background: m.tardanzas > 0 ? T.rojoLight : T.verdeLight, borderRadius: 8, padding: '8px 4px' }}>
                            <div style={{ fontWeight: 900, color: m.tardanzas > 0 ? T.rojo : T.verde, fontSize: 18 }}>{m.tardanzas}</div>
                            <div style={{ fontSize: 10, color: '#888' }}>Tardanzas</div>
                          </div>
                          <div style={{ textAlign: 'center', background: T.verdeLight, borderRadius: 8, padding: '8px 4px' }}>
                            <div style={{ fontWeight: 900, color: T.verde, fontSize: 15 }}>S/{m.totalNeto.toFixed(0)}</div>
                            <div style={{ fontSize: 10, color: '#888' }}>Neto</div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                  <BtnVolver onClick={() => setColabSelId(null)} label="← Equipo" />
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 18 }}>{colabSel.nombre}</div>
                    <div style={{ fontSize: 13, color: '#888' }}>{colabSel.cargo} · {colabSel.empresa}</div>
                  </div>
                </div>
                <PerfilColab
                  colab={colabSel}
                  metricas={calcularMetricasColab(data.registros.filter(r => r.colabId === colabSel.id || r.colab_id === colabSel.id), Number(colabSel.salario) || 0, mes, colabSel, feriados, configFeriados)}
                  registros={data.registros.filter(r => r.colabId === colabSel.id)}
                  mes={mes}
                />
              </div>
            )}
          </div>
        )}

        {/* AJUSTES */}
        {/* HISTORIAL */}
        {subView === 'historial' && (
          <div>
            <div style={{ fontWeight:900, fontSize:20, marginBottom:20 }}>📋 Historial de marcaciones</div>
            {data.registros.filter(r=>r.tipo==='checkin'&&r.fecha?.startsWith(mesFiltro||mes)).length===0 ? (
              <Card style={{ textAlign:'center', padding:40, color:'#888' }}>Sin marcaciones en este período.</Card>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {data.registros.filter(r=>r.tipo==='checkin'&&r.fecha?.startsWith(mesFiltro||mes))
                  .sort((a,b)=>(b.timestamp||'').localeCompare(a.timestamp||''))
                  .map(r => {
                    const colab = data.colaboradores.find(c=>c.id===(r.colab_id||r.colabId))
                    const tm = r.tipo_marca||r.tipoMarca
                    const color = tm==='entrada'?T.verde:tm==='salida'?T.rojo:T.morado
                    return (
                      <Card key={r.id} style={{ borderLeft:`4px solid ${color}`, padding:'14px 18px' }}>
                        <div style={{ display:'flex', gap:14, alignItems:'center', flexWrap:'wrap' }}>
                          <div style={{ width:52, height:52, borderRadius:10, overflow:'hidden', background:T.grisLight, flexShrink:0, border:`2px solid ${color}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                            {r.foto?<img src={r.foto} alt="selfie" style={{ width:'100%', height:'100%', objectFit:'cover' }} />:<span style={{ fontSize:22 }}>👤</span>}
                          </div>
                          <div style={{ flex:1 }}>
                            <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', marginBottom:4 }}>
                              <span style={{ fontWeight:800, fontSize:15 }}>{colab?.nombre||'—'}</span>
                              <Badge label={(tm||'').toUpperCase()} color={color} />
                              <Badge label={
                                r.metodo==='GPS+Selfie'?'📍 GPS':
                                r.metodo==='PIN'?'🔐 PIN':
                                r.metodo==='QR'?'📷 QR':'📋'
                              } color={T.azul} bg={T.azulLight} />
                              {r.foto && <Badge label="📸" color={T.verde} bg={T.verdeLight} />}
                            </div>
                            <div style={{ fontSize:13, color:T.gris }}>
                              🕐 {r.hora} · {fmt(r.fecha)}
                              {(r.gpsLat||r.gps_lat)&&<span style={{ marginLeft:10 }}><a href={mapsUrl(r.gpsLat||r.gps_lat,r.gpsLng||r.gps_lng)} target="_blank" rel="noreferrer" style={{ color:T.azul, fontSize:12 }}>📍 Ver GPS</a></span>}
                            </div>
                          </div>
                        </div>
                      </Card>
                    )
                  })}
              </div>
            )}
          </div>
        )}

        {/* FOTOCHECKS */}
        {subView === 'fotochecks' && (
          <div>
            <div style={{ fontWeight:900, fontSize:20, marginBottom:20 }}>🪪 Fotochecks y Códigos QR</div>
            {data.colaboradores.length===0
              ? <Card style={{ textAlign:'center', padding:48, color:'#888' }}>Sin colaboradores.</Card>
              : <PanelFotocheck colaboradores={data.colaboradores} />
            }
          </div>
        )}

        {/* EQUIPO */}
        {subView === 'equipo' && (
          <div style={{ background: '#F0F4F8', borderRadius: 16, padding: 20 }}>
            {addColaborador
              ? <PanelEquipo colaboradores={data.colaboradores} onAdd={addColaborador} onDelete={removeColaborador} toast_={toast_} empresas={empresas} />
              : <div style={{ color:'#888', textAlign:'center', padding:40 }}>No disponible.</div>
            }
          </div>
        )}

        {/* FERIADOS */}
        {subView === 'feriados' && (
          <div style={{ background: '#F0F4F8', borderRadius: 16, padding: 20 }}>
            <PanelFeriados toast_={toast_} />
          </div>
        )}

        {/* AJUSTES */}
        {subView === 'ajustes' && (
          <div>
            <div style={{ fontWeight: 900, fontSize: 20, color: T.negro, marginBottom: 20 }}>⚙️ Ajustes del panel</div>

            {/* GESTIÓN DE EMPRESAS */}
            <Card style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, color: T.verde, marginBottom: 4, fontSize: 15 }}>🏢 Empresas registradas</div>
              <div style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
                Estas son las empresas que aparecen al registrar colaboradores y al seleccionar empresa en el celular.
              </div>

              {/* Lista de empresas actuales */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                {(editandoEmpresas.length > 0 ? editandoEmpresas : empresas).map((emp, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 14px', background: T.verdeLight, borderRadius: 10, border: `1px solid ${T.verde}33` }}>
                    <span style={{ fontSize: 16 }}>🏢</span>
                    <span style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{emp}</span>
                    <button onClick={() => {
                      const nueva = editandoEmpresas.filter((_, j) => j !== i)
                      setEditandoEmpresas(nueva)
                    }} style={{ background: T.rojoLight, color: T.rojo, border: 'none', borderRadius: 7, padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>✕</button>
                  </div>
                ))}
                {(editandoEmpresas.length > 0 ? editandoEmpresas : empresas).length === 0 && (
                  <div style={{ textAlign: 'center', padding: 20, color: '#888', fontSize: 13 }}>Sin empresas registradas</div>
                )}
              </div>

              {/* Agregar nueva empresa */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <Inp value={nuevaEmpresa} onChange={setNuevaEmpresa} placeholder="Ej. Mi Empresa SAC" />
                <Btn color={T.verde} onClick={() => {
                  if (!nuevaEmpresa.trim()) return
                  if (editandoEmpresas.includes(nuevaEmpresa.trim())) return toast_('Esa empresa ya existe', 'err')
                  setEditandoEmpresas([...editandoEmpresas, nuevaEmpresa.trim()])
                  setNuevaEmpresa('')
                }}>+ Agregar</Btn>
              </div>

              <Btn full color={T.verde} onClick={async () => {
                if (editandoEmpresas.length === 0) return toast_('Agrega al menos una empresa', 'err')
                await onEmpresasChange(editandoEmpresas)
                toast_('✅ Empresas actualizadas en todos los dispositivos')
              }}>💾 Guardar empresas</Btn>

              <div style={{ marginTop: 10, fontSize: 12, color: '#888' }}>
                Los cambios se sincronizan en todos los celulares al recargar la app.
              </div>
            </Card>

            {/* PIN */}
            <Card style={{ maxWidth: 440 }}>
              <div style={{ fontWeight: 700, color: T.gris, marginBottom: 16 }}>🔑 Cambiar PIN de acceso al panel gerente</div>
              <Field label="PIN nuevo (4 dígitos)">
                <Inp type="password" value={pinNuevo} onChange={setPinNuevo} placeholder="••••" style={{ letterSpacing: 8, fontSize: 22, textAlign: 'center' }} />
              </Field>
              <Field label="Confirmar PIN">
                <Inp type="password" value={pinConfirm} onChange={setPinConfirm} placeholder="••••" style={{ letterSpacing: 8, fontSize: 22, textAlign: 'center' }} />
              </Field>
              <Btn color={T.verde} onClick={async () => {
                if (pinNuevo.length !== 4 || !/^\d+$/.test(pinNuevo)) return toast_('El PIN debe ser exactamente 4 dígitos numéricos', 'err')
                if (pinNuevo !== pinConfirm) return toast_('Los PINs no coinciden', 'err')
                await setPinAsync(pinNuevo)
                setPinNuevo(''); setPinConfirm('')
                toast_('PIN actualizado y sincronizado en todos los dispositivos')
              }}>Guardar nuevo PIN</Btn>

              <Divider />
              <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
                <div style={{ fontWeight: 700, color: T.gris, marginBottom: 8 }}>ℹ️ Información del sistema</div>
                <div>Versión: Mega Asistencia v3.0</div>
                <div>Colaboradores registrados: {data.colaboradores.length}</div>
                <div>Total registros: {data.registros.length}</div>
                <div>☁️ Datos sincronizados vía Supabase</div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── LOGIN GERENTE ────────────────────────────────────────────────────────────
export function LoginGerente({ onEntrar, onVolver }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [intentos, setIntentos] = useState(0)
  const [cargandoPin, setCargandoPin] = useState(true)

  // Cargar PIN desde la nube al abrir la pantalla
  useEffect(() => {
    getPinAsync().then(() => setCargandoPin(false))
  }, [])

  const verificarPin = async (pinIngresado) => {
    // Verificar contra el PIN actual (ya sincronizado desde la nube)
    const pinCorrecto = getPin()
    if (pinIngresado === pinCorrecto) {
      abrirSession()
      onEntrar()
    } else {
      const i = intentos + 1
      setIntentos(i)
      setError(i >= 3
        ? `PIN incorrecto (${i} intentos). Si olvidaste el PIN contacta al administrador principal.`
        : 'PIN incorrecto. Inténtalo de nuevo.')
      setPin('')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: T.negro, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#1a1a1a', borderRadius: 20, padding: 40, maxWidth: 340, width: '100%', boxShadow: '0 8px 40px #000a', textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>👔</div>
        <div style={{ color: '#fff', fontWeight: 900, fontSize: 22, marginBottom: 4 }}>Panel Gerente</div>
        <div style={{ color: '#888', fontSize: 13, marginBottom: 28 }}>Mega Aventura & Mega Sostenible</div>

        {cargandoPin ? (
          <div style={{ color: '#888', fontSize: 13, margin: '20px 0' }}>
            <div style={{ width: 32, height: 32, border: '3px solid #333', borderTopColor: T.verde, borderRadius: '50%', animation: 'spin 0.9s linear infinite', margin: '0 auto 10px' }} />
            Sincronizando PIN...
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 20 }}>
              {[0, 1, 2, 3].map(i => (
                <div key={i} style={{ width: 20, height: 20, borderRadius: '50%', background: i < pin.length ? T.verde : '#333', border: `2px solid ${i < pin.length ? T.verde : '#555'}`, transition: 'all .15s' }} />
              ))}
            </div>

            {/* Teclado numérico */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, '←'].map((n, i) => (
                <button key={i} onClick={() => {
                  if (n === null) return
                  if (n === '←') { setPin(p => p.slice(0, -1)); setError('') }
                  else if (pin.length < 4) {
                    const np = pin + n
                    setPin(np); setError('')
                    if (np.length === 4) setTimeout(() => verificarPin(np), 150)
                  }
                }} style={{
                  background: n === null ? 'transparent' : '#2a2a2a',
                  color: '#fff', border: 'none', borderRadius: 12,
                  padding: '18px 0', fontSize: n === '←' ? 20 : 22,
                  fontWeight: 700, cursor: n === null ? 'default' : 'pointer',
                  transition: 'background .1s',
                }}
                  onMouseDown={e => n !== null && (e.currentTarget.style.background = T.verde)}
                  onMouseUp={e => n !== null && (e.currentTarget.style.background = '#2a2a2a')}
                  onTouchStart={e => n !== null && (e.currentTarget.style.background = T.verde)}
                  onTouchEnd={e => n !== null && (e.currentTarget.style.background = '#2a2a2a')}
                >{n === null ? '' : n}</button>
              ))}
            </div>

            {error && <div style={{ background: '#2a0000', color: '#ff6b6b', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 }}>{error}</div>}
          </>
        )}

        <button onClick={onVolver} style={{ background: '#222', border: '2px solid #444', color: '#aaa', cursor: 'pointer', fontSize: 15, fontWeight: 700, borderRadius: 12, padding: '14px 24px', marginTop: 16, width: '100%', minHeight: 52 }}>
          ← Volver a la app
        </button>
        <div style={{ color: '#444', fontSize: 11, marginTop: 8 }}>PIN por defecto: 1234<br />Se sincroniza entre todos los dispositivos</div>
      </div>
    </div>
  )
}

export { sessionValida, cerrarSession }
