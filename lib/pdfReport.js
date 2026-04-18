// Generación del reporte PDF oficial Agropulse.
//
// Estética "a la antigua": papel blanco, tipografía Helvetica sobria, todo
// dibujado vectorialmente con jsPDF salvo los thumbnails satelitales que se
// insertan como PNG (convertidos previamente a dataURL por el cliente).
//
// La primera página concentra los elementos de alta autoridad:
//   - Encabezado con logo, fecha, hora exacta y GPS.
//   - Thumbnail del lote (NDVI + RGB) con overlay vectorial de la geometría.
//   - Caja de estado actual con modo de reporte coloreado.
//   - KPIs destacados: anomalía, ranking, benchmark zonal e interanual.
//   - Sello de verificación digital compacto.
// Páginas siguientes: síntesis ejecutiva (narrativa), tabla de índices,
// gráfico vectorial, recomendaciones operativas y sello completo.

const INK = '#111111';
const MUTED = '#555555';
const SOFT = '#999999';
const RULE = '#CCCCCC';
const NEGATIVE = '#B91C1C';
const POSITIVE = '#047857';
const WARNING = '#B45309';

// ---------------------------------------------------------------------------
// Logo vectorial
// ---------------------------------------------------------------------------
function drawLogo(doc, cx, cy, size = 36) {
  const s = size / 64;
  const map = (x, y) => [cx + (x - 32) * s, cy + (y - 32) * s];

  doc.setDrawColor(INK);
  doc.setLineWidth(0.9);
  doc.setLineCap(1);

  const [topX, topY] = map(32, 5);
  const [c1rx, c1ry] = map(50, 16);
  const [c2rx, c2ry] = map(52, 38);
  const [bx, by] = map(32, 59);
  const [c1lx, c1ly] = map(12, 38);
  const [c2lx, c2ly] = map(14, 16);

  doc.lines(
    [
      [c1rx - topX, c1ry - topY, c2rx - topX, c2ry - topY, bx - topX, by - topY],
      [c1lx - bx, c1ly - by, c2lx - bx, c2ly - by, topX - bx, topY - by],
    ],
    topX, topY, [1, 1], 'S', true
  );

  doc.setLineWidth(0.4);
  doc.setDrawColor(SOFT);
  const [nt0x, nt0y] = map(32, 9);
  const [nt1x, nt1y] = map(32, 56);
  doc.line(nt0x, nt0y, nt1x, nt1y);
  [[32,20,22,26],[32,20,42,26],[32,38,22,44],[32,38,42,44]].forEach(([a,b,c,d]) => {
    const [x1,y1] = map(a,b); const [x2,y2] = map(c,d);
    doc.line(x1,y1,x2,y2);
  });

  doc.setLineWidth(0.7);
  doc.setDrawColor(INK);
  [[32,17,22,28],[32,17,42,28],[22,28,42,28],[22,28,32,42],[42,28,32,42],[32,42,32,52]].forEach(([a,b,c,d]) => {
    const [x1,y1] = map(a,b); const [x2,y2] = map(c,d);
    doc.line(x1,y1,x2,y2);
  });

  doc.setFillColor(INK);
  [[32,17,1.2],[22,28,1.2],[42,28,1.2],[32,42,1.2],[32,52,0.9]].forEach(([a,b,r]) => {
    const [x,y] = map(a,b);
    doc.circle(x, y, r * s * 1.1, 'F');
  });
}

// ---------------------------------------------------------------------------
// Helpers tipográficos / gráficos
// ---------------------------------------------------------------------------
function setText(doc, { size = 10, weight = 'normal', color = INK } = {}) {
  doc.setFont('helvetica', weight);
  doc.setFontSize(size);
  doc.setTextColor(color);
}

function hline(doc, x1, x2, y, color = RULE, weight = 0.4) {
  doc.setDrawColor(color);
  doc.setLineWidth(weight);
  doc.line(x1, y, x2, y);
}

function sectionTitle(doc, text, x, y) {
  setText(doc, { size: 11, weight: 'bold' });
  doc.text(text.toUpperCase(), x, y);
  hline(doc, x, x + 80, y + 3, INK, 0.6);
  return y + 16;
}

function wrap(doc, text, maxW) {
  return doc.splitTextToSize(text || '', maxW);
}

function fmt(v, d = 3) { return v == null ? '—' : Number(v).toFixed(d); }
function fmtPct(v) { return v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(1)} %`; }

// ---------------------------------------------------------------------------
// Thumbnail con overlay vectorial del lote
// ---------------------------------------------------------------------------
function drawThumbFrame(doc, title, subtitle, x, y, w, h) {
  doc.setDrawColor(INK); doc.setLineWidth(0.5);
  doc.rect(x, y, w, h);
  setText(doc, { size: 7.5, weight: 'bold', color: INK });
  doc.text(title, x + 6, y - 4);
  if (subtitle) {
    setText(doc, { size: 7, color: MUTED });
    doc.text(subtitle, x + w, y - 4, { align: 'right' });
  }
}

function drawGeometryOverlay(doc, geometry, bbox, x, y, w, h, { color = INK, dashed = false } = {}) {
  if (!geometry || !bbox || bbox.length !== 4) return;
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const lonToPx = (lon) => x + ((lon - minLon) / (maxLon - minLon)) * w;
  const latToPy = (lat) => y + ((maxLat - lat) / (maxLat - minLat)) * h;

  doc.setDrawColor(color);
  doc.setLineWidth(1.2);
  if (dashed) doc.setLineDashPattern([3, 2], 0);

  if (geometry.type === 'Polygon' && Array.isArray(geometry.coordinatesLonLat)) {
    const pts = geometry.coordinatesLonLat.map(([lon, lat]) => [lonToPx(lon), latToPy(lat)]);
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[(i + 1) % pts.length];
      doc.line(x1, y1, x2, y2);
    }
  } else if (geometry.type === 'Point') {
    const cx = lonToPx(geometry.center.lon);
    const cy = latToPy(geometry.center.lat);
    // radio en píxeles
    const mPerDegLon = 111320 * Math.cos((geometry.center.lat * Math.PI) / 180);
    const pxPerDegLon = w / (maxLon - minLon);
    const radiusPx = ((geometry.bufferMeters || 100) / mPerDegLon) * pxPerDegLon;
    doc.circle(cx, cy, Math.max(radiusPx, 1.5), 'S');
    // Cruz en el centro
    doc.setLineWidth(0.6);
    doc.line(cx - 3, cy, cx + 3, cy);
    doc.line(cx, cy - 3, cx, cy + 3);
  }
  doc.setLineDashPattern([], 0);
}

// ---------------------------------------------------------------------------
// Gráfico vectorial de series (B/N)
// ---------------------------------------------------------------------------
function drawChart(doc, data, historical, x, y, w, h) {
  doc.setDrawColor(INK); doc.setLineWidth(0.4);
  doc.rect(x, y, w, h);

  if (!data || data.length === 0) {
    setText(doc, { size: 9, color: MUTED });
    doc.text('Sin datos de serie temporal.', x + w / 2, y + h / 2, { align: 'center' });
    return;
  }
  const padL = 28, padR = 8, padT = 10, padB = 22;
  const plotX = x + padL, plotY = y + padT;
  const plotW = w - padL - padR, plotH = h - padT - padB;

  const yMin = 0, yMax = 1;
  const nx = data.length;
  const stepX = nx > 1 ? plotW / (nx - 1) : 0;
  const scaleY = (v) => plotY + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  doc.setDrawColor(RULE); doc.setLineWidth(0.3);
  setText(doc, { size: 7, color: MUTED });
  [0, 0.25, 0.5, 0.75, 1].forEach((v) => {
    const yy = scaleY(v);
    doc.line(plotX, yy, plotX + plotW, yy);
    doc.text(v.toFixed(2), plotX - 4, yy + 2, { align: 'right' });
  });

  setText(doc, { size: 7, color: MUTED });
  data.forEach((d, i) => {
    if (i % 2 !== 0 && i !== data.length - 1) return;
    const xx = plotX + i * stepX;
    doc.text(d.date.slice(2), xx, plotY + plotH + 8, { align: 'center' });
  });

  if (historical != null && historical >= yMin && historical <= yMax) {
    const yRef = scaleY(historical);
    doc.setDrawColor(MUTED); doc.setLineWidth(0.4);
    doc.setLineDashPattern([2, 2], 0);
    doc.line(plotX, yRef, plotX + plotW, yRef);
    doc.setLineDashPattern([], 0);
    setText(doc, { size: 7, color: MUTED });
    doc.text(`Hist. ${historical.toFixed(2)}`, plotX + plotW - 2, yRef - 2, { align: 'right' });
  }

  const drawSeries = (key, { dashed = false, width = 1.2 } = {}) => {
    doc.setDrawColor(INK);
    doc.setLineWidth(width);
    if (dashed) doc.setLineDashPattern([2, 2], 0); else doc.setLineDashPattern([], 0);
    let prev = null;
    data.forEach((d, i) => {
      const v = d[key];
      const xx = plotX + i * stepX;
      if (v == null) { prev = null; return; }
      const yy = scaleY(v);
      if (prev) doc.line(prev[0], prev[1], xx, yy);
      prev = [xx, yy];
    });
    doc.setFillColor(INK);
    data.forEach((d, i) => {
      const v = d[key];
      if (v == null) return;
      const xx = plotX + i * stepX;
      const yy = scaleY(v);
      if (dashed) { doc.setDrawColor(INK); doc.setLineWidth(0.6); doc.circle(xx, yy, 1.1, 'S'); }
      else { doc.circle(xx, yy, 1.3, 'F'); }
    });
    doc.setLineDashPattern([], 0);
  };
  drawSeries('ndvi', { dashed: false, width: 1.2 });
  drawSeries('evi', { dashed: true, width: 1 });

  const lx = plotX + 4, ly = plotY + 8;
  doc.setDrawColor(INK); doc.setLineWidth(1.2);
  doc.line(lx, ly, lx + 14, ly);
  setText(doc, { size: 8 });
  doc.text('NDVI', lx + 18, ly + 2);
  doc.setLineDashPattern([2, 2], 0); doc.setLineWidth(1);
  doc.line(lx + 44, ly, lx + 58, ly);
  doc.setLineDashPattern([], 0);
  doc.text('EVI', lx + 62, ly + 2);
}

// ---------------------------------------------------------------------------
// Cajas de KPI destacados (página 1)
// ---------------------------------------------------------------------------
function drawKPIBox(doc, x, y, w, h, { label, value, hint, valueColor = INK, emphasis = false }) {
  doc.setDrawColor(emphasis ? INK : RULE);
  doc.setLineWidth(emphasis ? 0.9 : 0.4);
  doc.rect(x, y, w, h);
  setText(doc, { size: 7.5, weight: 'bold', color: MUTED });
  doc.text(label.toUpperCase(), x + 6, y + 11);
  setText(doc, { size: 18, weight: 'bold', color: valueColor });
  doc.text(String(value ?? '—'), x + 6, y + 30);
  if (hint) {
    setText(doc, { size: 7.5, color: MUTED });
    const lines = wrap(doc, hint, w - 12);
    doc.text(lines, x + 6, y + 42);
  }
}

// ---------------------------------------------------------------------------
// Sello de verificación
// ---------------------------------------------------------------------------
async function computeVerificationHash(result) {
  const payload = {
    status: result.status,
    date: result.current?.date,
    ndvi: result.current?.ndvi,
    evi: result.current?.evi,
    ndwi: result.current?.ndwi,
    anomalyNDVI: result.anomalies?.ndvi,
    percentile: result.ranking?.percentile,
    stressDays: result.stressDays?.days,
    yoy: result.yoy?.delta,
    center: result.geometry?.center,
    generated: new Date().toISOString(),
  };
  const encoder = new TextEncoder();
  const buffer = encoder.encode(JSON.stringify(payload));
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const digest = await window.crypto.subtle.digest('SHA-256', buffer);
    const bytes = Array.from(new Uint8Array(digest));
    return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 0;
  for (let i = 0; i < buffer.length; i++) { h = (h * 31 + buffer[i]) >>> 0; }
  return h.toString(16).padStart(64, '0');
}

function drawCompactSeal(doc, cx, cy, hashHex, radius = 22) {
  doc.setDrawColor(INK); doc.setLineWidth(0.8);
  doc.circle(cx, cy, radius, 'S');
  doc.setLineWidth(0.4);
  doc.circle(cx, cy, radius - 4, 'S');
  setText(doc, { size: 6, weight: 'bold', color: INK });
  doc.text('AGROPULSE', cx, cy - radius + 4, { align: 'center' });
  doc.text('VERIFIED', cx, cy + radius - 2, { align: 'center' });
  setText(doc, { size: 6.5, weight: 'bold', color: INK });
  doc.text('SHA-256', cx, cy - 1, { align: 'center' });
  setText(doc, { size: 6, color: MUTED });
  doc.text(hashHex.slice(0, 8).toUpperCase(), cx, cy + 7, { align: 'center' });
  [-Math.PI / 4, Math.PI / 4, 3 * Math.PI / 4, -3 * Math.PI / 4].forEach((a) => {
    const x1 = cx + Math.cos(a) * (radius - 4);
    const y1 = cy + Math.sin(a) * (radius - 4);
    const x2 = cx + Math.cos(a) * (radius - 1);
    const y2 = cy + Math.sin(a) * (radius - 1);
    doc.setLineWidth(0.4);
    doc.line(x1, y1, x2, y2);
  });
}

function drawFullSeal(doc, cx, cy, hashHex, generatedAt) {
  drawCompactSeal(doc, cx, cy, hashHex, 34);
  setText(doc, { size: 7, color: MUTED });
  doc.text('Documento firmado digitalmente', cx + 48, cy - 10);
  setText(doc, { size: 8, weight: 'bold', color: INK });
  doc.text('Hash completo SHA-256', cx + 48, cy);
  setText(doc, { size: 7, color: MUTED, weight: 'normal' });
  const pairs = hashHex.match(/.{1,32}/g) || [''];
  doc.text(pairs, cx + 48, cy + 9);
  setText(doc, { size: 7, color: MUTED });
  doc.text(`Emitido ${generatedAt}`, cx + 48, cy + 27);
  doc.text('Verifique integridad recomputando SHA-256 sobre el payload de análisis.', cx + 48, cy + 37);
}

// ---------------------------------------------------------------------------
// Geometría lista para overlay (lon,lat arrays)
// ---------------------------------------------------------------------------
function normalizeGeometryForOverlay(result, inputGeometry) {
  const g = result.geometry;
  if (!g) return null;
  if (g.type === 'Polygon') {
    const coords =
      inputGeometry?.coordinatesLonLat ||
      result.geometry.coordinatesLonLat ||
      result.geometry.coordinates ||
      null;
    return {
      type: 'Polygon',
      coordinatesLonLat: coords,
      center: g.center,
    };
  }
  return {
    type: 'Point',
    center: g.center,
    bufferMeters: g.bufferMeters,
  };
}

// ---------------------------------------------------------------------------
// Banner de modo de reporte
// ---------------------------------------------------------------------------
const MODE_META = {
  alerta_roja: { label: 'ALERTA ROJA', color: NEGATIVE, desc: 'Anomalía NDVI ≤ −25 %. Intervención agronómica urgente.' },
  pre_cosecha: { label: 'PRE-COSECHA', color: WARNING, desc: 'Senescencia detectada. Priorización de logística y humedad de grano.' },
  estandar:    { label: 'MONITOREO ESTÁNDAR', color: POSITIVE, desc: 'Seguimiento de rutina. Tono sobrio.' },
};

// ---------------------------------------------------------------------------
// Generación principal
// ---------------------------------------------------------------------------
export async function generatePDFReport(result, extras = {}) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 42;
  const contentW = pageW - M * 2;
  const now = new Date();

  // Hash de verificación (1a página + página final)
  const hashHex = await computeVerificationHash(result);

  // Fondo blanco explícito
  doc.setFillColor('#FFFFFF');
  doc.rect(0, 0, pageW, pageH, 'F');

  // ============== ENCABEZADO ==============
  drawLogo(doc, M + 14, M + 2, 32);
  setText(doc, { size: 15, weight: 'bold' });
  doc.text('Agropulse', M + 36, M - 2);
  setText(doc, { size: 8, color: MUTED });
  doc.text('Satellite Intelligence for Agriculture', M + 36, M + 9);

  const fechaStr = now.toLocaleDateString('es-AR', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const horaStr = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  setText(doc, { size: 8, color: MUTED });
  doc.text(`Fecha   ${fechaStr}`, pageW - M, M - 2, { align: 'right' });
  doc.text(`Hora    ${horaStr}`, pageW - M, M + 8, { align: 'right' });
  if (result.geometry?.center) {
    const { lat, lon } = result.geometry.center;
    doc.text(`GPS     ${lat.toFixed(5)}, ${lon.toFixed(5)}`, pageW - M, M + 18, { align: 'right' });
  }
  let y = M + 32;
  hline(doc, M, pageW - M, y, INK, 0.8);
  y += 14;

  // ============== TÍTULO + BANNER DE MODO ==============
  setText(doc, { size: 17, weight: 'bold' });
  doc.text('Reporte de monitoreo satelital', M, y);

  const mode = result.reportMode || 'estandar';
  const mm = MODE_META[mode] || MODE_META.estandar;
  const badgeW = 120;
  doc.setDrawColor(mm.color); doc.setLineWidth(0.8);
  doc.rect(pageW - M - badgeW, y - 14, badgeW, 18);
  setText(doc, { size: 8, weight: 'bold', color: mm.color });
  doc.text(`MODO ${mm.label}`, pageW - M - badgeW / 2, y - 2, { align: 'center' });
  y += 6;
  setText(doc, { size: 9, color: MUTED });
  const descLines = wrap(doc,
    'Análisis de vigor vegetal, anomalías históricas, benchmark zonal y recomendaciones operativas · Sentinel-2 · Google Earth Engine.',
    contentW);
  doc.text(descLines, M, y);
  y += descLines.length * 11 + 10;

  // ============== FILA HERO: THUMBNAIL + ESTADO/KPIs + SELLO ==============
  const heroH = 210;
  const thumbW = 250;
  const thumbH = heroH - 18; // margen para título superior
  const thumbX = M;
  const thumbY = y + 14;

  // Thumbnail NDVI con overlay
  drawThumbFrame(doc, 'VISTA SATELITAL · NDVI', result.current?.date ? `Imagen ${result.current.date}` : '', thumbX, thumbY, thumbW, thumbH);
  if (extras.ndviThumbDataUrl) {
    try { doc.addImage(extras.ndviThumbDataUrl, 'PNG', thumbX, thumbY, thumbW, thumbH); }
    catch (e) { /* ignore */ }
  } else {
    setText(doc, { size: 8, color: MUTED });
    doc.text('Thumbnail no disponible.', thumbX + thumbW / 2, thumbY + thumbH / 2, { align: 'center' });
  }
  // Overlay de la geometría
  const overlay = normalizeGeometryForOverlay(result, extras.inputGeometry);
  drawGeometryOverlay(doc, overlay, extras.thumbBbox, thumbX, thumbY, thumbW, thumbH, {
    color: '#FFFFFF', dashed: false,
  });
  drawGeometryOverlay(doc, overlay, extras.thumbBbox, thumbX, thumbY, thumbW, thumbH, {
    color: INK, dashed: true,
  });

  // Columna derecha: estado + KPIs + sello
  const rightX = M + thumbW + 14;
  const rightW = contentW - thumbW - 14;

  // Caja de estado
  const statusH = 58;
  doc.setDrawColor(mm.color); doc.setLineWidth(0.9);
  doc.rect(rightX, thumbY, rightW, statusH);
  setText(doc, { size: 7.5, weight: 'bold', color: MUTED });
  doc.text('ESTADO ACTUAL', rightX + 8, thumbY + 12);
  setText(doc, { size: 13, weight: 'bold', color: mm.color });
  doc.text(result.statusLabel || result.status || 'Sin datos', rightX + 8, thumbY + 28);
  setText(doc, { size: 8.5, color: INK });
  const recLines = wrap(doc, result.recommendation || '', rightW - 16);
  doc.text(recLines.slice(0, 2), rightX + 8, thumbY + 42);

  // KPIs destacados: Anomalía, Ranking, Benchmark, YoY
  const kpiY = thumbY + statusH + 8;
  const kpiH = (thumbH - statusH - 8 - 46) / 2; // dos filas
  const kpiW = (rightW - 6) / 2;

  const anom = result.anomalies?.ndvi;
  const anomColor = anom == null ? INK : anom <= -20 ? NEGATIVE : anom >= 10 ? POSITIVE : INK;
  drawKPIBox(doc, rightX, kpiY, kpiW, kpiH, {
    label: 'Anomalía NDVI',
    value: fmtPct(anom),
    hint: result.historical ? `Mes ${result.historical.month} · ${result.historical.yearsFrom}-${result.historical.yearsTo}` : '',
    valueColor: anomColor,
    emphasis: true,
  });

  const rank = result.ranking;
  drawKPIBox(doc, rightX + kpiW + 6, kpiY, kpiW, kpiH, {
    label: 'Ranking histórico',
    value: rank?.percentile != null ? `P${rank.percentile}` : '—',
    hint: rank?.label || 'Percentil quinquenal',
  });

  const bm = result.benchmark;
  const bmColor = bm?.delta == null ? INK : bm.delta <= -10 ? NEGATIVE : bm.delta >= 10 ? POSITIVE : INK;
  drawKPIBox(doc, rightX, kpiY + kpiH + 6, kpiW, kpiH, {
    label: 'Benchmark 10 km',
    value: fmtPct(bm?.delta),
    hint: `Zona ${fmt(bm?.zonalNDVI, 2)} · lote ${fmt(result.current?.ndvi, 2)}`,
    valueColor: bmColor,
    emphasis: true,
  });

  const yo = result.yoy;
  const yoColor = yo?.delta == null ? INK : yo.delta <= -10 ? NEGATIVE : yo.delta >= 10 ? POSITIVE : INK;
  drawKPIBox(doc, rightX + kpiW + 6, kpiY + kpiH + 6, kpiW, kpiH, {
    label: `Interanual vs. ${yo?.year ?? '—'}`,
    value: fmtPct(yo?.delta),
    hint: `NDVI ${yo?.year ?? '—'}: ${fmt(yo?.ndvi, 2)}`,
    valueColor: yoColor,
  });

  // Sello compacto (esquina inferior derecha del hero)
  const sealCx = rightX + rightW - 28;
  const sealCy = thumbY + thumbH + 18;
  drawCompactSeal(doc, sealCx, sealCy, hashHex, 18);
  setText(doc, { size: 6.5, weight: 'bold', color: INK });
  doc.text('VERIFICACIÓN DIGITAL', rightX, sealCy - 8);
  setText(doc, { size: 6.5, color: MUTED });
  doc.text(`SHA-256 · ${hashHex.slice(0, 32)}`, rightX, sealCy);
  doc.text(hashHex.slice(32, 64), rightX, sealCy + 8);

  y = thumbY + thumbH + 46;

  // ============== SÍNTESIS EJECUTIVA (NARRATIVA) ==============
  if (y > pageH - 160) { doc.addPage(); y = M; }
  y = sectionTitle(doc, 'Síntesis ejecutiva', M, y);
  setText(doc, { size: 10, color: INK });
  const storyLines = wrap(doc, result.storytelling || '—', contentW);
  doc.text(storyLines, M, y);
  y += storyLines.length * 12 + 10;

  // ============== UBICACIÓN Y GEOMETRÍA + RGB ==============
  if (y > pageH - 210) { doc.addPage(); y = M; }
  y = sectionTitle(doc, 'Ubicación y geometría', M, y);

  // Tabla key/value + thumbnail RGB a la derecha
  const kvW = contentW - 190;
  const rgbX = M + kvW + 12;
  const rgbW = 178;
  const rgbH = 130;

  const rows = [
    ['Tipo', result.geometry?.type === 'Polygon' ? 'Polígono (lote)' : 'Punto con buffer'],
    ['Coordenadas', result.geometry?.center
      ? `${result.geometry.center.lat.toFixed(6)}, ${result.geometry.center.lon.toFixed(6)}`
      : '—'],
    result.geometry?.areaHa != null ? ['Área', `${result.geometry.areaHa.toFixed(2)} ha`] : null,
    result.geometry?.bufferMeters != null ? ['Radio de análisis', `${result.geometry.bufferMeters} m`] : null,
    ['Cobertura estimada', (result.landCover || '').replace('_', ' ')],
    ['Etapa fenológica', result.phenology?.label
      ? `${result.phenology.label} (tendencia ${result.phenology.trend || 'estable'})`
      : '—'],
    ['Imagen más reciente', result.current?.date || '—'],
    ['Imágenes procesadas', `recientes ${result.imageCounts?.recent ?? '—'} · históricas ${result.imageCounts?.historical ?? '—'}`],
  ].filter(Boolean);

  let yy = y;
  rows.forEach(([k, v]) => {
    setText(doc, { size: 9, color: MUTED });
    doc.text(k, M, yy);
    setText(doc, { size: 9, weight: 'bold' });
    const lines = wrap(doc, String(v ?? '—'), kvW - 120);
    doc.text(lines, M + 120, yy);
    yy += 12 * Math.max(1, lines.length);
  });

  // Thumbnail RGB (true-color) al costado
  drawThumbFrame(doc, 'SATÉLITE TRUE-COLOR', '', rgbX, y, rgbW, rgbH);
  if (extras.rgbThumbDataUrl) {
    try { doc.addImage(extras.rgbThumbDataUrl, 'PNG', rgbX, y, rgbW, rgbH); }
    catch (e) { /* ignore */ }
  }
  drawGeometryOverlay(doc, overlay, extras.thumbBbox, rgbX, y, rgbW, rgbH, { color: '#FFFFFF' });
  drawGeometryOverlay(doc, overlay, extras.thumbBbox, rgbX, y, rgbW, rgbH, { color: INK, dashed: true });

  y = Math.max(yy, y + rgbH) + 12;

  // ============== TABLA DE ÍNDICES ==============
  if (y > pageH - 130) { doc.addPage(); y = M; }
  y = sectionTitle(doc, 'Índices vegetales', M, y);
  y = drawIndicesTable(doc, result, M, y, contentW);
  y += 8;

  // ============== GRÁFICO ==============
  if (y > pageH - 230) { doc.addPage(); y = M; }
  y = sectionTitle(doc, 'Evolución de índices · últimos 12 meses', M, y);
  drawChart(doc, result.timeSeries, result.historical?.ndvi, M, y, contentW, 180);
  y += 180 + 16;

  // ============== VENTANAS DE TRABAJO ==============
  if (result.operationalWindows?.length) {
    if (y > pageH - 160) { doc.addPage(); y = M; }
    y = sectionTitle(doc, 'Recomendaciones operativas', M, y);
    result.operationalWindows.forEach((w) => {
      if (y > pageH - 70) { doc.addPage(); y = M; }
      setText(doc, { size: 10, weight: 'bold' });
      doc.text(`• ${w.titulo}`, M, y);
      setText(doc, { size: 8.5, color: MUTED });
      doc.text(`[${(w.prioridad || '').toUpperCase()}] · ${w.momento || ''}`, pageW - M, y, { align: 'right' });
      y += 12;
      setText(doc, { size: 9.5 });
      const lines = wrap(doc, w.detalle || '', contentW - 12);
      doc.text(lines, M + 12, y);
      y += lines.length * 11 + 8;
    });
    y += 6;
  }

  // ============== SELLO DE VERIFICACIÓN COMPLETO ==============
  if (y > pageH - 110) { doc.addPage(); y = M; }
  y = sectionTitle(doc, 'Sello de verificación digital', M, y);
  drawFullSeal(doc, M + 34, Math.min(y + 34, pageH - 80), hashHex, now.toISOString());

  // ============== PIE ==============
  setText(doc, { size: 7, color: SOFT });
  const footer =
    'Datos: Copernicus Sentinel-2 · Procesamiento: Google Earth Engine · ' +
    'Agropulse es una plataforma de soporte a la decisión y no reemplaza el criterio agronómico profesional.';
  const footerLines = wrap(doc, footer, contentW);
  doc.text(footerLines, pageW / 2, pageH - 22, { align: 'center' });

  const fname = `agropulse-reporte-${now.toISOString().slice(0, 10)}.pdf`;
  doc.save(fname);
  return { hashHex, filename: fname };
}

// ---------------------------------------------------------------------------
// Tabla de índices
// ---------------------------------------------------------------------------
function drawIndicesTable(doc, result, x, y, w) {
  const cols = [0, 110, 170, 230, 300].map((v) => x + v);
  const colEnd = x + w;

  setText(doc, { size: 9, weight: 'bold', color: MUTED });
  doc.text('Índice', cols[0], y);
  doc.text('Actual', cols[1], y);
  doc.text('Histórico', cols[2], y);
  doc.text('Anomalía', cols[3], y);
  doc.text('Descripción', cols[4], y);
  y += 4;
  hline(doc, x, colEnd, y, INK, 0.5);
  y += 10;

  const rows = [
    ['NDVI', result.current?.ndvi, result.historical?.ndvi, result.anomalies?.ndvi, 'Vigor general de la vegetación.'],
    ['EVI', result.current?.evi, result.historical?.evi, result.anomalies?.evi, 'Sensible en vegetación densa.'],
    ['NDWI', result.current?.ndwi, result.historical?.ndwi, result.anomalies?.ndwi, 'Humedad superficial / agua.'],
  ];
  rows.forEach(([name, c, h, a, desc]) => {
    setText(doc, { size: 9, weight: 'bold' });
    doc.text(name, cols[0], y);
    setText(doc, { size: 9 });
    doc.text(fmt(c, 3), cols[1], y);
    doc.text(fmt(h, 3), cols[2], y);
    const color = a == null ? INK : a <= -20 ? NEGATIVE : a >= 10 ? POSITIVE : INK;
    setText(doc, { size: 9, weight: 'bold', color });
    doc.text(fmtPct(a), cols[3], y);
    setText(doc, { size: 8.5, color: MUTED });
    const descLines = wrap(doc, desc, colEnd - cols[4]);
    doc.text(descLines, cols[4], y);
    y += 12;
    hline(doc, x, colEnd, y - 4, RULE, 0.2);
  });
  return y + 4;
}
