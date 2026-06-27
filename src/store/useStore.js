import { useState, useEffect, useCallback } from 'react'
import {
  fetchEvents, upsertEvent, deleteEventDB,
  fetchTemplates, upsertTemplate, deleteTemplateDB,
  fetchWALogs
} from '../lib/db'

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

const defaultConfig = {
  empresa: 'Mega Sostenible SAC',
  ruc: '',
  wa: '',
  moneda: 'S/',
  diasAnticipacion: 3,
  alarma: true,
  push: true,
  anticipar: true,
}

function loadConfig() {
  try {
    const c = localStorage.getItem('megaagenda_config')
    return c ? { ...defaultConfig, ...JSON.parse(c) } : defaultConfig
  } catch { return defaultConfig }
}

function saveConfig(cfg) {
  try { localStorage.setItem('megaagenda_config', JSON.stringify(cfg)) } catch {}
}

export function useStore() {
  const [events, setEvents]       = useState([])
  const [templates, setTemplates] = useState([])
  const [waLogs, setWaLogs]       = useState([])
  const [config, setConfig]       = useState(loadConfig)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)

  // ── Initial load from Supabase ──
  useEffect(() => {
    async function loadAll() {
      try {
        setLoading(true)
        const [evs, tpls, logs] = await Promise.all([
          fetchEvents(),
          fetchTemplates(),
          fetchWALogs(),
        ])
        setEvents(evs.map(normalizeEvent))
        setTemplates(tpls.map(normalizeTpl))
        setWaLogs(logs)
      } catch (e) {
        setError('Error conectando con Supabase: ' + e.message)
      } finally {
        setLoading(false)
      }
    }
    loadAll()
  }, [])

  // ── Normalize DB row → app shape ──
  function normalizeEvent(row) {
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      date: row.date,
      time: row.time || '09:00',
      amount: Number(row.amount) || 0,
      currency: row.currency || 'S/',
      contact: row.contact || '',
      phone: row.phone || '',
      recurrence: row.recurrence || 'none',
      alarm: row.alarm !== false,
      status: row.status || 'pending',
      notes: row.notes || '',
      history: Array.isArray(row.history) ? row.history : [],
      createdAt: row.created_at,
    }
  }

  function normalizeTpl(row) {
    return {
      id: row.id,
      name: row.name,
      body: row.body,
      filterType: row.filter_type || 'todos',
    }
  }

  // ── EVENTS ──
  const addEvent = useCallback(async (ev) => {
    const newEv = { ...ev, id: uid(), createdAt: new Date().toISOString(), history: [] }
    setEvents(s => [...s, newEv])
    try { await upsertEvent(newEv) } catch (e) { setError(e.message) }
  }, [])

  const updateEvent = useCallback(async (id, updates) => {
    setEvents(s => s.map(e => e.id === id ? { ...e, ...updates } : e))
    const updated = events.find(e => e.id === id)
    if (updated) {
      try { await upsertEvent({ ...updated, ...updates }) } catch (e) { setError(e.message) }
    }
  }, [events])

  const deleteEvent = useCallback(async (id) => {
    setEvents(s => s.filter(e => e.id !== id))
    try { await deleteEventDB(id) } catch (e) { setError(e.message) }
  }, [])

  const completeEvent = useCallback(async (id, note = '') => {
    const histEntry = { date: new Date().toLocaleDateString('es-PE'), action: 'Completado', note }
    setEvents(s => s.map(e => e.id === id
      ? { ...e, status: 'completed', history: [...(e.history || []), histEntry] }
      : e
    ))
    const ev = events.find(e => e.id === id)
    if (ev) {
      const updated = { ...ev, status: 'completed', history: [...(ev.history || []), histEntry] }
      try { await upsertEvent(updated) } catch (e) { setError(e.message) }
    }
  }, [events])

  const reprogramEvent = useCallback(async (id, newDate, note = '') => {
    const ev = events.find(e => e.id === id)
    const oldDate = ev?.date
    const histEntry = { date: new Date().toLocaleDateString('es-PE'), action: 'Reprogramado', note: `De ${oldDate} a ${newDate}${note ? ' — ' + note : ''}` }
    setEvents(s => s.map(e => e.id === id
      ? { ...e, date: newDate, status: 'pending', history: [...(e.history || []), histEntry] }
      : e
    ))
    if (ev) {
      const updated = { ...ev, date: newDate, status: 'pending', history: [...(ev.history || []), histEntry] }
      try { await upsertEvent(updated) } catch (e) { setError(e.message) }
    }
  }, [events])

  const addNote = useCallback(async (id, note) => {
    const histEntry = { date: new Date().toLocaleDateString('es-PE'), action: 'Nota agregada', note }
    setEvents(s => s.map(e => e.id === id
      ? { ...e, history: [...(e.history || []), histEntry] }
      : e
    ))
    const ev = events.find(e => e.id === id)
    if (ev) {
      const updated = { ...ev, history: [...(ev.history || []), histEntry] }
      try { await upsertEvent(updated) } catch (e) { setError(e.message) }
    }
  }, [events])

  // ── TEMPLATES ──
  const saveTemplate = useCallback(async (tpl) => {
    const newTpl = { ...tpl, id: uid() }
    setTemplates(s => [...s, newTpl])
    try { await upsertTemplate(newTpl) } catch (e) { setError(e.message) }
  }, [])

  const deleteTemplate = useCallback(async (id) => {
    setTemplates(s => s.filter(t => t.id !== id))
    try { await deleteTemplateDB(id) } catch (e) { setError(e.message) }
  }, [])

  // ── CONFIG (localStorage only) ──
  const updateConfig = useCallback((cfg) => {
    setConfig(s => { const n = { ...s, ...cfg }; saveConfig(n); return n })
  }, [])

  // ── WA LOGS ──
  const refreshLogs = useCallback(async () => {
    try {
      const logs = await fetchWALogs()
      setWaLogs(logs)
    } catch (e) { setError(e.message) }
  }, [])

  // ── LEGACY history (derived from waLogs + event histories) ──
  const history = waLogs.map(l => ({
    id: l.id,
    eventTitle: l.event_id || '—',
    action: 'WA enviado',
    date: l.sent_at?.split('T')[0] || '',
    note: `→ ${l.phone}`,
    status: l.status,
  }))

  const clearError = useCallback(() => setError(null), [])

  return {
    events, templates, waLogs, history, config, loading, error,
    addEvent, updateEvent, deleteEvent, completeEvent,
    reprogramEvent, addNote, saveTemplate, deleteTemplate,
    updateConfig, refreshLogs, clearError,
    // stubs for legacy compat
    addHistoryEntry: () => {},
    importData: () => {},
    clearData: () => {},
  }
}
