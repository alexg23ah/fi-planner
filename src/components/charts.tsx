import { useEffect, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
  type TooltipProps,
} from 'recharts';
import { compact, money } from '../lib/format';

// Categorical slots from the validated reference palette (light / dark steps).
const SERIES = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300'],
};
const CHROME = {
  light: { grid: '#e1e0d9', axis: '#898781', ink: '#2d3a3a', target: '#2d3a3a' },
  dark: { grid: '#2c2c2a', axis: '#898781', ink: '#e8ece9', target: '#e8ece9' },
};

export function useTheme(): 'light' | 'dark' {
  const q = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const [dark, setDark] = useState(q?.matches ?? false);
  useEffect(() => {
    if (!q) return;
    const on = (e: MediaQueryListEvent) => setDark(e.matches);
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, [q]);
  return dark ? 'dark' : 'light';
}

export interface SeriesDef { key: string; name: string; dashed?: boolean; target?: boolean }

function ChartTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as { calYear?: number };
  return (
    <div className="chart-tip">
      <div className="tip-head">Age {label}{row.calYear ? `, ${row.calYear}` : ''}</div>
      {payload.map((p) => (
        <div key={p.dataKey as string} className="tip-row">
          <span className="swatch" style={{ background: p.color }} />
          <span>{p.name}</span>
          <strong>{money(Number(p.value))}</strong>
        </div>
      ))}
    </div>
  );
}

export function LineSet({ data, series, height = 280 }: { data: Record<string, number>[]; series: SeriesDef[]; height?: number }) {
  const theme = useTheme();
  const c = CHROME[theme];
  let slot = 0;
  const colored = series.map((s) => ({ ...s, color: s.target ? c.target : SERIES[theme][slot++ % 6] }));
  return (
    <div className="chart" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={c.grid} vertical={false} />
          <XAxis dataKey="age" tick={{ fill: c.axis, fontSize: 12 }} tickLine={false} axisLine={{ stroke: c.grid }} minTickGap={24} />
          <YAxis tickFormatter={compact} tick={{ fill: c.axis, fontSize: 12 }} tickLine={false} axisLine={false} width={56} />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: c.axis, strokeDasharray: '3 3' }} />
          <Legend iconType="plainline" wrapperStyle={{ fontSize: 13, color: c.ink, paddingTop: 8 }} />
          {colored.map((s) => (
            <Line key={s.key} dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2}
              strokeDasharray={s.dashed || s.target ? '6 4' : undefined} dot={false}
              activeDot={{ r: 4, strokeWidth: 2 }} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Single-series monthly bars with an optional dashed reference line (e.g. budget). */
export function MonthBars({ data, refValue, refLabel, height = 240, onPick }: {
  data: { label: string; value: number; month: string }[]; refValue?: number; refLabel?: string; height?: number;
  onPick?: (month: string) => void;
}) {
  const theme = useTheme();
  const c = CHROME[theme];
  return (
    <div className="chart" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 16, right: 12, bottom: 0, left: 0 }} barCategoryGap="28%">
          <CartesianGrid stroke={c.grid} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: c.axis, fontSize: 12 }} tickLine={false} axisLine={{ stroke: c.grid }} />
          <YAxis tickFormatter={compact} tick={{ fill: c.axis, fontSize: 12 }} tickLine={false} axisLine={false} width={56} />
          <Tooltip cursor={{ fill: c.grid, opacity: 0.4 }} content={({ active, payload }) => active && payload?.length ? (
            <div className="chart-tip"><div className="tip-head">{payload[0].payload.label}</div>
              <div className="tip-row"><span className="swatch" style={{ background: SERIES[theme][0] }} /><span>Spent</span><strong>{money(Number(payload[0].value))}</strong></div>
              {refValue ? <div className="tip-row"><span className="swatch" style={{ background: c.target }} /><span>{refLabel}</span><strong>{money(refValue)}</strong></div> : null}
            </div>) : null} />
          <Bar dataKey="value" name="Spent" fill={SERIES[theme][0]} radius={[4, 4, 0, 0]} isAnimationActive={false}
            cursor={onPick ? 'pointer' : undefined} onClick={onPick ? (d: { payload?: { month: string } }) => d.payload && onPick(d.payload.month) : undefined} />
          {refValue ? <ReferenceLine y={refValue} stroke={c.target} strokeDasharray="6 4" label={{ value: refLabel, position: 'insideTopLeft', fill: c.ink, fontSize: 12 }} /> : null}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
