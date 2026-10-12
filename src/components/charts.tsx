import { useEffect, useState } from 'react';
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
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
