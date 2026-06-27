import { supabase } from './supabase'

// ─── EVENTS ───────────────────────────────────────────

export async function fetchEvents() {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('date', { ascending: true })
  if (error) throw error
  return data || []
}

export async function upsertEvent(event) {
  const { history, createdAt, ...rest } = event
  const { data, error } = await supabase
    .from('events')
    .upsert({
      ...rest,
      history: history || [],
      created_at: createdAt || new Date().toISOString(),
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteEventDB(id) {
  const { error } = await supabase.from('events').delete().eq('id', id)
  if (error) throw error
}

// ─── TEMPLATES ────────────────────────────────────────

export async function fetchTemplates() {
  const { data, error } = await supabase
    .from('wa_templates')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function upsertTemplate(tpl) {
  const { data, error } = await supabase
    .from('wa_templates')
    .upsert({
      id: tpl.id,
      name: tpl.name,
      body: tpl.body,
      filter_type: tpl.filterType || 'todos',
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteTemplateDB(id) {
  const { error } = await supabase.from('wa_templates').delete().eq('id', id)
  if (error) throw error
}

// ─── WA LOGS ──────────────────────────────────────────

export async function fetchWALogs() {
  const { data, error } = await supabase
    .from('wa_logs')
    .select('*')
    .order('sent_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return data || []
}

export async function insertWALog(log) {
  const { error } = await supabase.from('wa_logs').insert(log)
  if (error) throw error
}

// ─── N8N WEBHOOK TRIGGERS ─────────────────────────────

const N8N_BASE = 'https://n8n.ivanpinedo.com'

export async function triggerWAManual(eventId, phone, message) {
  try {
    const res = await fetch(`${N8N_BASE}/webhook/mega-agenda-manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, phone, message }),
    })
    return res.ok
  } catch (e) {
    console.error('n8n webhook error:', e)
    return false
  }
}

export async function triggerWAMasivo(events, templateBody, empresa) {
  try {
    const res = await fetch(`${N8N_BASE}/webhook/mega-agenda-masivo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events, templateBody, empresa }),
    })
    return res.ok
  } catch (e) {
    console.error('n8n webhook error:', e)
    return false
  }
}
