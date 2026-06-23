import { T } from './utils.js'

export const Btn = ({ children, onClick, color = T.verde, outline = false, sm = false, disabled = false, full = false }) => (
  <button onClick={onClick} disabled={disabled} style={{
    background: disabled ? '#ddd' : outline ? 'transparent' : color,
    color: disabled ? '#888' : outline ? color : '#fff',
    border: `2px solid ${disabled ? '#ddd' : color}`,
    borderRadius: 9, padding: sm ? '6px 14px' : '11px 22px',
    cursor: disabled ? 'default' : 'pointer', fontWeight: 700,
    fontSize: sm ? 13 : 15, fontFamily: 'inherit',
    width: full ? '100%' : 'auto', transition: 'opacity .15s',
    lineHeight: 1.3,
  }}>{children}</button>
)

export const Card = ({ children, style = {} }) => (
  <div style={{ background: T.blanco, borderRadius: 16, padding: 20, boxShadow: '0 2px 12px #00000016', ...style }}>
    {children}
  </div>
)

export const Inp = ({ value, onChange, type = 'text', placeholder = '', style = {}, autoFocus }) => (
  <input
    type={type} value={value} onChange={e => onChange(e.target.value)}
    placeholder={placeholder} autoFocus={autoFocus}
    style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #D0D7DE', borderRadius: 9, fontSize: 15, fontFamily: 'inherit', boxSizing: 'border-box', ...style }}
  />
)

export const Sel = ({ value, onChange, children, style = {} }) => (
  <select value={value} onChange={e => onChange(e.target.value)}
    style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #D0D7DE', borderRadius: 9, fontSize: 15, fontFamily: 'inherit', background: '#fff', boxSizing: 'border-box', ...style }}>
    {children}
  </select>
)

export const Field = ({ label, children, hint }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: T.gris, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
      {label}
    </label>
    {children}
    {hint && <div style={{ fontSize: 11, color: T.grisMid, marginTop: 4 }}>{hint}</div>}
  </div>
)

export const Badge = ({ label, color, bg }) => (
  <span style={{ background: bg || color + '22', color, border: `1px solid ${color}`, borderRadius: 6, padding: '3px 9px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
    {label}
  </span>
)

export const Toast = ({ msg, tipo }) => (
  <div style={{
    position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
    zIndex: 9999, background: tipo === 'err' ? T.rojo : T.verde, color: '#fff',
    borderRadius: 12, padding: '14px 24px', fontWeight: 700, fontSize: 15,
    boxShadow: '0 4px 20px #0005', animation: 'fadeIn .25s ease', whiteSpace: 'nowrap',
  }}>
    {tipo === 'err' ? '⚠️' : '✅'} {msg}
  </div>
)

export const Spinner = ({ color = T.verde }) => (
  <div style={{ width: 44, height: 44, border: `4px solid ${color}33`, borderTopColor: color, borderRadius: '50%', animation: 'spin 0.9s linear infinite', margin: '0 auto' }} />
)

export const Divider = () => <div style={{ height: 1, background: '#eee', margin: '16px 0' }} />

// Botón volver grande para móvil — mínimo 48px de alto (estándar táctil)
export const BtnVolver = ({ onClick, label = '← Volver', color = T.gris }) => (
  <button onClick={onClick} style={{
    background: '#F0F4F8',
    color: color,
    border: `2px solid #D0D7DE`,
    borderRadius: 12,
    padding: '14px 20px',
    cursor: 'pointer',
    fontWeight: 800,
    fontSize: 16,
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minHeight: 52,
    WebkitTapHighlightColor: 'transparent',
    transition: 'background .15s',
  }}
    onTouchStart={e => e.currentTarget.style.background = '#E0E7EF'}
    onTouchEnd={e => e.currentTarget.style.background = '#F0F4F8'}
  >
    <span style={{ fontSize: 20 }}>←</span>
    <span>{label.replace('← ', '')}</span>
  </button>
)
