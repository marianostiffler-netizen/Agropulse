'use client';

import { useCallback, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import DroughtResult from '@/components/DroughtResult';
import NDVIChart from '@/components/NDVIChart';
import ExportReport from '@/components/ExportReport';
import { LogoMark } from '@/components/Logo';
import {
  IconMapPin,
  IconPolygon,
  IconSatellite,
  IconLeaf,
  IconDroplet,
  IconTrend,
  IconX,
} from '@/components/Icons';

const MapPicker = dynamic(() => import('@/components/MapPicker'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-ink-950 text-sm text-ink-400">
      Cargando mapa…
    </div>
  ),
});

export default function HomePage() {
  const [mode, setMode] = useState('point');
  const [point, setPoint] = useState(null);
  const [buffer, setBuffer] = useState(100);
  const [polygonDraft, setPolygonDraft] = useState([]);
  const [polygonFinal, setPolygonFinal] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [recenterTo, setRecenterTo] = useState(null);

  const handlePointClick = useCallback(({ lat, lon }) => setPoint({ lat, lon }), []);
  const handlePolygonClick = useCallback(({ lat, lon }) => {
    setPolygonDraft((d) => [...d, [lon, lat]]);
  }, []);
  const handlePolygonFinish = useCallback(() => {
    setPolygonDraft((d) => {
      if (d.length >= 3) setPolygonFinal(d);
      return [];
    });
  }, []);
  const resetPolygon = () => { setPolygonDraft([]); setPolygonFinal(null); };
  const switchMode = (next) => {
    setMode(next);
    setResult(null);
    setError(null);
    if (next === 'point') resetPolygon();
    else setPoint(null);
  };

  const canSubmit = useMemo(() => {
    if (loading) return false;
    if (mode === 'point') return point && Number.isFinite(point.lat) && Number.isFinite(point.lon);
    return polygonFinal && polygonFinal.length >= 3;
  }, [mode, point, polygonFinal, loading]);

  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault?.();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const geometry =
        mode === 'point'
          ? { type: 'Point', lat: point.lat, lon: point.lon, bufferMeters: Number(buffer) || 100 }
          : { type: 'Polygon', coordinates: polygonFinal };
      const res = await fetch('/api/check-drought', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geometry }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Error HTTP ${res.status}`);
      setResult(data);
      if (data?.geometry?.center) {
        setRecenterTo([data.geometry.center.lat, data.geometry.center.lon]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [canSubmit, mode, point, buffer, polygonFinal]);

  const tileUrl = result?.tile?.urlFormat || null;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-ink-900 text-ink-100">
      {/* Topbar */}
      <header className="flex flex-none items-center justify-between border-b border-ink-800 bg-ink-900/90 px-6 py-3 backdrop-blur">
        <LogoMark size={36} subtitle="Satellite Intelligence" />

        <div className="hidden items-center gap-2 text-[11px] md:flex">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-650 bg-ink-800 px-2.5 py-1 text-ink-300">
            <IconSatellite className="h-3.5 w-3.5 text-accent-400" />
            Sentinel-2
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-650 bg-ink-800 px-2.5 py-1 text-ink-300">
            Earth Engine
          </span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Sidebar fijo */}
        <aside className="flex w-[360px] flex-none flex-col overflow-y-auto border-r border-ink-800 bg-ink-800">
          <div className="space-y-6 p-6">
            {/* Selector modo */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                  Área de análisis
                </h2>
              </div>
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-ink-850 p-1">
                <button
                  type="button"
                  onClick={() => switchMode('point')}
                  className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition ${
                    mode === 'point'
                      ? 'bg-ink-700 text-ink-100 shadow-card'
                      : 'text-ink-400 hover:text-ink-200'
                  }`}
                >
                  <IconMapPin className="h-3.5 w-3.5" />
                  Punto
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('polygon')}
                  className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition ${
                    mode === 'polygon'
                      ? 'bg-ink-700 text-ink-100 shadow-card'
                      : 'text-ink-400 hover:text-ink-200'
                  }`}
                >
                  <IconPolygon className="h-3.5 w-3.5" />
                  Lote
                </button>
              </div>
            </section>

            {/* Formulario */}
            {mode === 'point' ? (
              <section className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-[11px] font-medium text-ink-400">
                    Latitud
                    <input
                      type="number"
                      step="0.000001"
                      min={-90}
                      max={90}
                      value={point?.lat ?? ''}
                      onChange={(e) =>
                        setPoint((p) => ({ lat: Number(e.target.value), lon: p?.lon ?? 0 }))
                      }
                      placeholder="-34.603722"
                      className="mt-1.5 w-full rounded-md px-2.5 py-2 text-sm num"
                    />
                  </label>
                  <label className="block text-[11px] font-medium text-ink-400">
                    Longitud
                    <input
                      type="number"
                      step="0.000001"
                      min={-180}
                      max={180}
                      value={point?.lon ?? ''}
                      onChange={(e) =>
                        setPoint((p) => ({ lat: p?.lat ?? 0, lon: Number(e.target.value) }))
                      }
                      placeholder="-58.381592"
                      className="mt-1.5 w-full rounded-md px-2.5 py-2 text-sm num"
                    />
                  </label>
                </div>
                <label className="block text-[11px] font-medium text-ink-400">
                  Radio de análisis (metros)
                  <input
                    type="number"
                    min={10}
                    max={5000}
                    step={10}
                    value={buffer}
                    onChange={(e) => setBuffer(e.target.value)}
                    className="mt-1.5 w-full rounded-md px-2.5 py-2 text-sm num"
                  />
                </label>
                <p className="text-[11px] text-ink-500">
                  Click en el mapa para fijar el punto.
                </p>
              </section>
            ) : (
              <section className="space-y-3">
                <div className="rounded-md border border-ink-650 bg-ink-850 px-3 py-2.5 text-[11px] leading-relaxed text-ink-300">
                  <b className="text-ink-100">Dibujo de lote</b>
                  <br />
                  Click = vértice · Doble click o <i>Finalizar</i> = cerrar polígono (mín. 3).
                </div>
                <div className="flex items-center justify-between text-[11px] text-ink-400">
                  <span>
                    Vértices: <span className="num text-ink-200">{polygonDraft.length}</span>
                    {polygonFinal && (
                      <> · Lote <span className="num text-accent-400">{polygonFinal.length}</span></>
                    )}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handlePolygonFinish}
                    disabled={polygonDraft.length < 3}
                    className="flex-1 rounded-md border border-accent-700/40 bg-accent-700/20 px-3 py-2 text-[11px] font-semibold text-accent-300 transition hover:bg-accent-700/30 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Finalizar
                  </button>
                  <button
                    type="button"
                    onClick={resetPolygon}
                    className="flex-1 rounded-md border border-ink-650 bg-ink-850 px-3 py-2 text-[11px] font-semibold text-ink-300 transition hover:bg-ink-750"
                  >
                    Limpiar
                  </button>
                </div>
              </section>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-md bg-accent-700 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-accent-600 disabled:cursor-not-allowed disabled:bg-ink-700 disabled:text-ink-500"
            >
              {loading ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                  Analizando…
                </>
              ) : (
                <>
                  <IconTrend className="h-4 w-4" />
                  Analizar área
                </>
              )}
            </button>

            {error && (
              <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                <IconX className="mt-0.5 h-3.5 w-3.5 flex-none" />
                <span>{error}</span>
              </div>
            )}

            {/* Metodología */}
            <section className="space-y-2 border-t border-ink-700 pt-6">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                Metodología
              </h3>
              <ul className="space-y-2 text-[11px] leading-relaxed text-ink-400">
                <li className="flex gap-2">
                  <IconLeaf className="mt-0.5 h-3.5 w-3.5 flex-none text-accent-500" />
                  <span><b className="text-ink-200">NDVI</b> — vigor general de la vegetación.</span>
                </li>
                <li className="flex gap-2">
                  <IconLeaf className="mt-0.5 h-3.5 w-3.5 flex-none text-accent-400" />
                  <span><b className="text-ink-200">EVI</b> — sensibilidad en vegetación densa.</span>
                </li>
                <li className="flex gap-2">
                  <IconDroplet className="mt-0.5 h-3.5 w-3.5 flex-none text-sky-400" />
                  <span><b className="text-ink-200">NDWI</b> — humedad / cuerpos de agua.</span>
                </li>
                <li className="flex gap-2">
                  <IconTrend className="mt-0.5 h-3.5 w-3.5 flex-none text-amber-400" />
                  <span>Anomalía vs. promedio histórico del mismo mes (5 años).</span>
                </li>
              </ul>
            </section>

            {/* Export */}
            {result && (
              <section className="space-y-2 border-t border-ink-700 pt-6">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                  Reporte
                </h3>
                <ExportReport result={result} />
              </section>
            )}
          </div>
        </aside>

        {/* Contenido principal */}
        <main className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-ink-900">
          {/* Mapa protagonista */}
          <div className="relative flex-none p-6 pb-0">
            <div className="map-shell relative h-[62vh] min-h-[420px] overflow-hidden rounded-xl shadow-card-lg">
              <MapPicker
                mode={mode}
                point={point}
                bufferMeters={Number(buffer) || 100}
                polygonDraft={polygonDraft}
                polygonFinal={polygonFinal}
                tileUrl={tileUrl}
                onPointClick={handlePointClick}
                onPolygonClick={handlePolygonClick}
                onPolygonFinish={handlePolygonFinish}
                recenterTo={recenterTo}
              />
              {tileUrl && (
                <div className="legend">
                  <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-ink-100">
                    <IconLeaf className="h-3 w-3 text-accent-400" />
                    NDVI · vigor vegetal
                  </div>
                  <div className="legend-gradient" />
                  <div className="mt-1 flex justify-between text-[10px] text-ink-400">
                    <span>bajo</span>
                    <span className="num">0.0</span>
                    <span className="num">0.85</span>
                    <span>alto</span>
                  </div>
                </div>
              )}
              {!tileUrl && !loading && !result && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="rounded-lg border border-ink-700 bg-ink-900/80 px-4 py-3 text-xs text-ink-400 backdrop-blur">
                    {mode === 'point'
                      ? 'Hacé click en el mapa o cargá coordenadas, luego presioná Analizar área.'
                      : 'Dibujá un polígono (mín. 3 vértices) para definir el lote.'}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Panel inferior con resultados */}
          <div className="flex-1 p-6">
            {loading && (
              <div className="flex items-center gap-3 rounded-xl border border-ink-650 bg-ink-800 px-5 py-4 text-sm text-ink-300 shadow-card">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
                Consultando Earth Engine… puede tardar 10-30 s.
              </div>
            )}

            {result && !loading && (
              <div className="space-y-6">
                <DroughtResult result={result} />
                <div className="rounded-xl border border-ink-650 bg-ink-800 p-5 shadow-card">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-ink-100">
                        Evolución de índices
                      </h3>
                      <p className="text-[11px] text-ink-500">
                        NDVI y EVI mensuales de los últimos 12 meses.
                      </p>
                    </div>
                  </div>
                  <NDVIChart
                    data={result.timeSeries}
                    historicalNDVI={result.historical?.ndvi}
                  />
                </div>
              </div>
            )}

            {!loading && !result && (
              <div className="rounded-xl border border-dashed border-ink-700 bg-ink-850/40 p-10 text-center text-sm text-ink-500">
                <IconSatellite className="mx-auto mb-3 h-6 w-6 text-ink-600" />
                Los resultados del análisis van a aparecer acá.
              </div>
            )}

            <footer className="mt-8 text-center text-[10px] text-ink-500">
              Copernicus Sentinel-2 · Google Earth Engine · Agropulse {new Date().getFullYear()}
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
