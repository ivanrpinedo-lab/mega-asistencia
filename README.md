# 🌿 Mega Asistencia PWA

Control de asistencia con QR, GPS y Selfie para Mega Aventura SAC y Mega Sostenible SAC.

## Stack
- React + Vite
- vite-plugin-pwa (Service Worker + Manifest)
- localStorage para persistencia offline

## Funciones
- ✅ Check-in por código QR personal + selfie
- 📍 Check-in GPS + selfie con coordenadas incrustadas
- 📡 Tracking GPS en tiempo real para personal de campo
- 👔 Panel Gerente con PIN: KPIs, horas, liquidación, mapa GPS, fotos
- 🪪 Fotochecks imprimibles con código QR único por colaborador
- 📱 Instalable como app en Android e iPhone (PWA)

## Deploy local
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
```

## Deploy en Vercel
Conectar repositorio en vercel.com → deploy automático.
