'use client';

import { useState } from 'react';
import { IconDownload, IconFile } from './Icons';

function buildPlainText(r) {
  const lines = [];
  const now = new Date().toLocaleString('es-AR');
  lines.push('AGROPULSE — Reporte de monitoreo');
  lines.push(`Generado: ${now}`);
  lines.push(`Modo: ${r.reportMode || 'estandar'}`);
  lines.push('');
  lines.push('== Geometría ==');
  if (r.geometry?.type === 'Polygon') {
    lines.push('Tipo: Polígono (lote)');
    if (r.geometry.areaHa != null) lines.push(`Área: ${r.geometry.areaHa.toFixed(2)} ha`);
  } else {
    lines.push('Tipo: Punto con buffer');
    if (r.geometry?.bufferMeters != null) lines.push(`Radio: ${r.geometry.bufferMeters} m`);
  }
  if (r.geometry?.center) lines.push(`Centro: ${r.geometry.center.lat.toFixed(6)}, ${r.geometry.center.lon.toFixed(6)}`);
  lines.push('');
  lines.push('== Estado ==');
  lines.push(`Clasificación: ${r.statusLabel || r.status}`);
  lines.push(`Cobertura: ${r.landCover}`);
  if (r.phenology) lines.push(`Etapa fenológica: ${r.phenology.label} (${r.phenology.trend || '—'})`);
  if (r.ranking?.percentile != null) lines.push(`Ranking: P${r.ranking.percentile} (${r.ranking.label})`);
  if (r.benchmark?.delta != null) lines.push(`Benchmark zonal 10km: ${r.benchmark.delta > 0 ? '+' : ''}${r.benchmark.delta.toFixed(1)}%`);
  if (r.yoy?.delta != null) lines.push(`Interanual vs ${r.yoy.year}: ${r.yoy.delta > 0 ? '+' : ''}${r.yoy.delta.toFixed(1)}%`);
  if (r.stressDays?.days != null) lines.push(`Días de estrés hídrico: ${r.stressDays.days}`);
  lines.push('');
  lines.push('== Índices (Actual / Histórico / Anomalía) ==');
  const row = (n, c, h, a) =>
    `  ${n.padEnd(6)}  ${c == null ? '—' : c.toFixed(3)}   ${h == null ? '—' : h.toFixed(3)}   ${a == null ? '—' : (a > 0 ? '+' : '') + a.toFixed(1) + '%'}`;
  lines.push(row('NDVI', r.current?.ndvi, r.historical?.ndvi, r.anomalies?.ndvi));
  lines.push(row('EVI',  r.current?.evi,  r.historical?.evi,  r.anomalies?.evi));
  lines.push(row('NDWI', r.current?.ndwi, r.historical?.ndwi, r.anomalies?.ndwi));
  lines.push('');
  lines.push('== Síntesis ejecutiva ==');
  lines.push(r.storytelling || '—');
  lines.push('');
  if (r.operationalWindows?.length) {
    lines.push('== Ventanas de trabajo ==');
    r.operationalWindows.forEach((w) => {
      lines.push(`- [${(w.prioridad || '').toUpperCase()}] ${w.titulo} · ${w.momento}`);
      lines.push(`    ${w.detalle}`);
    });
    lines.push('');
  }
  lines.push('Fuente: Copernicus Sentinel-2 · Procesamiento: Google Earth Engine.');
  return lines.join('\n');
}

function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function urlToDataUrl(url) {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onloadend = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn('No se pudo descargar el thumbnail', e);
    return null;
  }
}

export default function ExportReport({ result, inputGeometry }) {
  const [busy, setBusy] = useState(false);
  const [hash, setHash] = useState(null);
  if (!result) return null;

  const handleText = () =>
    downloadBlob(
      buildPlainText(result),
      `agropulse-reporte-${new Date().toISOString().slice(0, 10)}.txt`,
      'text/plain;charset=utf-8'
    );

  const handlePDF = async () => {
    try {
      setBusy(true);
      // Pre-fetch de thumbnails a dataURL para embeberlos en el PDF
      const thumbs = result.thumbnails || {};
      const [ndviThumbDataUrl, rgbThumbDataUrl] = await Promise.all([
        thumbs.ndviUrl ? urlToDataUrl(thumbs.ndviUrl) : null,
        thumbs.rgbUrl ? urlToDataUrl(thumbs.rgbUrl) : null,
      ]);
      const { generatePDFReport } = await import('@/lib/pdfReport');
      const { hashHex } = await generatePDFReport(result, {
        ndviThumbDataUrl,
        rgbThumbDataUrl,
        thumbBbox: thumbs.bbox,
        inputGeometry, // para overlay vectorial del polígono con precisión exacta
      });
      setHash(hashHex);
    } catch (err) {
      console.error(err);
      alert('No se pudo generar el PDF: ' + err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handlePDF}
        disabled={busy}
        className="inline-flex items-center justify-center gap-2 rounded-md border border-accent-700/40 bg-accent-700 px-3 py-2 text-xs font-semibold text-white shadow-card transition hover:bg-accent-600 disabled:opacity-60"
      >
        <IconDownload className="h-3.5 w-3.5" />
        {busy ? 'Generando PDF…' : 'Descargar reporte PDF'}
      </button>
      <button
        type="button"
        onClick={handleText}
        className="inline-flex items-center justify-center gap-2 rounded-md border border-ink-650 bg-ink-850 px-3 py-2 text-xs font-semibold text-ink-200 transition hover:bg-ink-750"
      >
        <IconFile className="h-3.5 w-3.5" />
        Descargar TXT
      </button>
      {hash && (
        <div className="mt-1 rounded-md border border-ink-700 bg-ink-850 px-2.5 py-2 text-[10px] leading-snug text-ink-400">
          <div className="font-semibold uppercase tracking-wider text-ink-300">
            Sello emitido · SHA-256
          </div>
          <div className="num mt-1 break-all">{hash}</div>
        </div>
      )}
    </div>
  );
}
