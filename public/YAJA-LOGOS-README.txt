Logos e iconos de Yaja - Configuración actualizada

Archivos de imagen requeridos en la carpeta `public/`:

- yaja-logo.png           ✅ (Logo fuente existente usado para generar todos los iconos)
- favicon.ico             ✅ (32x32 - generado automáticamente desde yaja-logo.png)
- android-chrome-192x192.png  ✅ (192x192 - generado automáticamente)
- android-chrome-512x512.png  ✅ (512x512 - generado automáticamente)
- apple-touch-icon.png    ✅ (180x180 - generado automáticamente)

PWAs específicas creadas:
- /driver-app-manifest.json     → Para yajaasistencia.com/driver-app
- /road-assist-app-manifest.json → Para yajaasistencia.com/road-assist-app

Configuración PWA:
- Display: fullscreen (sin barras de navegación del navegador)
- Permisos: geolocation, notifications, camera, microphone, background-sync, persistent-storage
- Viewport: sin zoom permitido, ni siquiera al abrir teclado
- Orientación: portrait-primary (vertical obligatoria)

Notas:
- Los iconos se generan automáticamente desde yaja-logo.png usando el script `npm run generate:icons`
- Cada app tiene su propio manifest y metadata para instalación independiente como PWA
- Los layouts específicos en app/driver-app/layout.tsx y app/road-assist-app/layout.tsx manejan la metadata de cada PWA
- CSS inline previene zoom en inputs y scroll bounce en iOS
