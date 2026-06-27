/**
 * useGPS.js — Hook GPS + utilidades de ubicación
 * Exporta: useGPS, mapsUrl, haversine
 */
import { useState, useCallback } from 'react'

// ─── HOOK ─────────────────────────────────────────────────────────────────────
export function useGPS() {
  const [error, setError] = useState(null)
  const setError_ = useCallback((msg) => setError(msg), [])

  const getOnce = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const err = 'GPS no disponible en este dispositivo'
        setError(err); reject(new Error(err)); return
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setError(null)
          resolve({
            lat: Math.round(pos.coords.latitude  * 1e6) / 1e6,
            lng: Math.round(pos.coords.longitude * 1e6) / 1e6,
            precision: Math.round(pos.coords.accuracy),
          })
        },
        (err) => {
          const msg = err.code === 1 ? 'Permiso GPS denegado. Actívalo en configuración del navegador.'
                    : err.code === 2 ? 'No se pudo obtener la ubicación. Verifica el GPS.'
                    : 'Tiempo de espera GPS agotado. Intenta en campo abierto.'
          setError(msg); reject(new Error(msg))
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      )
    })
  }, [])

  return { getOnce, error, setError: setError_ }
}

// ─── URL DE MAPS ───────────────────────────────────────────────────────────────
export function mapsUrl(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}`
}

// ─── DISTANCIA ENTRE DOS PUNTOS GPS (metros) ──────────────────────────────────
export function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000 // radio de la Tierra en metros
  const toRad = deg => deg * Math.PI / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
