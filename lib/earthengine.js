// Capa de integración con Google Earth Engine — Agropulse.
//
// Responsabilidades:
//  - Autenticación vía Service Account (ee.data.authenticateViaPrivateKey)
//  - Pipeline Sentinel-2 SR Harmonized con cloud masking (SCL + QA60)
//  - Índices NDVI, EVI y NDWI
//  - Anomalías por índice vs. promedio histórico (mismo mes, últimos 5 años)
//  - Serie temporal mensual (NDVI + EVI) del último año
//  - Estimación de etapa fenológica (heurística NDVI + tendencia)
//  - Ranking / percentil histórico (5 años mismo mes)
//  - Benchmark zonal (radio 10 km alrededor del centro de la geometría)
//  - Días de estrés consecutivos (NDWI < umbral) sobre series casi-diarias
//  - Ventanas de trabajo operativas (fertilización, monitoreo, etc.)
//  - Storytelling narrativo en lenguaje natural
//  - Generación de un mapId de NDVI para pintar el área en el cliente
//  - Soporte de geometría: punto (con buffer) o polígono dibujado por el usuario
//
// Este módulo corre SOLO en el servidor (API Route).

import ee from '@google/earthengine';
import { buildNarrative, detectReportMode } from './narrative';

// ---------------------------------------------------------------------------
// Autenticación
// ---------------------------------------------------------------------------

let initPromise = null;

function loadServiceAccountKey() {
  const raw =
    process.env.GEE_PRIVATE_KEY_JSON ||
    (process.env.GEE_PRIVATE_KEY_JSON_B64
      ? Buffer.from(process.env.GEE_PRIVATE_KEY_JSON_B64, 'base64').toString('utf8')
      : null);
  if (!raw) {
    throw new Error('Faltan credenciales: definí GEE_PRIVATE_KEY_JSON o GEE_PRIVATE_KEY_JSON_B64.');
  }
  let key;
  try { key = JSON.parse(raw); }
  catch (err) { throw new Error('GEE_PRIVATE_KEY_JSON no es JSON válido: ' + err.message); }
  if (key.private_key && key.private_key.includes('\\n')) {
    key.private_key = key.private_key.replace(/\\n/g, '\n');
  }
  return key;
}

export function initEE() {
  if (initPromise) return initPromise;
  initPromise = new Promise((resolve, reject) => {
    const key = loadServiceAccountKey();
    ee.data.authenticateViaPrivateKey(
      key,
      () => {
        ee.initialize(
          null,
          null,
          () => resolve(true),
          (err) => reject(new Error('ee.initialize falló: ' + err))
        );
      },
      (err) => reject(new Error('authenticateViaPrivateKey falló: ' + err))
    );
  }).catch((err) => { initPromise = null; throw err; });
  return initPromise;
}

// ---------------------------------------------------------------------------
// Sentinel-2: cloud masking + índices
// ---------------------------------------------------------------------------

function maskS2Clouds(image) {
  const scl = image.select('SCL');
  const sclMask = scl.neq(3).and(scl.neq(8)).and(scl.neq(9)).and(scl.neq(10)).and(scl.neq(11));
  const qa = image.select('QA60');
  const cloudBit = 1 << 10;
  const cirrusBit = 1 << 11;
  const qaMask = qa.bitwiseAnd(cloudBit).eq(0).and(qa.bitwiseAnd(cirrusBit).eq(0));
  return image
    .updateMask(sclMask.and(qaMask))
    .divide(10000)
    .copyProperties(image, ['system:time_start', 'system:index']);
}

function addIndices(image) {
  const ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI');
  const evi = image.expression(
    '2.5 * ((NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1))',
    { NIR: image.select('B8'), RED: image.select('B4'), BLUE: image.select('B2') }
  ).rename('EVI');
  const ndwi = image.normalizedDifference(['B3', 'B8']).rename('NDWI');
  return image.addBands([ndvi, evi, ndwi]);
}

function s2Collection(geometry, start, end) {
  return ee
    .ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterBounds(geometry)
    .filterDate(start, end)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 60))
    .map(maskS2Clouds)
    .map(addIndices);
}

function evaluate(eeObject) {
  return new Promise((resolve, reject) => {
    eeObject.evaluate((value, err) => {
      if (err) reject(new Error(err));
      else resolve(value);
    });
  });
}

function getMapAsync(image, vis) {
  return new Promise((resolve, reject) => {
    image.getMap(vis, (map, err) => {
      if (err) return reject(new Error(err));
      if (!map || !map.urlFormat) return reject(new Error('getMap no devolvió urlFormat'));
      resolve(map);
    });
  });
}

/**
 * Genera un thumbnail (PNG) accesible por URL pública firmada.
 * Envuelve `image.getThumbURL` en Promise y tolera fallos.
 */
function getThumbAsync(image, params) {
  return new Promise((resolve) => {
    try {
      image.getThumbURL(params, (url, err) => {
        if (err || !url) return resolve(null);
        resolve(url);
      });
    } catch (e) {
      resolve(null);
    }
  });
}

/**
 * Bounding box [minLon, minLat, maxLon, maxLat] con un padding relativo,
 * usado tanto para encuadrar el thumbnail como para sobre-dibujar el lote
 * en el PDF (conversión lon/lat → píxeles en el cliente).
 */
function computeThumbBounds(input, kind) {
  if (kind === 'polygon') {
    const lons = input.coordinates.map((c) => c[0]);
    const lats = input.coordinates.map((c) => c[1]);
    const minLon = Math.min(...lons), maxLon = Math.max(...lons);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const padLat = Math.max((maxLat - minLat) * 0.35, 0.0009);
    const padLon = Math.max((maxLon - minLon) * 0.35, 0.0009);
    return [minLon - padLon, minLat - padLat, maxLon + padLon, maxLat + padLat];
  }
  const { lat, lon, bufferMeters = 100 } = input;
  const mPerDegLat = 111320;
  const mPerDegLon = 111320 * Math.cos((lat * Math.PI) / 180);
  const padMeters = Math.max(bufferMeters * 3, 400);
  const dLat = padMeters / mPerDegLat;
  const dLon = padMeters / mPerDegLon;
  return [lon - dLon, lat - dLat, lon + dLon, lat + dLat];
}

function buildGeometry(input) {
  if (!input || typeof input !== 'object') throw new Error('geometry inválida');
  if (input.type === 'Point') {
    const { lat, lon, bufferMeters = 100 } = input;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error('Point requiere lat y lon numéricos');
    const point = ee.Geometry.Point([lon, lat]);
    return { geom: point.buffer(bufferMeters), kind: 'point', center: [lon, lat] };
  }
  if (input.type === 'Polygon') {
    const coords = input.coordinates;
    if (!Array.isArray(coords) || coords.length < 3) throw new Error('Polygon requiere al menos 3 vértices');
    for (const c of coords) {
      if (!Array.isArray(c) || c.length < 2 || !Number.isFinite(c[0]) || !Number.isFinite(c[1])) {
        throw new Error('Polygon: coordenadas inválidas');
      }
    }
    const ring = coords.map(([lon, lat]) => [lon, lat]);
    const first = ring[0], last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);
    const polygon = ee.Geometry.Polygon([ring]);
    const centroidLon = ring.reduce((s, p) => s + p[0], 0) / ring.length;
    const centroidLat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    return { geom: polygon, kind: 'polygon', center: [centroidLon, centroidLat] };
  }
  throw new Error('geometry.type debe ser Point o Polygon');
}

// ---------------------------------------------------------------------------
// Heurísticas de post-procesado
// ---------------------------------------------------------------------------

function estimatePhenology(currentNDVI, prevNDVI) {
  if (currentNDVI == null) return { stage: 'sin_datos', label: 'Sin datos' };
  const delta = prevNDVI != null ? currentNDVI - prevNDVI : null;
  const trend = delta == null ? 'estable' : delta > 0.05 ? 'subiendo' : delta < -0.05 ? 'bajando' : 'estable';
  if (currentNDVI < 0.2) return { stage: 'barbecho', label: 'Barbecho / suelo desnudo', trend };
  if (currentNDVI < 0.35) return { stage: 'emergencia', label: 'Emergencia', trend };
  if (currentNDVI < 0.55) return trend === 'bajando'
    ? { stage: 'senescencia', label: 'Senescencia', trend }
    : { stage: 'crecimiento', label: 'Crecimiento vegetativo', trend };
  if (currentNDVI < 0.75) return trend === 'bajando'
    ? { stage: 'senescencia', label: 'Senescencia', trend }
    : { stage: 'pleno_desarrollo', label: 'Pleno desarrollo', trend };
  return trend === 'bajando'
    ? { stage: 'senescencia', label: 'Senescencia', trend }
    : { stage: 'maximo_vigor', label: 'Máximo vigor', trend };
}

function classifyAnomaly(anomalyPct) {
  if (anomalyPct == null) return { status: 'sin_datos', label: 'Sin datos' };
  if (anomalyPct <= -30) return { status: 'sequia_alerta', label: 'Sequía Alerta' };
  if (anomalyPct <= -20) return { status: 'estres_hidrico_plaga', label: 'Posible Estrés Hídrico/Plaga' };
  if (anomalyPct <= -10) return { status: 'observacion', label: 'Bajo observación' };
  if (anomalyPct >= 10) return { status: 'optimo', label: 'Óptimo' };
  return { status: 'normal', label: 'Normal' };
}

/**
 * Ranking / percentil del NDVI actual dentro de la distribución histórica.
 * Recibe 5 valores (mismo mes, años -5..-1) + el actual.
 * Devuelve percentil aproximado [0..100] y bucket textual.
 */
function computeRanking(current, yearlyValues) {
  const values = (yearlyValues || []).filter((v) => v != null && Number.isFinite(v));
  if (current == null || values.length === 0) {
    return { percentile: null, bucket: 'sin_datos', label: 'Datos insuficientes', yearlyValues: values };
  }
  const sorted = [...values].sort((a, b) => a - b);
  // percentil: fracción de años con NDVI ≤ actual
  const below = sorted.filter((v) => v <= current).length;
  const percentile = Math.round((below / sorted.length) * 100);
  let bucket, label;
  if (percentile >= 90) { bucket = 'top_10', label = 'Top 10% de mejores campañas'; }
  else if (percentile >= 75) { bucket = 'top_25', label = 'Por encima del 75% histórico'; }
  else if (percentile >= 50) { bucket = 'sobre_mediana', label = 'Sobre la mediana histórica'; }
  else if (percentile >= 25) { bucket = 'bajo_mediana', label = 'Por debajo de la mediana'; }
  else { bucket = 'bottom_25', label = 'Entre los peores años'; }
  return { percentile, bucket, label, yearlyValues: sorted };
}

/**
 * Días de estrés hídrico consecutivos: cuenta, desde la imagen más reciente
 * hacia atrás, cuántos días transcurrieron hasta encontrar la última observación
 * con NDWI por encima del umbral.
 */
function computeStressDays(ndwiSeries, threshold = -0.1) {
  const pts = (ndwiSeries || [])
    .filter((p) => p && p.date && p.ndwi != null)
    .sort((a, b) => (a.date < b.date ? 1 : -1)); // más reciente primero

  if (pts.length === 0) return { days: null, lastAbove: null, threshold };

  const mostRecent = new Date(pts[0].date);
  let lastAboveDate = null;
  let consecutiveBelow = 0;
  for (const p of pts) {
    if (p.ndwi < threshold) {
      consecutiveBelow += 1;
    } else {
      lastAboveDate = p.date;
      break;
    }
  }
  if (consecutiveBelow === 0) {
    return { days: 0, lastAbove: pts[0].date, threshold, observations: pts.length };
  }
  // Si todos los puntos están bajo el umbral: usamos el más antiguo como referencia
  const oldestDateStr = lastAboveDate || pts[pts.length - 1].date;
  const oldestDate = new Date(oldestDateStr);
  const diffMs = mostRecent.getTime() - oldestDate.getTime();
  const days = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
  return {
    days,
    lastAbove: lastAboveDate,
    threshold,
    observations: pts.length,
    consecutiveObservations: consecutiveBelow,
  };
}

/**
 * Ventanas de trabajo sugeridas según etapa fenológica, anomalías y estrés hídrico.
 */
function operationalWindows({ phenology, anomalies, stressDays, status, landCover }) {
  if (landCover === 'agua') return [];
  const rec = [];
  const stage = phenology?.stage;
  const ndviAnom = anomalies?.ndvi;
  const ndwiAnom = anomalies?.ndwi;

  if (stage === 'emergencia' || stage === 'crecimiento') {
    rec.push({
      id: 'fert_n',
      titulo: 'Fertilización nitrogenada',
      detalle: 'Ventana óptima para refertilización nitrogenada si el cultivo está implantado y el clima acompaña.',
      prioridad: ndviAnom != null && ndviAnom < -10 ? 'alta' : 'media',
      momento: 'Próximos 7–14 días',
    });
    rec.push({
      id: 'scout_temprano',
      titulo: 'Monitoreo temprano de plagas',
      detalle: 'Recorrer el lote buscando daños por insectos de suelo y malezas competitivas en estadio crítico.',
      prioridad: 'media',
      momento: 'Semanal',
    });
  }
  if (stage === 'pleno_desarrollo' || stage === 'maximo_vigor') {
    rec.push({
      id: 'scout_enf',
      titulo: 'Monitoreo de enfermedades foliares',
      detalle: 'Alto riesgo de royas / manchas foliares en cobertura cerrada. Evaluar fungicida preventivo si hay humedad persistente.',
      prioridad: ndwiAnom != null && ndwiAnom > 5 ? 'alta' : 'media',
      momento: 'Próximos 5–10 días',
    });
  }
  if (stage === 'senescencia') {
    rec.push({
      id: 'cosecha',
      titulo: 'Planificación de cosecha',
      detalle: 'Senescencia detectada. Revisar humedad de grano y organizar logística de cosecha / acopio.',
      prioridad: 'alta',
      momento: 'Próximas 2–3 semanas',
    });
  }
  if (stage === 'barbecho') {
    rec.push({
      id: 'barbecho',
      titulo: 'Manejo de barbecho',
      detalle: 'Ventana para control de malezas residuales y planificación de siembra de la próxima campaña.',
      prioridad: 'media',
      momento: 'A definir según rotación',
    });
  }

  if (status === 'sequia_alerta' || status === 'estres_hidrico_plaga') {
    rec.push({
      id: 'riego',
      titulo: 'Evaluar riego complementario',
      detalle: 'Anomalía negativa fuerte de NDVI. Priorizar sectores bajos de productividad y rever estrategia de fertilización.',
      prioridad: 'alta',
      momento: 'Inmediato',
    });
  }
  if (stressDays && stressDays.days != null && stressDays.days >= 15) {
    rec.push({
      id: 'estres_prolongado',
      titulo: 'Estrés hídrico prolongado',
      detalle: `El NDWI lleva ~${stressDays.days} días por debajo del umbral. Considerar análisis de suelo y ajuste de manejo.`,
      prioridad: 'alta',
      momento: 'Esta semana',
    });
  }
  if (rec.length === 0) {
    rec.push({
      id: 'monitor',
      titulo: 'Monitoreo de rutina',
      detalle: 'Condiciones estables. Mantener monitoreo satelital semanal y registrar recorridas a campo.',
      prioridad: 'baja',
      momento: 'Semanal',
    });
  }
  return rec;
}

// NOTA: el storytelling vive ahora en lib/narrative.js (motor composicional).

// ---------------------------------------------------------------------------
// API principal
// ---------------------------------------------------------------------------

export async function analyzeArea(input) {
  await initEE();

  const { geom: region, kind, center } = buildGeometry(input);

  const now = new Date();
  const endDate = ee.Date(now.toISOString().slice(0, 10));
  const currentMonth = now.getUTCMonth() + 1;
  const currentYear = now.getUTCFullYear();

  // --- 1) Imagen reciente (últimos 45 días) ---
  const recentStart = endDate.advance(-45, 'day');
  const recentCol = s2Collection(region, recentStart, endDate);
  const recentSorted = recentCol.sort('system:time_start', false);
  const recentImage = ee.Image(recentSorted.first()).clip(region);
  const recentDate = ee.Date(recentImage.get('system:time_start'));

  const recentStats = recentImage
    .select(['NDVI', 'EVI', 'NDWI'])
    .reduceRegion({ reducer: ee.Reducer.mean(), geometry: region, scale: 10, maxPixels: 1e9, bestEffort: true });

  // --- 2) Histórico mismo mes últimos 5 años ---
  const histStart = ee.Date.fromYMD(currentYear - 5, 1, 1);
  const histEnd = ee.Date.fromYMD(currentYear - 1, 12, 31);
  const histCol = s2Collection(region, histStart, histEnd).filter(
    ee.Filter.calendarRange(currentMonth, currentMonth, 'month')
  );
  const histMean = histCol.select(['NDVI', 'EVI', 'NDWI']).mean();
  const histStats = histMean.reduceRegion({
    reducer: ee.Reducer.mean(), geometry: region, scale: 10, maxPixels: 1e9, bestEffort: true,
  });

  // --- 3) Serie temporal mensual (último año) ---
  const tsEnd = endDate;
  const tsStart = tsEnd.advance(-12, 'month');
  const months = ee.List.sequence(0, 11);
  const monthlyList = months.map(function (i) {
    const start = tsStart.advance(i, 'month');
    const end = start.advance(1, 'month');
    const col = s2Collection(region, start, end);
    const meanImg = col.select(['NDVI', 'EVI']).mean();
    const stats = meanImg.reduceRegion({
      reducer: ee.Reducer.mean(), geometry: region, scale: 10, maxPixels: 1e9, bestEffort: true,
    });
    return ee.Dictionary({ date: start.format('YYYY-MM'), ndvi: stats.get('NDVI'), evi: stats.get('EVI') });
  });

  // --- 4) Ranking: NDVI del mismo mes por año, últimos 5 años ---
  const years = ee.List.sequence(currentYear - 5, currentYear - 1);
  const yearlyList = years.map(function (y) {
    const start = ee.Date.fromYMD(y, currentMonth, 1);
    const end = start.advance(1, 'month');
    const col = s2Collection(region, start, end);
    const meanVal = col.select('NDVI').mean().reduceRegion({
      reducer: ee.Reducer.mean(), geometry: region, scale: 10, maxPixels: 1e9, bestEffort: true,
    }).get('NDVI');
    return ee.Dictionary({ year: y, ndvi: meanVal });
  });

  // --- 5) Benchmark zonal (10 km alrededor del centro) ---
  const zonalCenter = ee.Geometry.Point(center);
  const zonalGeom = zonalCenter.buffer(10000);
  const zonalCol = s2Collection(zonalGeom, recentStart, endDate);
  const zonalMean = zonalCol.select('NDVI').mean().reduceRegion({
    reducer: ee.Reducer.mean(), geometry: zonalGeom, scale: 60, maxPixels: 1e9, bestEffort: true,
  }).get('NDVI');

  // --- 5b) Comparativo interanual: mismo mes del año anterior ---
  const yoyStart = ee.Date.fromYMD(currentYear - 1, currentMonth, 1);
  const yoyEnd = yoyStart.advance(1, 'month');
  const yoyCol = s2Collection(region, yoyStart, yoyEnd);
  const yoyNDVI = yoyCol.select('NDVI').mean().reduceRegion({
    reducer: ee.Reducer.mean(), geometry: region, scale: 10, maxPixels: 1e9, bestEffort: true,
  }).get('NDVI');

  // --- 6) Serie NDWI casi-diaria (últimos 60 días, una observación por imagen) ---
  const ndwiStart = endDate.advance(-60, 'day');
  const ndwiCol = s2Collection(region, ndwiStart, endDate).sort('system:time_start');
  const ndwiDaily = ndwiCol.toList(200).map(function (img) {
    const image = ee.Image(img);
    const meanNdwi = image.select('NDWI').reduceRegion({
      reducer: ee.Reducer.mean(), geometry: region, scale: 10, maxPixels: 1e9, bestEffort: true,
    }).get('NDWI');
    return ee.Dictionary({
      date: ee.Date(image.get('system:time_start')).format('YYYY-MM-dd'),
      ndwi: meanNdwi,
    });
  });

  // --- 7) Tile NDVI (mapId) ---
  const ndviVis = {
    min: 0.0,
    max: 0.85,
    palette: [
      '#7f1d1d', '#b91c1c', '#ea580c', '#f59e0b', '#eab308',
      '#a3e635', '#22c55e', '#059669', '#065f46',
    ],
  };
  const mapPromise = getMapAsync(recentImage.select('NDVI'), ndviVis).catch((err) => {
    console.warn('[EE] getMap NDVI falló:', err.message);
    return null;
  });

  // --- 7b) Thumbnails estáticos (NDVI colorizado + RGB true-color) para el PDF ---
  const thumbBbox = computeThumbBounds(input, kind);
  const thumbRegion = ee.Geometry.Rectangle(thumbBbox);
  const ndviThumbImg = recentImage.select('NDVI').visualize(ndviVis);
  const rgbThumbImg = recentImage
    .select(['B4', 'B3', 'B2'])
    .visualize({ min: 0, max: 0.3, gamma: 1.15 });
  const thumbParams = {
    dimensions: 640,
    region: thumbRegion,
    format: 'png',
    crs: 'EPSG:4326',
  };
  const ndviThumbPromise = getThumbAsync(ndviThumbImg, thumbParams);
  const rgbThumbPromise = getThumbAsync(rgbThumbImg, thumbParams);

  // --- 8) Área polígono ---
  const areaHa = kind === 'polygon' ? region.area({ maxError: 1 }).divide(10000) : ee.Number(0);

  // --- 9) Evaluación conjunta (1 round-trip EE) ---
  const payload = ee.Dictionary({
    current: recentStats,
    currentDate: recentDate.format('YYYY-MM-dd'),
    historical: histStats,
    histCount: histCol.size(),
    recentCount: recentCol.size(),
    series: monthlyList,
    yearly: yearlyList,
    zonalNDVI: zonalMean,
    yoyNDVI,
    ndwiDaily,
    areaHa,
  });

  const [evaluated, mapResult, ndviThumbUrl, rgbThumbUrl] = await Promise.all([
    evaluate(payload),
    mapPromise,
    ndviThumbPromise,
    rgbThumbPromise,
  ]);

  // --- 10) Post-procesado ---
  const curr = evaluated.current || {};
  const hist = evaluated.historical || {};
  const pct = (c, h) => (c == null || h == null || h === 0 ? null : ((c - h) / h) * 100);
  const anomalies = {
    ndvi: pct(curr.NDVI, hist.NDVI),
    evi: pct(curr.EVI, hist.EVI),
    ndwi: pct(curr.NDWI, hist.NDWI),
  };

  const main = classifyAnomaly(anomalies.ndvi);
  let landCover = 'agricultura';
  if (curr.NDWI != null && curr.NDWI > 0.1 && (curr.NDVI == null || curr.NDVI < 0.2)) {
    landCover = 'agua';
    main.status = 'cuerpo_de_agua';
    main.label = 'Cuerpo de agua';
  } else if (curr.NDVI != null && curr.NDVI < 0.15) {
    landCover = 'suelo_desnudo';
  }

  const timeSeries = (evaluated.series || [])
    .map((d) => ({ date: d.date, ndvi: d.ndvi, evi: d.evi }))
    .filter((d) => d.ndvi != null || d.evi != null);

  const lastTs = timeSeries[timeSeries.length - 1];
  const prevTs = timeSeries[timeSeries.length - 2];
  const phenology = estimatePhenology(curr.NDVI, prevTs ? prevTs.ndvi : lastTs ? lastTs.ndvi : null);

  // Ranking (percentil)
  const yearlyNDVI = (evaluated.yearly || [])
    .filter((y) => y && y.ndvi != null)
    .map((y) => ({ year: y.year, ndvi: y.ndvi }));
  const ranking = computeRanking(curr.NDVI, yearlyNDVI.map((y) => y.ndvi));
  ranking.years = yearlyNDVI;

  // Benchmark zonal
  const zonalNDVI = evaluated.zonalNDVI;
  const benchmark = {
    radiusMeters: 10000,
    zonalNDVI: zonalNDVI ?? null,
    delta: pct(curr.NDVI, zonalNDVI),
  };

  // Comparativo interanual (YoY)
  const yoy = {
    year: currentYear - 1,
    month: currentMonth,
    ndvi: evaluated.yoyNDVI ?? null,
    delta: pct(curr.NDVI, evaluated.yoyNDVI),
  };

  // Estrés hídrico
  const ndwiDailyClean = (evaluated.ndwiDaily || [])
    .filter((p) => p && p.ndwi != null)
    .map((p) => ({ date: p.date, ndwi: p.ndwi }));
  const stressDays = computeStressDays(ndwiDailyClean, -0.1);

  // Recomendaciones operativas
  const windows = operationalWindows({
    phenology, anomalies, stressDays, status: main.status, landCover,
  });

  // Recomendación breve (banner)
  const recommendation = buildShortRecommendation({
    status: main.status, anomalies, phenology, landCover,
  });

  const geometryInfo = {
    type: kind === 'polygon' ? 'Polygon' : 'Point',
    center: { lon: center[0], lat: center[1] },
    areaHa: kind === 'polygon' ? Number(evaluated.areaHa) : null,
    bufferMeters: kind === 'point' ? (input.bufferMeters || 100) : null,
  };

  // Narrativa hiper-dinámica (motor composicional) y detección de modo
  const narrativeCtx = {
    current: { date: evaluated.currentDate, ndvi: curr.NDVI, evi: curr.EVI, ndwi: curr.NDWI },
    historical: { ndvi: hist.NDVI, evi: hist.EVI, ndwi: hist.NDWI },
    anomalies, phenology, ranking, benchmark, yoy, stressDays,
    status: main.status, landCover, geometry: geometryInfo,
  };
  const narrative = buildNarrative(narrativeCtx);
  const reportMode = detectReportMode(narrativeCtx);

  // Re-priorizar ventanas de trabajo si estamos en modo pre-cosecha
  let opWindows = windows;
  if (reportMode === 'pre_cosecha') {
    const cosecha = {
      id: 'cosecha_logistica',
      titulo: 'Logística y humedad de grano',
      detalle: 'Coordinar con el responsable de cosecha el monitoreo de humedad de grano, disponibilidad de tolvas y ventanas de trilla.',
      prioridad: 'alta',
      momento: 'Próximas 1–3 semanas',
    };
    opWindows = [cosecha, ...windows.filter((w) => w.id !== 'cosecha')];
  }

  return {
    geometry: geometryInfo,
    current: {
      date: evaluated.currentDate,
      ndvi: curr.NDVI ?? null,
      evi: curr.EVI ?? null,
      ndwi: curr.NDWI ?? null,
    },
    historical: {
      month: currentMonth,
      yearsFrom: currentYear - 5,
      yearsTo: currentYear - 1,
      ndvi: hist.NDVI ?? null,
      evi: hist.EVI ?? null,
      ndwi: hist.NDWI ?? null,
    },
    anomalies,
    status: main.status,
    statusLabel: main.label,
    landCover,
    phenology,
    ranking,
    benchmark,
    yoy,
    stressDays,
    ndwiDaily: ndwiDailyClean,
    operationalWindows: opWindows,
    recommendation,
    storytelling: narrative.text,
    narrative, // { mode, text, sections, seed }
    reportMode,
    imageCounts: {
      recent: evaluated.recentCount,
      historical: evaluated.histCount,
    },
    timeSeries,
    tile: mapResult ? { urlFormat: mapResult.urlFormat, mapid: mapResult.mapid } : null,
    thumbnails: {
      ndviUrl: ndviThumbUrl,
      rgbUrl: rgbThumbUrl,
      bbox: thumbBbox, // [minLon, minLat, maxLon, maxLat] en EPSG:4326
    },
  };
}

function buildShortRecommendation({ status, anomalies, phenology, landCover }) {
  if (landCover === 'agua') return 'La geometría seleccionada corresponde a un cuerpo de agua.';
  const parts = [];
  if (status === 'sequia_alerta') parts.push('Sequía severa detectada. Priorizar riego e irrigación y diferir dosis altas de fertilizante.');
  else if (status === 'estres_hidrico_plaga') parts.push('Posible estrés hídrico o presión de plaga/enfermedad. Recorrer el lote para confirmar.');
  else if (status === 'observacion') parts.push('Leve desvío negativo respecto al histórico. Mantener monitoreo semanal.');
  else if (status === 'optimo') parts.push('Condiciones por encima del histórico. Buen momento para optimizar nutrición.');
  else parts.push('Condiciones dentro de rangos esperados.');
  if (phenology?.label && phenology.stage !== 'sin_datos') {
    parts.push(`Etapa estimada: ${phenology.label} (tendencia ${phenology.trend || 'estable'}).`);
  }
  const a = anomalies?.ndvi;
  if (a != null) parts.push(`Anomalía NDVI ${a > 0 ? '+' : ''}${a.toFixed(1)}%.`);
  return parts.join(' ');
}
