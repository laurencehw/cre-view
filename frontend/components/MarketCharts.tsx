'use client';

import { formatCurrency, formatPercent } from '@/lib/format';

// ─── Types ──────────────────────────────────────────────────────────────────

interface CityData {
  city: string;
  count: number;
  avgCapRate: number;
  avgFloors: number;
}

interface TypeData {
  type: string;
  count: number;
  avgCapRate: number;
  avgValue: number;
}

// ─── Bar Chart ──────────────────────────────────────────────────────────────

export function BarChart({
  data,
  labelKey,
  valueKey,
  formatValue,
  color = '#3b82f6',
  title,
}: {
  data: Record<string, any>[];
  labelKey: string;
  valueKey: string;
  formatValue?: (v: number) => string;
  color?: string;
  title?: string;
}) {
  if (data.length === 0) return null;
  const maxVal = Math.max(...data.map(d => Number(d[valueKey]) || 0));

  return (
    <div>
      {title && (
        <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          {title}
        </h4>
      )}
      <div className="space-y-2">
        {data.map((d, i) => {
          const val = Number(d[valueKey]) || 0;
          const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
          return (
            <div key={i} className="flex items-center gap-3">
              <span className="text-xs text-gray-400 w-24 truncate text-right shrink-0">
                {d[labelKey]}
              </span>
              <div className="flex-1 h-6 bg-gray-800/40 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: color }}
                />
              </div>
              <span className="text-xs text-gray-300 font-mono w-16 text-right shrink-0">
                {formatValue ? formatValue(val) : val}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Donut Chart ────────────────────────────────────────────────────────────

export function DonutChart({
  data,
  labelKey,
  valueKey,
  title,
}: {
  data: Record<string, any>[];
  labelKey: string;
  valueKey: string;
  title?: string;
}) {
  if (data.length === 0) return null;
  const total = data.reduce((s, d) => s + (Number(d[valueKey]) || 0), 0);
  if (total === 0) return null;

  const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1', '#ef4444', '#14b8a6'];

  let cumulative = 0;
  const slices = data.map((d, i) => {
    const val = Number(d[valueKey]) || 0;
    const fraction = val / total;
    const startAngle = cumulative * 2 * Math.PI;
    cumulative += fraction;
    const endAngle = cumulative * 2 * Math.PI;
    return { ...d, fraction, startAngle, endAngle, color: colors[i % colors.length] };
  });

  return (
    <div>
      {title && (
        <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          {title}
        </h4>
      )}
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <svg viewBox="0 0 200 200" className="w-40 h-40 shrink-0">
          {slices.map((s, i) => {
            const largeArc = s.fraction > 0.5 ? 1 : 0;
            const x1 = 100 + 70 * Math.cos(s.startAngle - Math.PI / 2);
            const y1 = 100 + 70 * Math.sin(s.startAngle - Math.PI / 2);
            const x2 = 100 + 70 * Math.cos(s.endAngle - Math.PI / 2);
            const y2 = 100 + 70 * Math.sin(s.endAngle - Math.PI / 2);
            const d = slices.length === 1
              ? `M 100 100 m 0 -70 a 70 70 0 1 1 0 140 a 70 70 0 1 1 0 -140`
              : `M 100 100 L ${x1} ${y1} A 70 70 0 ${largeArc} 1 ${x2} ${y2} Z`;
            return (
              <path key={i} d={d} fill={s.color} opacity={0.85} stroke="#030712" strokeWidth={2} />
            );
          })}
          {/* Center hole */}
          <circle cx={100} cy={100} r={40} fill="#030712" />
          <text x={100} y={95} textAnchor="middle" fill="#9ca3af" fontSize={11}>Total</text>
          <text x={100} y={112} textAnchor="middle" fill="#f3f4f6" fontSize={16} fontWeight="bold">{total}</text>
        </svg>

        <div className="flex-1 space-y-1.5">
          {slices.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-xs text-gray-300 flex-1 truncate">{(s as Record<string, any>)[labelKey]}</span>
              <span className="text-xs text-gray-500 font-mono">{Number((s as Record<string, any>)[valueKey])}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Building Count by City Chart ───────────────────────────────────────────

export function CityChart({ data }: { data: CityData[] }) {
  return (
    <BarChart
      data={data}
      labelKey="city"
      valueKey="count"
      color="#3b82f6"
      title="Buildings by City"
    />
  );
}

// ─── Cap Rate by City Chart ─────────────────────────────────────────────────

export function CapRateChart({ data }: { data: CityData[] }) {
  return (
    <BarChart
      data={data.filter(d => d.avgCapRate > 0)}
      labelKey="city"
      valueKey="avgCapRate"
      formatValue={(v) => formatPercent(v)}
      color="#f59e0b"
      title="Avg Cap Rate by City"
    />
  );
}

// ─── Property Type Mix Chart ────────────────────────────────────────────────

export function TypeMixChart({ data }: { data: TypeData[] }) {
  return (
    <DonutChart
      data={data}
      labelKey="type"
      valueKey="count"
      title="Property Type Mix"
    />
  );
}
