export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()

  const dni = req.query.dni
  if (!dni || !/^\d{8}$/.test(dni)) {
    return res.status(400).json({ error: 'DNI inválido — debe tener 8 dígitos' })
  }

  const token = process.env.VITE_RENIEC_TOKEN
  if (!token) {
    return res.status(500).json({ error: 'Token no configurado en Vercel' })
  }

  // Detectar proveedor por formato del token
  // apis.net.pe  → empieza con "apis_"
  // apisperu.com → empieza con "eyJ" (JWT) o cualquier otro formato
  // sk_          → apis.net.pe nuevo formato

  let url, headers

  if (token.startsWith('eyJ')) {
    // APIsPERU (JWT)
    url = `https://dniruc.apisperu.com/api/v1/dni/${dni}?token=${token}`
    headers = { 'Accept': 'application/json' }
  } else {
    // apis.net.pe (Bearer token) — formato apis_ o sk_
    url = `https://api.apis.net.pe/v2/reniec/dni?numero=${dni}`
    headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    }
  }

  try {
    const response = await fetch(url, { headers })
    const data = await response.json()

    if (!response.ok) {
      const msg = response.status === 404
        ? 'DNI no encontrado en RENIEC. Ingresa el nombre manualmente.'
        : data.message || data.error || `Error ${response.status} del proveedor RENIEC`
      return res.status(response.status).json({ error: msg })
    }

    // Normalizar respuesta según proveedor
    let nombre = ''
    if (data.nombreCompleto) {
      nombre = data.nombreCompleto
    } else if (data.nombres) {
      nombre = `${data.nombres} ${data.apellidoPaterno || ''} ${data.apellidoMaterno || ''}`.trim()
    } else if (data.nombre) {
      nombre = data.nombre
    } else {
      return res.status(404).json({ error: 'DNI no encontrado o sin datos' })
    }

    return res.status(200).json({ nombre, dni: data.numeroDocumento || data.dni || dni })

  } catch (e) {
    return res.status(500).json({ error: 'Error de conexión con RENIEC: ' + e.message })
  }
}
