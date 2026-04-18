'use client';

import {
  IconLeaf, IconDroplet, IconTrend, IconSprout, IconLayers,
  IconAlert, IconCheck, IconInfo, IconSatellite,
} from './Icons';

const STATUS = {
  sequia_alerta: { label: 'Sequía Alerta', tone: 'bg-red-500/10 text-red-300 border-red-500/30', Icon: IconAlert },
  estres_hidrico_plaga: { label: 'Posible Estrés Hídrico / Plaga', tone: 'bg-amber-500/10 text-amber-300 border-amber-500/30', Icon: IconAlert },
  observacion: { label: 'Bajo observación', tone: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30', Icon: IconInfo },
  normal: { label: 'Normal', tone: 'bg-accent-500/10 text-accent-300 border-accent-500/30', Icon: IconCheck },
  optimo: { label: 'Óptimo', tone: 'bg-accent-500/15 text-accent-300 border-accent-500/40', Icon: IconCheck },
  cuerpo_de_agua: { label: 'Cuerpo de agua', tone: 'bg-sky-500/10 text-sky-300 border-sky-500/30', Icon: IconDroplet },
  sin_datos: { label: 'Sin datos', tone: 'bg-ink-800 text-ink-300 border-ink-650', Icon: IconInfo },
};

const LAND_COVER = {
  agricultura: 'Zona agrícola',
  agua: 'Cuerpo de agua',
  suelo_desnudo: 'Suelo desnudo',
};

const PRIORITY = {
  alta: { label: 'Alta', tone: 'bg-red-500/15 text-red-300 border-red-500/30' },
  media: { label: 'Media', tone: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  baja: { label: 'Baja', tone: 'bg-ink-700 text-ink-300 border-ink-650' },
};

const fmt = (v, d = 3) => (v == null ? '—' : Number(v).toFixed(d));
const fmtPct = (v) => (v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(1)}%`);
const anomalyTone = (pct) => {
  if (pct == null) return 'text-ink-500';
  if (pct <= -30) return 'text-red-400';
  if (pct <= -20) return 'text-amber-400';
  if (pct <= -10) return 'text-yellow-400';
  if (pct >= 10) return 'text-accent-400';
  return 'text-ink-200';
};

function KPI({ icon: Icon, label, value, hint, accent = false }) {
  return (
    <div className="group rounded-xl border border-ink-650 bg-ink-800 p-5 shadow-card transition hover:border-ink-600 hover:bg-ink-750">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-ink-400">{label}</span>
        <span className={`flex h-8 w-8 items-center justify-center rounded-md border ${
          accent ? 'border-accent-500/30 bg-accent-500/10 text-accent-400' : 'border-ink-650 bg-ink-850 text-ink-300'
        }`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-3 num text-2xl font-semibold tracking-tight text-ink-100">{value}</div>
      {hint && <div className="mt-1 text-xs text-ink-400">{hint}</div>}
    </div>
  );
}

function IndexRow({ label, description, current, historical, anomaly, digits = 3 }) {
  return (
    <div className="grid grid-cols-[1.3fr_1fr_1fr_1fr] items-center gap-4 rounded-md px-3 py-2.5 transition hover:bg-ink-750">
      <div>
        <div className="text-sm font-medium text-ink-100">{label}</div>
        <div className="text-[11px] text-ink-500">{description}</div>
      </div>
      <div className="num text-right text-sm text-ink-100">{fmt(current, digits)}</div>
      <div className="num text-right text-sm text-ink-300">{fmt(historical, digits)}</div>
      <div className={`num text-right text-sm font-semibold ${anomalyTone(anomaly)}`}>{fmtPct(anomaly)}</div>
    </div>
  );
}

function PercentileBar({ percentile }) {
  if (percentile == null) return <div className="h-2 w-full rounded-full bg-ink-700" />;
  return (
    <div className="relative h-2 w-full rounded-full bg-ink-700">
      <div
        className="absolute left-0 top-0 h-2 rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-accent-500"
        style={{ width: `${percentile}%` }}
      />
      <div
        className="absolute -top-1 h-4 w-[3px] rounded-full bg-ink-100 shadow"
        style={{ left: `calc(${percentile}% - 1.5px)` }}
      />
    </div>
  );
}

function RankingCard({ ranking }) {
  if (!ranking || ranking.percentile == null) return null;
  return (
    <div className="rounded-xl border border-ink-650 bg-ink-800 p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-ink-400">
            Ranking histórico
          </div>
          <div className="mt-0.5 text-sm font-semibold text-ink-100">{ranking.label}</div>
        </div>
        <div className="text-right">
          <div className="num text-2xl font-semibold text-accent-400">P{ranking.percentile}</div>
          <div className="text-[10px] text-ink-500">percentil</div>
        </div>
      </div>
      <PercentileBar percentile={ranking.percentile} />
      <div className="mt-3 flex justify-between text-[10px] text-ink-500">
        <span>peor año</span>
        <span>mediana</span>
        <span>mejor año</span>
      </div>
      {ranking.years?.length > 0 && (
        <div className="mt-3 grid grid-cols-5 gap-1 text-center">
          {ranking.years.map((y) => (
            <div key={y.year} className="rounded-md bg-ink-850 px-1 py-1.5">
              <div className="text-[10px] text-ink-500">{y.year}</div>
              <div className="num text-[11px] font-semibold text-ink-200">{y.ndvi.toFixed(2)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StressDaysCard({ stress }) {
  if (!stress) return null;
  const d = stress.days;
  const tone = d == null ? 'text-ink-400'
    : d >= 30 ? 'text-red-400'
    : d >= 15 ? 'text-amber-400'
    : d >= 7 ? 'text-yellow-400'
    : 'text-accent-400';
  return (
    <div className="rounded-xl border border-ink-650 bg-ink-800 p-5 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-ink-400">
          Días de estrés hídrico
        </span>
        <span className="flex h-8 w-8 items-center justify-center rounded-md border border-sky-500/30 bg-sky-500/10 text-sky-300">
          <IconDroplet className="h-4 w-4" />
        </span>
      </div>
      <div className={`mt-3 num text-3xl font-semibold ${tone}`}>
        {d == null ? '—' : d}
        <span className="ml-1 text-sm font-normal text-ink-500">días</span>
      </div>
      <div className="mt-1 text-xs text-ink-400">
        NDWI bajo {stress.threshold?.toFixed(2) ?? '—'} · {stress.consecutiveObservations ?? 0} observaciones consecutivas
      </div>
      {stress.lastAbove && (
        <div className="mt-2 text-[11px] text-ink-500">
          Última lectura por encima del umbral: <span className="num text-ink-300">{stress.lastAbove}</span>
        </div>
      )}
    </div>
  );
}

function YoYCard({ yoy, current }) {
  if (!yoy) return null;
  const delta = yoy.delta;
  const tone = anomalyTone(delta);
  return (
    <div className="rounded-xl border border-ink-650 bg-ink-800 p-5 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-ink-400">
          Comparativo interanual
        </span>
        <span className="flex h-8 w-8 items-center justify-center rounded-md border border-ink-650 bg-ink-850 text-ink-300">
          <IconTrend className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3 text-center">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-ink-500">Actual</div>
          <div className="num mt-0.5 text-lg font-semibold text-ink-100">{fmt(current, 2)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-ink-500">{yoy.year}</div>
          <div className="num mt-0.5 text-lg font-semibold text-ink-300">{fmt(yoy.ndvi, 2)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-ink-500">Diferencia</div>
          <div className={`num mt-0.5 text-lg font-semibold ${tone}`}>{fmtPct(delta)}</div>
        </div>
      </div>
      <div className="mt-3 text-[11px] leading-relaxed text-ink-400">
        NDVI del lote vs. mismo mes del año anterior.
      </div>
    </div>
  );
}

const REPORT_MODE = {
  alerta_roja: {
    label: 'Alerta Roja',
    tone: 'bg-red-500/15 text-red-300 border-red-500/40',
    description: 'Anomalía NDVI ≤ −25 %. Tono de urgencia activado.',
  },
  pre_cosecha: {
    label: 'Pre-cosecha',
    tone: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
    description: 'Senescencia detectada. Priorización de logística y humedad de grano.',
  },
  estandar: {
    label: 'Monitoreo estándar',
    tone: 'bg-accent-500/10 text-accent-300 border-accent-500/30',
    description: 'Seguimiento de rutina con tono sobrio.',
  },
};

function ReportModeBadge({ mode }) {
  const m = REPORT_MODE[mode] || REPORT_MODE.estandar;
  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold ${m.tone}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      Modo: {m.label}
    </div>
  );
}

function BenchmarkCard({ benchmark, current }) {
  if (!benchmark) return null;
  const delta = benchmark.delta;
  const tone = anomalyTone(delta);
  return (
    <div className="rounded-xl border border-ink-650 bg-ink-800 p-5 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-ink-400">
          Benchmark zonal (10 km)
        </span>
        <span className="flex h-8 w-8 items-center justify-center rounded-md border border-ink-650 bg-ink-850 text-ink-300">
          <IconSatellite className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3 text-center">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-ink-500">Lote</div>
          <div className="num mt-0.5 text-lg font-semibold text-ink-100">{fmt(current, 2)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-ink-500">Zona</div>
          <div className="num mt-0.5 text-lg font-semibold text-ink-300">{fmt(benchmark.zonalNDVI, 2)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-ink-500">Diferencia</div>
          <div className={`num mt-0.5 text-lg font-semibold ${tone}`}>{fmtPct(delta)}</div>
        </div>
      </div>
      <div className="mt-3 text-[11px] leading-relaxed text-ink-400">
        Comparación del NDVI medio del lote contra la media en un radio de 10 km.
      </div>
    </div>
  );
}

function OperationalWindows({ windows }) {
  if (!windows?.length) return null;
  return (
    <div className="rounded-xl border border-ink-650 bg-ink-800 p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-ink-100">Ventanas de trabajo</h3>
          <p className="text-[11px] text-ink-500">Recomendaciones operativas según etapa y anomalías.</p>
        </div>
      </div>
      <div className="space-y-2">
        {windows.map((w) => {
          const p = PRIORITY[w.prioridad] || PRIORITY.baja;
          return (
            <div
              key={w.id}
              className="group flex items-start gap-3 rounded-lg border border-ink-700 bg-ink-850 px-4 py-3 transition hover:border-ink-600 hover:bg-ink-800"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-ink-100">{w.titulo}</span>
                  <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${p.tone}`}>
                    {p.label}
                  </span>
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-ink-400">{w.detalle}</p>
              </div>
              <div className="flex-none text-right text-[11px] text-ink-400">
                <div className="text-ink-500">Timing</div>
                <div className="text-ink-200">{w.momento}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StorytellingCard({ storytelling, reportMode }) {
  if (!storytelling) return null;
  const accent = reportMode === 'alerta_roja'
    ? 'border-red-500/30 from-red-500/10 to-ink-850'
    : reportMode === 'pre_cosecha'
      ? 'border-amber-500/30 from-amber-500/10 to-ink-850'
      : 'border-accent-500/20 from-ink-800 to-ink-850';
  return (
    <div className={`rounded-xl border bg-gradient-to-br p-5 shadow-card ${accent}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md border border-accent-500/30 bg-accent-500/10 text-accent-400">
            <IconInfo className="h-3.5 w-3.5" />
          </span>
          <h3 className="text-sm font-semibold text-ink-100">Síntesis ejecutiva</h3>
        </div>
        <ReportModeBadge mode={reportMode} />
      </div>
      <p className="text-sm leading-relaxed text-ink-200">{storytelling}</p>
    </div>
  );
}

export default function DroughtResult({ result }) {
  const s = STATUS[result.status] || STATUS.sin_datos;
  const StatusIcon = s.Icon;

  return (
    <div className="space-y-6">
      {/* Banner de estado */}
      <div className={`flex items-start gap-3 rounded-xl border px-5 py-4 ${s.tone} backdrop-blur`}>
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-ink-900/40">
          <StatusIcon className="h-4 w-4" />
        </span>
        <div className="flex-1">
          <div className="text-sm font-semibold">{result.statusLabel || s.label}</div>
          <div className="mt-1 text-sm leading-relaxed opacity-90">{result.recommendation}</div>
        </div>
      </div>

      {/* Storytelling ejecutivo */}
      <StorytellingCard storytelling={result.storytelling} reportMode={result.reportMode} />

      {/* Grilla KPI */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KPI
          icon={IconLeaf}
          label="NDVI actual"
          value={fmt(result.current?.ndvi)}
          hint={result.current?.date ? `Imagen ${result.current.date}` : undefined}
          accent
        />
        <KPI
          icon={IconTrend}
          label="Anomalía NDVI"
          value={<span className={anomalyTone(result.anomalies?.ndvi)}>{fmtPct(result.anomalies?.ndvi)}</span>}
          hint={result.historical ? `Mes ${result.historical.month} · ${result.historical.yearsFrom}-${result.historical.yearsTo}` : undefined}
        />
        <KPI
          icon={IconSprout}
          label="Etapa fenológica"
          value={<span className="text-xl">{result.phenology?.label || '—'}</span>}
          hint={result.phenology?.trend ? `Tendencia ${result.phenology.trend}` : undefined}
        />
        <KPI
          icon={IconLayers}
          label="Cobertura"
          value={<span className="text-xl">{LAND_COVER[result.landCover] || '—'}</span>}
          hint={`NDWI ${fmt(result.current?.ndwi, 2)}`}
        />
      </div>

      {/* Ranking + Estrés + Benchmark + YoY */}
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <RankingCard ranking={result.ranking} />
        <StressDaysCard stress={result.stressDays} />
        <BenchmarkCard benchmark={result.benchmark} current={result.current?.ndvi} />
        <YoYCard yoy={result.yoy} current={result.current?.ndvi} />
      </div>

      {/* Ventanas de trabajo */}
      <OperationalWindows windows={result.operationalWindows} />

      {/* Tabla índices */}
      <div className="rounded-xl border border-ink-650 bg-ink-800 p-4 shadow-card">
        <div className="mb-3 flex items-center justify-between px-3">
          <div>
            <h3 className="text-sm font-semibold text-ink-100">Índices vegetales</h3>
            <p className="text-[11px] text-ink-500">Comparación actual vs. promedio histórico del mismo mes.</p>
          </div>
          <span className="text-[11px] text-ink-500">
            Imágenes · recientes <span className="num text-ink-300">{result.imageCounts?.recent ?? '—'}</span>
            {' · '}históricas <span className="num text-ink-300">{result.imageCounts?.historical ?? '—'}</span>
          </span>
        </div>
        <div className="grid grid-cols-[1.3fr_1fr_1fr_1fr] gap-4 border-b border-ink-650 px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
          <span>Índice</span>
          <span className="text-right">Actual</span>
          <span className="text-right">Histórico</span>
          <span className="text-right">Anomalía</span>
        </div>
        <div className="mt-1 space-y-0.5">
          <IndexRow label="NDVI" description="Vigor general de la vegetación"
            current={result.current?.ndvi} historical={result.historical?.ndvi} anomaly={result.anomalies?.ndvi} />
          <IndexRow label="EVI" description="Sensible en vegetación densa"
            current={result.current?.evi} historical={result.historical?.evi} anomaly={result.anomalies?.evi} />
          <IndexRow label="NDWI" description="Humedad superficial / cuerpos de agua"
            current={result.current?.ndwi} historical={result.historical?.ndwi} anomaly={result.anomalies?.ndwi} />
        </div>
      </div>

      {/* Metadata geometría */}
      <div className="rounded-xl border border-ink-650 bg-ink-800 p-4 text-xs text-ink-400 shadow-card">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
          <span>
            <span className="text-ink-500">Geometría · </span>
            <span className="text-ink-100">{result.geometry?.type === 'Polygon' ? 'Polígono (lote)' : 'Punto con buffer'}</span>
          </span>
          {result.geometry?.areaHa != null && (
            <span><span className="text-ink-500">Área · </span><span className="num text-ink-100">{result.geometry.areaHa.toFixed(2)}</span> ha</span>
          )}
          {result.geometry?.bufferMeters != null && (
            <span><span className="text-ink-500">Buffer · </span><span className="num text-ink-100">{result.geometry.bufferMeters}</span> m</span>
          )}
          {result.geometry?.center && (
            <span>
              <span className="text-ink-500">Centro · </span>
              <span className="num text-ink-100">{result.geometry.center.lat.toFixed(5)}, {result.geometry.center.lon.toFixed(5)}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
