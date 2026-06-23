import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * useGPS — hook para captura de ubicación puntual y seguimiento continuo
 *
 * Retorna:
 *  - getOnce()        → Promise<{lat,lng,precision,ts}>  (captura puntual)
 *  - startWatch()     → inicia seguimiento continuo
 *  - stopWatch()      → detiene seguimiento
 *  - watching         → boolean
 *  - lastPos          → {lat,lng,precision,ts} | null
 *  - trail            → array de posiciones (historial de la sesión)
 *  - error            → string | null
 */
export function useGPS() {
  const [watching, setWatching] = useState(false)
  const [lastPos, setLastPos] = useState(null)
  const [trail, setTrail] = useState([])
  const [error, setError] = useState(null)
  const watchId = useRef(null)

  const parsePos = (pos) => ({
    lat: pos.coords.latitude.toFixed(6),
    lng: pos.coords.longitude.toFixed(6),
    precision: Math.round(pos.coords.accuracy),
    altitud: pos.coords.altitude ? pos.coords.altitude.toFixed(1) : null,
    velocidad: pos.coords.speed ? (pos.coords.speed * 3.6).toFixed(1) : null, // km/h
    ts: new Date().toISOString(),
  })

  const getOnce = useCallback(() => new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('GPS no disponible en este dispositivo')); return }
    navigator.geolocation.getCurrentPosition(
      pos => resolve(parsePos(pos)),
      err => reject(new Error(gpsErrMsg(err))),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }), [])

  const startWatch = useCallback(() => {
    if (!navigator.geolocation) { setError('GPS no disponible'); return }
    if (watchId.current !== null) return
    setError(null)
    setWatching(true)
    watchId.current = navigator.geolocation.watchPosition(
      pos => {
        const p = parsePos(pos)
        setLastPos(p)
        setTrail(prev => {
          // Agregar solo si se movió más de 10m o es la primera
          if (prev.length === 0) return [p]
          const last = prev[prev.length - 1]
          const dist = haversine(last.lat, last.lng, p.lat, p.lng)
          return dist > 0.01 ? [...prev, p] : prev // 0.01 km = 10m
        })
      },
      err => { setError(gpsErrMsg(err)) },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    )
  }, [])

  const stopWatch = useCallback(() => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current)
      watchId.current = null
    }
    setWatching(false)
  }, [])

  useEffect(() => () => stopWatch(), [])

  return { getOnce, startWatch, stopWatch, watching, lastPos, trail, error, setError }
}

// Distancia en km entre dos puntos GPS (Haversine)
export function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function gpsErrMsg(err) {
  if (err.code === 1) return 'Permiso de ubicación denegado. Ve a Ajustes > Permisos > Ubicación y actívala para esta app.'
  if (err.code === 2) return 'No se pudo determinar la ubicación. Activa el GPS y verifica la señal.'
  if (err.code === 3) return 'Tiempo agotado obteniendo ubicación. Inténtalo en un lugar más abierto.'
  return 'Error de GPS: ' + err.message
}

export const mapsUrl = (lat, lng) => `https://maps.google.com/?q=${lat},${lng}`
