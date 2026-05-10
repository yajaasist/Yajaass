# Android híbrido del conductor

La app Android híbrida del conductor se genera con Capacitor sobre la misma app web en /driver-app.

## Archivos clave

- capacitor.config.ts: define el contenedor Android y la URL remota cargada por el WebView.
- lib/nativeMobile.ts: puente nativo para GPS, permisos, notificaciones locales y registro FCM.
- android/: proyecto Android nativo generado por Capacitor.

## Comandos

- npm run android:sync
- npm run android:open
- npm run android:run

## URL del WebView

Configura la variable CAPACITOR_ANDROID_SERVER_URL antes de sincronizar o compilar.

Valor productivo actual:

- https://yajaasistencia.com/driver-app

Ejemplos:

- Emulador Android local: http://10.0.2.2:3301/driver-app
- Ambiente productivo: https://yajaasistencia.com/driver-app

## Push nativo Android

Para push remoto con la app cerrada necesitas agregar android/app/google-services.json de Firebase.

Checklist mínimo de Firebase:

- En Firebase crea una app Android con package name com.yajaasistencia.driver.
- Descarga google-services.json.
- Guárdalo en android/app/google-services.json.
- Ejecuta npm run android:sync.
- Luego compila o abre Android Studio con npm run android:open.

Validación esperada:

- Si el archivo existe, el módulo app aplica com.google.gms.google-services automáticamente.
- Si no existe, el build deja un mensaje claro y el push remoto FCM no queda activo.

Sin ese archivo:

- el proyecto Android abre y funciona
- GPS y permisos nativos funcionan
- las notificaciones locales y en foreground funcionan
- el registro FCM completo no queda operativo para push remoto del sistema

## Flujo actual

- El conductor usa la misma UI y lógica web.
- En Android nativo, permisos, GPS en vivo y notificaciones pasan por Capacitor.
- La suscripción push del conductor se guarda en drivers.push_subscription con platform=android-native cuando Firebase está configurado.