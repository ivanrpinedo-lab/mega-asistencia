# mega-agenda — Mega Sostenible SAC

Aplicación PWA para gestión de pagos, cobros, eventos y recordatorios.

## Características

- 📅 **Agenda completa** — Cobros, pagos, letras, reuniones, capacitaciones, documentos, concursos
- 🔔 **Alarmas y recordatorios** — Notificaciones push, countdown en tiempo real
- 💬 **WhatsApp masivo** — Plantillas personalizables con variables dinámicas
- 🚨 **Panel de alertas** — Eventos vencidos y urgentes en un vistazo
- ⚙️ **Configuración** — Ajustes por administrador, backup JSON
- 📱 **Instalable como app** — PWA compatible con Android e iOS

## Instalación local

```bash
npm install
npm run dev
```

## Deploy en Vercel

1. Sube este repositorio a GitHub
2. Entra a [vercel.com](https://vercel.com) → Import Project → selecciona el repo
3. Vercel detecta Vite automáticamente → Deploy

## Estructura

```
src/
├── store/useStore.js       # Estado global + localStorage
├── utils/helpers.js        # Funciones utilitarias
├── components/
│   ├── UI.jsx              # Componentes reutilizables
│   ├── EventCard.jsx       # Tarjeta de evento
│   ├── EventForm.jsx       # Formulario crear/editar
│   └── EventDetail.jsx     # Modal detalle + acciones
└── pages/
    ├── Dashboard.jsx
    ├── Agenda.jsx
    ├── WhatsApp.jsx
    ├── Alertas.jsx
    └── Config.jsx
```

## Variables WhatsApp

`{{nombre}}` `{{empresa}}` `{{monto}}` `{{moneda}}` `{{fecha_venc}}` `{{concepto}}` `{{dias_restantes}}`

---
Desarrollado para **Mega Sostenible SAC** · Juanjuí, San Martín, Perú
