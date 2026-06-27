/**
 * useGPS.js — Hook para obtener ubicación GPS del dispositivo
 */
import { useState, useCallback } from 'react'

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
            lat: Math.round(pos.coords.latitude * 1e6) / 1e6,
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

export function mapsUrl(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}`
}
