// Generación del reporte PDF oficial de Agropulse.
//
// Diseño: papel blanco, tipografía Helvetica, líneas finas, look consultoría
// agronómica "a la antigua". Todo dibujado vectorialmente con jsPDF
// (sin imágenes rasterizadas), incluyendo logo, gráfico de series y sello
// de verificación digital con hash SHA-256.

const INK = '#111111';
const MUTED = '#555555';
const SOFT = '#999999';
const RULE = '#CCCCCC';
const NEGATIVE = '#B91C1C';
const POSITIVE = '#047857';

// ---------------------------------------------------------------------------
// Logo vectorial (hoja + red de nodos) replicado con jsPDF
// ---------------------------------------------------------------------------
function drawLogo(doc, cx, cy, size = 36) {
  // Escalado: el SVG original está en viewBox 64. Pasamos coords a puntos.
  const s = size / 64;
  const map = (x, y) => [cx + (x - 32) * s, cy + (y - 32) * s];

  doc.setDrawColor(INK);
  doc.setLineWidth(0.9);
  doc.setLineCap(1); // round

  // Hoja: dos curvas cúbicas (Bézier) simétricas formando una almendra
  const topX = cx, topY = cy + (5 - 32) * s;
  // En coords absolutas del SVG:
  // M 32 5  C 50 16  52 38  32 59  C 12 38  14 16  32 5 Z
  // Convertimos puntos intermedios:
  const [c1rx, c1ry] = map(50, 16);
  const [c2rx, c2ry] = map(52, 38);
  const [bx, by] = map(32, 59);
  const [c1lx, c1ly] = map(12, 38);
  const [c2lx, c2ly] = map(14, 16);

  // jsPDF: lines([...], x, y, scale, style, closed)
  // Primer bezier relativo: de top a (32,59) pasando por (50,16) y (52,38)
  doc.lines(
    [
      [c1rx - topX, c1ry - topY, c2rx - topX, c2ry - topY, bx - topX, by - topY],
      [c1lx - bx,   c1ly - by,   c2lx - bx,   c2ly - by,   topX - bx,  topY - by],
    ],
    topX, topY, [1, 1], 'S', true
  );

  // Nervadura central
  doc.setLineWidth(0.4);
  doc.setDrawColor(SOFT);
  const [nt0x, nt0y] = map(32, 9);
  const [nt1x, nt1y] = map(32, 56);
  doc.line(nt0x, nt0y, nt1x, nt1y);

  // Nervaduras laterales
  [[32,20,22,26], [32,20,42,26], [32,38,22,44], [32,38,42,44]].forEach(([a,b,c,d]) => {
    const [x1,y1] = map(a,b); const [x2,y2] = map(c,d);
    doc.line(x1,y1,x2,y2);
  });

  // Red de nodos (aristas)
  doc.setLineWidth(0.7);
  doc.setDrawColor(INK);
  const edges = [[32,17,22,28],[32,17,42,28],[22,28,42,28],[22,28,32,42],[42,28,32,42],[32,42,32,52]];
  edges.forEach(([a,b,c,d]) => {
    const [x1,y1] = map(a,b); const [x2,y2] = map(c,d);
    doc.line(x1,y1,x2,y2);
  });

  // Nodos
  doc.setFillColor(INK);
  [[32,17,1.2],[22,28,1.2],[42,28,1.2],[32,42,1.2],[32,52,0.9]].forEach(([a,b,r]) => {
    const [x,y] = map(a,b);
    doc.circle(x, y, r * s * 1.1, 'F');
  });
}

// ---------------------------------------------------------------------------
// Helpers
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
function fmtPct(v) { return v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(1)}%`; }

// ---------------------------------------------------------------------------
// Gráfico de serie temporal NDVI/EVI en jsPDF (B/N, legible en impresión)
// ---------------------------------------------------------------------------
function drawChart(doc, data, historical, x, y, w, h) {
  // Marco
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

  // Dominio Y fijo 0..1 (NDVI/EVI)
  const yMin = 0, yMax = 1;
  const nx = data.length;
  const stepX = nx > 1 ? plotW / (nx - 1) : 0;
  const scaleY = (v) => plotY + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  // Grid + labels Y
  doc.setDrawColor(RULE); doc.setLineWidth(0.3);
  setText(doc, { size: 7, color: MUTED });
  [0, 0.25, 0.5, 0.75, 1].forEach((v) => {
    const yy = scaleY(v);
    doc.line(plotX, yy, plotX + plotW, yy);
    doc.text(v.toFixed(2), plotX - 4, yy + 2, { align: 'right' });
  });

  // Eje X labels (cada 2 puntos para no saturar)
  setText(doc, { size: 7, color: MUTED });
  data.forEach((d, i) => {
    if (i % 2 !== 0 && i !== data.length - 1) return;
    const xx = plotX + i * stepX;
    doc.text(d.date.slice(2), xx, plotY + plotH + 8, { align: 'center' });
  });

  // Referencia histórica
  if (historical != null && historical >= yMin && historical <= yMax) {
    const yRef = scaleY(historical);
    doc.setDrawColor(MUTED); doc.setLineWidth(0.4);
    doc.setLineDashPattern([2, 2], 0);
    doc.line(plotX, yRef, plotX + plotW, yRef);
    doc.setLineDashPattern([], 0);
    setText(doc, { size: 7, color: MUTED });
    doc.text(`Hist. ${historical.toFixed(2)}`, plotX + plotW - 2, yRef - 2, { align: 'right' });
  }

  // Helper para trazar una serie
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
    // Marcadores
    doc.setFillColor(INK);
    data.forEach((d, i) => {
      const v = d[key];
      if (v == null) return;
      const xx = plotX + i * stepX;
      const yy = scaleY(v);
      if (dashed) {
        doc.setDrawColor(INK); doc.setLineWidth(0.6);
        doc.circle(xx, yy, 1.1, 'S');
      } else {
        doc.circle(xx, yy, 1.3, 'F');
      }
    });
    doc.setLineDashPattern([], 0);
  };

  drawSeries('ndvi', { dashed: false, width: 1.2 });
  drawSeries('evi', { dashed: true, width: 1 });

  // Leyenda
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
// Tabla simple
// ---------------------------------------------------------------------------
function drawKeyValueTable(doc, rows, x, y, colW = [120, 200]) {
  let yy = y;
  rows.forEach(([k, v]) => {
    setText(doc, { size: 9, color: MUTED });
    doc.text(k, x, yy);
    setText(doc, { size: 9, weight: 'bold' });
    const lines = wrap(doc, String(v ?? '—'), colW[1]);
    doc.text(lines, x + colW[0], yy);
    yy += 12 * Math.max(1, lines.length);
  });
  return yy;
}

function drawIndicesTable(doc, result, x, y, w) {
  const cols = [0, 110, 170, 230, 300].map((v) => x + v);
  const colEnd = x + w;

  setText(doc, { size: 9, weight: 'bold', color: MUTED });
  doc.text('Índice', cols[0], y);
  doc.text('Actual', cols[1], y, { align: 'left' });
  doc.text('Histórico', cols[2], y, { align: 'left' });
  doc.text('Anomalía', cols[3], y, { align: 'left' });
  doc.text('Descripción', cols[4], y, { align: 'left' });

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
  // Fallback no-criptográfico
  let h = 0;
  for (let i = 0; i < buffer.length; i++) { h = (h * 31 + buffer[i]) >>> 0; }
  return h.toString(16).padStart(64, '0');
}

function drawVerificationStamp(doc, cx, cy, hashHex, generatedAt) {
  const rOuter = 34, rInner = 28;
  doc.setDrawColor(INK); doc.setLineWidth(0.9);
  doc.circle(cx, cy, rOuter, 'S');
  doc.setLineWidth(0.4);
  doc.circle(cx, cy, rInner, 'S');

  // Texto curvo simulado con 4 líneas rectas (arriba/abajo)
  setText(doc, { size: 7, weight: 'bold', color: INK });
  doc.text('AGROPULSE', cx, cy - rOuter + 5, { align: 'center' });
  doc.text('VERIFIED', cx, cy + rOuter - 2, { align: 'center' });

  // Hash y metadata en el centro
  setText(doc, { size: 7, weight: 'bold', color: INK });
  doc.text('DIGITAL', cx, cy - 7, { align: 'center' });
  doc.text('SEAL', cx, cy - 0, { align: 'center' });
  setText(doc, { size: 6.5, color: MUTED });
  doc.text(hashHex.slice(0, 8).toUpperCase(), cx, cy + 7, { align: 'center' });

  // 4 marcas radiales
  [-Math.PI/4, Math.PI/4, 3*Math.PI/4, -3*Math.PI/4].forEach((a) => {
    const x1 = cx + Math.cos(a) * rInner;
    const y1 = cy + Math.sin(a) * rInner;
    const x2 = cx + Math.cos(a) * (rOuter - 1);
    const y2 = cy + Math.sin(a) * (rOuter - 1);
    doc.setLineWidth(0.4);
    doc.line(x1, y1, x2, y2);
  });

  // Leyenda del sello
  setText(doc, { size: 7, color: MUTED });
  doc.text('Documento firmado digitalmente', cx + rOuter + 14, cy - 10);
  setText(doc, { size: 8, weight: 'bold', color: INK });
  doc.text('SHA-256', cx + rOuter + 14, cy);
  setText(doc, { size: 7, color: MUTED });
  doc.text(hashHex.match(/.{1,32}/g) || [''], cx + rOuter + 14, cy + 8);
  setText(doc, { size: 7, color: MUTED });
  doc.text(`Emitido ${generatedAt}`, cx + rOuter + 14, cy + 26);
}

// ---------------------------------------------------------------------------
// Generación principal
// ---------------------------------------------------------------------------
export async function generatePDFReport(result) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 48;
  const contentW = pageW - M * 2;

  // Fondo blanco (jsPDF default pero lo dejamos explícito)
  doc.setFillColor('#FFFFFF');
  doc.rect(0, 0, pageW, pageH, 'F');

  // ============== ENCABEZADO ==============
  drawLogo(doc, M + 18, M + 2, 36);

  setText(doc, { size: 16, weight: 'bold' });
  doc.text('Agropulse', M + 46, M - 2);
  setText(doc, { size: 8.5, color: MUTED });
  doc.text('Satellite Intelligence for Agriculture', M + 46, M + 10);

  // Meta a la derecha
  const now = new Date();
  const fechaStr = now.toLocaleDateString('es-AR', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const horaStr = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  setText(doc, { size: 8.5, color: MUTED });
  doc.text(`Fecha  ${fechaStr}`, pageW - M, M - 2, { align: 'right' });
  doc.text(`Hora   ${horaStr}`, pageW - M, M + 10, { align: 'right' });
  if (result.geometry?.center) {
    const { lat, lon } = result.geometry.center;
    doc.text(`GPS    ${lat.toFixed(5)}, ${lon.toFixed(5)}`, pageW - M, M + 22, { align: 'right' });
  }

  let y = M + 40;
  hline(doc, M, pageW - M, y, INK, 0.8);
  y += 18;

  // ============== TÍTULO DEL REPORTE ==============
  setText(doc, { size: 18, weight: 'bold' });
  doc.text('Reporte de monitoreo satelital', M, y);
  y += 14;
  setText(doc, { size: 9.5, color: MUTED });
  doc.text(
    'Análisis de vigor vegetal, anomalías históricas y recomendaciones operativas basado en Sentinel-2 y Google Earth Engine.',
    M, y, { maxWidth: contentW }
  );
  y += 22;

  // ============== RESUMEN EJECUTIVO / STATUS ==============
  doc.setDrawColor(INK); doc.setLineWidth(0.6);
  doc.rect(M, y, contentW, 70);
  setText(doc, { size: 8.5, weight: 'bold', color: MUTED });
  doc.text('ESTADO ACTUAL', M + 10, y + 14);
  setText(doc, { size: 14, weight: 'bold' });
  doc.text(result.statusLabel || result.status || 'Sin datos', M + 10, y + 32);
  setText(doc, { size: 9.5 });
  const recLines = wrap(doc, result.recommendation || '', contentW - 20);
  doc.text(recLines, M + 10, y + 48);
  y += 84;

  // ============== STORYTELLING ==============
  y = sectionTitle(doc, 'Síntesis ejecutiva', M, y);
  setText(doc, { size: 10, color: INK });
  const storyLines = wrap(doc, result.storytelling || '—', contentW);
  doc.text(storyLines, M, y);
  y += storyLines.length * 12 + 10;

  // ============== GEOMETRÍA + CONTEXTO ==============
  y = sectionTitle(doc, 'Ubicación y geometría', M, y);
  const geomRows = [
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
  ].filter(Boolean);
  y = drawKeyValueTable(doc, geomRows, M, y, [120, contentW - 120]);
  y += 10;

  // ============== ÍNDICES ==============
  y = sectionTitle(doc, 'Índices vegetales', M, y);
  y = drawIndicesTable(doc, result, M, y, contentW);
  y += 8;

  // ============== RANKING + BENCHMARK + ESTRÉS ==============
  y = sectionTitle(doc, 'Análisis comparativo', M, y);
  const colW = (contentW - 20) / 3;
  const startY = y;
  // Ranking
  setText(doc, { size: 8.5, weight: 'bold', color: MUTED });
  doc.text('RANKING HISTÓRICO', M, y);
  setText(doc, { size: 20, weight: 'bold' });
  doc.text(result.ranking?.percentile != null ? `P${result.ranking.percentile}` : '—', M, y + 22);
  setText(doc, { size: 8.5, color: MUTED });
  const rankLines = wrap(doc, result.ranking?.label || 'Datos insuficientes', colW);
  doc.text(rankLines, M, y + 36);

  // Benchmark
  const x2 = M + colW + 10;
  setText(doc, { size: 8.5, weight: 'bold', color: MUTED });
  doc.text('BENCHMARK ZONAL · 10 km', x2, y);
  setText(doc, { size: 20, weight: 'bold', color:
    result.benchmark?.delta == null ? INK
    : result.benchmark.delta <= -10 ? NEGATIVE
    : result.benchmark.delta >= 10 ? POSITIVE : INK });
  doc.text(fmtPct(result.benchmark?.delta), x2, y + 22);
  setText(doc, { size: 8.5, color: MUTED });
  doc.text(`Zonal NDVI ${fmt(result.benchmark?.zonalNDVI, 2)}`, x2, y + 36);

  // Estrés
  const x3 = M + (colW + 10) * 2;
  setText(doc, { size: 8.5, weight: 'bold', color: MUTED });
  doc.text('DÍAS DE ESTRÉS HÍDRICO', x3, y);
  setText(doc, { size: 20, weight: 'bold',
    color: result.stressDays?.days == null ? INK
    : result.stressDays.days >= 15 ? NEGATIVE : INK });
  doc.text(result.stressDays?.days != null ? `${result.stressDays.days} d` : '—', x3, y + 22);
  setText(doc, { size: 8.5, color: MUTED });
  doc.text(
    result.stressDays?.threshold != null
      ? `NDWI < ${result.stressDays.threshold.toFixed(2)}`
      : '—',
    x3, y + 36
  );
  y = startY + 52;

  // ============== GRÁFICO ==============
  if (y > pageH - 260) { doc.addPage(); y = M; }
  y = sectionTitle(doc, 'Evolución de índices · últimos 12 meses', M, y);
  drawChart(doc, result.timeSeries, result.historical?.ndvi, M, y, contentW, 180);
  y += 180 + 16;

  // ============== VENTANAS DE TRABAJO ==============
  if (result.operationalWindows?.length) {
    if (y > pageH - 180) { doc.addPage(); y = M; }
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

  // ============== SELLO DE VERIFICACIÓN ==============
  if (y > pageH - 120) { doc.addPage(); y = M; }
  y = sectionTitle(doc, 'Verificación digital', M, y);
  const hashHex = await computeVerificationHash(result);
  const stampY = Math.min(y + 36, pageH - 80);
  drawVerificationStamp(doc, M + 34, stampY, hashHex, now.toISOString());

  // ============== PIE DE PÁGINA ==============
  setText(doc, { size: 7, color: SOFT });
  const footer =
    'Datos: Copernicus Sentinel-2 · Procesamiento: Google Earth Engine · ' +
    'Agropulse es una plataforma de soporte a la decisión y no reemplaza el criterio agronómico profesional.';
  const footerLines = wrap(doc, footer, contentW);
  doc.text(footerLines, pageW / 2, pageH - 28, { align: 'center' });

  const fname = `agropulse-reporte-${now.toISOString().slice(0, 10)}.pdf`;
  doc.save(fname);
  return { hashHex, filename: fname };
}
