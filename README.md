# Agropulse

Aplicación web para **monitoreo automático de sequías** orientada a productores agropecuarios.
El usuario selecciona una coordenada (input manual o click en mapa) y el sistema
consulta **Google Earth Engine** usando imágenes **Sentinel-2** para calcular:

1. NDVI más reciente (últimos 45 días).
2. Promedio histórico de NDVI para el mismo mes, últimos 5 años.
3. **Anomalía** = diferencia porcentual. Si el NDVI actual está ≥30% por debajo
   del histórico ⇒ estado **Sequía Alerta**.
4. Serie temporal mensual del último año.
5. Diferenciación agrícola vs. cuerpo de agua (NDWI) para evitar falsos positivos.

## Stack

- **Frontend:** Next.js 14 (App Router) + Tailwind CSS + React-Leaflet + Recharts.
- **Backend:** API Routes de Next.js (Node runtime) + `@google/earthengine`.
- **Despliegue:** Vercel.

## Estructura

```
app/
  api/check-drought/route.js   # API: autenticación EE + análisis
  layout.js
  page.js                      # UI principal (mapa + panel + resultados)
  globals.css
components/
  MapPicker.js                 # Mapa Leaflet con click-to-pick
  DroughtResult.js             # Card de estado + stats
  NDVIChart.js                 # Serie temporal (Recharts)
lib/
  earthengine.js               # Auth + pipeline EE (cloud mask, NDVI, NDWI, serie)
```

## Configuración de Google Earth Engine

1. Creá un proyecto en Google Cloud y habilitá la API de Earth Engine.
2. Creá una **Service Account** y descargá la clave JSON.
3. Registrá la service account en <https://signup.earthengine.google.com/> o
   en tu proyecto de Earth Engine para que tenga permisos.
4. Copiá `.env.example` a `.env.local` y seteá **una** de estas variables:

   - `GEE_PRIVATE_KEY_JSON`: JSON completo en una sola línea.
   - `GEE_PRIVATE_KEY_JSON_B64`: mismo JSON pero codificado en base64
     (recomendado para Vercel):

     ```bash
     base64 -i service-account.json | pbcopy
     ```

## Desarrollo local

```bash
npm install
npm run dev
```

Abrir <http://localhost:3000>.

Prueba rápida del endpoint:

```bash
curl -X POST http://localhost:3000/api/check-drought \
  -H 'Content-Type: application/json' \
  -d '{"lat":-34.6,"lon":-60.5,"bufferMeters":150}'
```

## Despliegue en Vercel

1. Importar el repo en Vercel.
2. En **Project Settings → Environment Variables** agregar
   `GEE_PRIVATE_KEY_JSON_B64` con el contenido de la clave en base64.
3. Deploy. El runtime de la API route ya está fijado a `nodejs` y
   `maxDuration = 60` para dar margen a las consultas a EE.

## Notas sobre el pipeline EE

- **Colección:** `COPERNICUS/S2_SR_HARMONIZED` (Surface Reflectance armonizada).
- **Pre-filtro a nivel escena:** `CLOUDY_PIXEL_PERCENTAGE < 60`.
- **Cloud masking por píxel:** `SCL` (descarta clases 3, 8, 9, 10, 11) +
  bits 10/11 de `QA60`.
- **NDVI:** `(B8 - B4) / (B8 + B4)`.
- **NDWI (McFeeters):** `(B3 - B8) / (B3 + B8)`. NDWI > 0.1 ⇒ cuerpo de agua.
- **Escala de reducción:** 10 m (resolución nativa de B4/B8).
- **Buffer:** por defecto 100 m alrededor del punto (ajustable en UI 10–5000 m).

## Reglas de clasificación

| Anomalía (NDVI actual vs. histórico) | Estado           |
|--------------------------------------|------------------|
| ≤ -30%                               | `sequia_alerta`  |
| -30% a -15%                          | `estres_hidrico` |
| -15% a +10%                          | `normal`         |
| ≥ +10%                               | `optimo`         |
| NDWI > 0.1                           | `cuerpo_de_agua` |
