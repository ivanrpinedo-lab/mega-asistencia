import { useState, useEffect, useRef } from 'react'

// ─── BUTTON ───
export function Btn({ children, variant = 'primary', size = 'md', full, onClick, type = 'button', disabled, style }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    border: 'none', borderRadius: 10, fontWeight: 600, fontFamily: 'inherit',
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
    transition: 'all 0.15s', width: full ? '100%' : undefined,
    padding: size === 'sm' ? '6px 12px' : size === 'lg' ? '13px 24px' : '10px 18px',
    fontSize: size === 'sm' ? 12 : size === 'lg' ? 15 : 13,
  }
  const variants = {
    primary:   { background: 'var(--green)', color: 'white' },
    secondary: { background: 'var(--surface)', color: 'var(--text)', border: '1.5px solid var(--border)' },
    danger:    { background: 'var(--red)', color: 'white' },
    whatsapp:  { background: '#25D366', color: 'white' },
    amber:     { background: 'var(--amber)', color: 'white' },
    ghost:     { background: 'transparent', color: 'var(--text-mid)', border: '1.5px solid var(--border)' },
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  )
}

// ─── MODAL BOTTOM SHEET ───
export function Modal({ id, open, onClose, title, children, actions }) {
  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(13,33,55,0.7)',
        zIndex: 200, display: open ? 'flex' : 'none',
        alignItems: 'flex-end', justifyContent: 'center',
        backdropFilter: 'blur(3px)',
      }}
    >
      <div style={{
        background: 'var(--surface)', borderRadius: '20px 20px 0 0',
        width: '100%', maxWidth: 680, maxHeight: '92vh', overflowY: 'auto',
        padding: 20, animation: open ? 'slideUp 0.25s ease' : undefined,
      }}>
        <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
        <div style={{ width: 40, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 16px' }} />
        {title && <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>{title}</h2>}
        {children}
        {actions && <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>{actions}</div>}
      </div>
    </div>
  )
}

// ─── FORM CONTROL ───
export function FormGroup({ label, children, style }) {
  return (
    <div style={{ marginBottom: 14, ...style }}>
      {label && <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-mid)', marginBottom: 5, display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</label>}
      {children}
    </div>
  )
}

const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 10,
  border: '1.5px solid var(--border)', fontSize: 14, color: 'var(--text)',
  background: 'var(--surface)', outline: 'none', transition: 'border-color 0.15s',
}

export function Input({ style, ...props }) {
  return <input style={{ ...inputStyle, ...style }} {...props}
    onFocus={e => e.target.style.borderColor = 'var(--green)'}
    onBlur={e => e.target.style.borderColor = 'var(--border)'}
  />
}

export function Select({ style, children, ...props }) {
  return (
    <select style={{
      ...inputStyle,
      appearance: 'none',
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' fill='none'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%238A9BB0' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
      backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center',
      ...style
    }} {...props}>{children}</select>
  )
}

export function Textarea({ style, ...props }) {
  return <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 80, ...style }} {...props}
    onFocus={e => e.target.style.borderColor = 'var(--green)'}
    onBlur={e => e.target.style.borderColor = 'var(--border)'}
  />
}

// ─── TOGGLE ───
export function Toggle({ checked, onChange }) {
  return (
    <label style={{ position: 'relative', width: 44, height: 24, display: 'inline-block', cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={onChange} style={{ opacity: 0, width: 0, height: 0 }} />
      <span style={{
        position: 'absolute', inset: 0, borderRadius: 12,
        background: checked ? 'var(--green)' : 'var(--border)',
        transition: 'background 0.2s',
      }}>
        <span style={{
          position: 'absolute', width: 18, height: 18, background: 'white',
          borderRadius: '50%', top: 3, left: checked ? 23 : 3,
          transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
        }} />
      </span>
    </label>
  )
}

// ─── BADGE ───
export function Badge({ text, color, bg }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', fontSize: 10, fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.5px',
      padding: '2px 7px', borderRadius: 20, background: bg, color,
    }}>{text}</span>
  )
}

// ─── COUNTDOWN CHIP ───
export function CountdownChip({ cls, text }) {
  const colors = {
    overdue: { bg: 'var(--red-pale, #FDECEA)', color: 'var(--red)' },
    urgent:  { bg: 'var(--amber-pale, #FFF4E0)', color: 'var(--amber-dark, #B8830A)' },
    ok:      { bg: 'var(--green-pale, #E8F5EE)', color: 'var(--green)' },
  }
  const c = colors[cls] || colors.ok
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20, background: c.bg, color: c.color, whiteSpace: 'nowrap' }}>
      {text}
    </span>
  )
}

// ─── EMPTY STATE ───
export function Empty({ icon = '📭', title = 'Sin resultados', sub }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-light)' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>{icon}</div>
      <h3 style={{ fontSize: 16, color: 'var(--text-mid)', marginBottom: 6 }}>{title}</h3>
      {sub && <p style={{ fontSize: 13 }}>{sub}</p>}
    </div>
  )
}

// ─── TOAST ───
export function Toast({ message, show }) {
  return (
    <div style={{
      position: 'fixed', top: 70, left: '50%',
      transform: `translateX(-50%) translateY(${show ? 0 : -20}px)`,
      background: 'var(--navy)', color: 'white', padding: '10px 20px',
      borderRadius: 12, fontSize: 13, fontWeight: 600,
      zIndex: 999, opacity: show ? 1 : 0, transition: 'all 0.3s',
      pointerEvents: 'none', whiteSpace: 'nowrap',
      boxShadow: '0 8px 32px rgba(13,33,55,0.25)',
    }}>{message}</div>
  )
}

// ─── SECTION HEADER ───
export function SectionHeader({ title, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginTop: 20 }}>
      <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-mid)' }}>{title}</span>
      {action}
    </div>
  )
}

// ─── STAT CARD ───
export function StatCard({ label, value, sub, variant = 'info' }) {
  const colors = {
    danger:  { bar: 'var(--red)',   val: 'var(--red)'   },
    success: { bar: 'var(--green)', val: 'var(--green)' },
    warning: { bar: 'var(--amber)', val: 'var(--amber)' },
    info:    { bar: 'var(--blue)',  val: 'var(--blue)'  },
  }
  const c = colors[variant]
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 14, padding: '14px 16px', boxShadow: 'var(--shadow)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: c.bar, borderRadius: '14px 0 0 14px' }} />
      <div style={{ fontSize: 11, color: 'var(--text-mid)', fontWeight: 500, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: c.val, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

// ─── CHIP FILTER ───
export function Chip({ label, active, onClick }) {
  return (
    <span
      onClick={onClick}
      style={{
        padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
        border: '1.5px solid', borderColor: active ? 'var(--navy)' : 'var(--border)',
        background: active ? 'var(--navy)' : 'var(--surface)',
        color: active ? 'white' : 'var(--text-mid)',
        cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
      }}
    >{label}</span>
  )
}

// ─── NOTE CARD ───
export function NoteCard({ date, action, note, color = 'var(--amber)' }) {
  return (
    <div style={{ background: '#FFFDE7', borderRadius: 10, padding: 12, marginBottom: 8, borderLeft: `3px solid ${color}` }}>
      <div style={{ fontSize: 11, color: 'var(--text-light)', marginBottom: 4 }}>{date} · <strong>{action}</strong></div>
      <div style={{ fontSize: 13 }}>{note}</div>
    </div>
  )
}
