'use client';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Legend,
} from 'recharts';

const TEXT = '#9CA3AF';
const GRID = '#1F2937';
const EMERALD = '#10B981';
const EMERALD_SOFT = '#6EE7B7';
const AMBER = '#F59E0B';

function DarkTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-ink-650 bg-ink-850/95 px-3 py-2 text-xs shadow-card backdrop-blur">
      <div className="mb-1 font-semibold text-ink-100">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-ink-300">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: p.color }}
          />
          <span className="mr-2">{p.name}</span>
          <span className="num text-ink-100">
            {p.value == null ? '—' : Number(p.value).toFixed(3)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function NDVIChart({ data, historicalNDVI }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-ink-400">
        Sin datos de serie temporal disponibles.
      </div>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: TEXT }}
            axisLine={{ stroke: GRID }}
            tickLine={{ stroke: GRID }}
          />
          <YAxis
            domain={[0, 1]}
            tick={{ fontSize: 11, fill: TEXT }}
            axisLine={{ stroke: GRID }}
            tickLine={{ stroke: GRID }}
            tickFormatter={(v) => v.toFixed(1)}
          />
          <Tooltip content={<DarkTooltip />} cursor={{ stroke: '#374151', strokeDasharray: '3 3' }} />
          <Legend wrapperStyle={{ fontSize: 12, color: TEXT, paddingTop: 6 }} />
          {historicalNDVI != null && (
            <ReferenceLine
              y={historicalNDVI}
              stroke={AMBER}
              strokeDasharray="4 4"
              label={{
                value: `Histórico ${historicalNDVI.toFixed(2)}`,
                fill: AMBER,
                fontSize: 11,
                position: 'insideTopRight',
              }}
            />
          )}
          <Line
            type="monotone"
            dataKey="ndvi"
            name="NDVI"
            stroke={EMERALD}
            strokeWidth={2.5}
            dot={{ r: 3, stroke: EMERALD, fill: '#0B101B' }}
            activeDot={{ r: 5, stroke: EMERALD, fill: EMERALD }}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="evi"
            name="EVI"
            stroke={EMERALD_SOFT}
            strokeWidth={1.8}
            strokeDasharray="4 3"
            dot={{ r: 2, stroke: EMERALD_SOFT, fill: '#0B101B' }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
