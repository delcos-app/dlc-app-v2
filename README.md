# Delcos

Entorno de pruebas de **delcos**, la plataforma de gestión comercial para empresas que trabajan con profesionales: cartera de cuentas, visitas, agenda y rutas, pedidos, facturación, comisiones y analítica, en el ordenador y en el móvil.

- Se publica en **https://apptest.delcos.cloud**, con su propia base de datos de pruebas.
- Cada versión nueva se sube aquí primero; cuando está validada, pasa a producción (`dlc-app-v2`, https://app.delcos.cloud).

## Cómo está hecha

- Aplicación web sin compilación: `index.html`, `app.js`, `sw.js` y `manifest.webmanifest`, con sus iconos.
- Datos y acceso con Supabase; `config.js` indica a qué entorno se conecta.
- Funciona como aplicación instalable en el móvil y permite registrar visitas sin conexión.
- El manual de uso está en `manual/`.

© Delcoslab S.L.

