'use client';

import { useState, useEffect, useMemo } from 'react';
import { formatCurrency } from '@/lib/format';

interface DebtMaturity {
  buildingId: string;
  buildingName: string;
  tranche: string;
  amount: number;
  maturityDate: string;
}

interface DebtScheduleProps {
  onBuildingClick?: (id: string) => void;
}

export default function DebtSchedule({ onBuildingClick }: DebtScheduleProps) {
  const [maturities, setMaturities] = useState<DebtMaturity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

  useEffect(() => {
    fetch(`${apiUrl}/api/analytics/debt-schedule`)
      .then(r => r.ok ? r.json() : { data: [] })
      .then(data => setMaturities(data.data ?? []))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [apiUrl]);

  // Group by year for the ladder chart
  const yearBuckets = useMemo(() => {
    const buckets = new Map<number, { senior: number; mezz: number; count: number }>();
    for (const m of maturities) {
      const year = parseInt(m.maturityDate.slice(0, 4));
      if (isNaN(year)) continue;
      const entry = buckets.get(year) ?? { senior: 0, mezz: 0, count: 0 };
      if (m.tranche === 'Senior') entry.senior += m.amount;
      else entry.mezz += m.amount;
      entry.count++;
      buckets.set(year, entry);
    }
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a - b)
      .map(([year, data]) => ({ year, ...data, total: data.senior + data.mezz }));
  }, [maturities]);

  const maxTotal = Math.max(...yearBuckets.map(b => b.total), 1);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 bg-gray-800/40 rounded" />
        ))}
      </div>
    );
  }

  if (yearBuckets.length === 0) {
    return <p className="text-sm text-gray-500">No debt maturity data available</p>;
  }

  return (
    <div className="space-y-4">
      {/* Maturity ladder chart */}
      <div className="space-y-2">
        {yearBuckets.map(b => {
          const seniorPct = (b.senior / maxTotal) * 100;
          const mezzPct = (b.mezz / maxTotal) * 100;
          return (
            <div key={b.year} className="flex items-center gap-3">
              <span className="text-xs text-gray-400 w-10 text-right shrink-0 font-mono">
                {b.year}
              </span>
              <div className="flex-1 h-7 bg-gray-800/30 rounded-full overflow-hidden flex">
                {seniorPct > 0 && (
                  <div
                    className="h-full bg-blue-500/80 flex items-center justify-end px-2"
                    style={{ width: `${seniorPct}%` }}
                  >
                    {seniorPct > 15 && (
                      <span className="text-[10px] text-white/80 font-mono">
                        {formatCurrency(b.senior, true)}
                      </span>
                    )}
                  </div>
                )}
                {mezzPct > 0 && (
                  <div
                    className="h-full bg-purple-500/80 flex items-center justify-end px-2"
                    style={{ width: `${mezzPct}%` }}
                  >
                    {mezzPct > 10 && (
                      <span className="text-[10px] text-white/80 font-mono">
                        {formatCurrency(b.mezz, true)}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <span className="text-xs text-gray-500 w-14 text-right shrink-0">
                {b.count} loan{b.count !== 1 ? 's' : ''}
              </span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-gray-400">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-blue-500/80" />
          <span>Senior Debt</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-purple-500/80" />
          <span>Mezzanine</span>
        </div>
      </div>

      {/* Upcoming maturities table */}
      <details className="group">
        <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300 transition-colors">
          View all {maturities.length} maturities
        </summary>
        <div className="mt-3 rounded-xl border border-gray-800 overflow-x-auto max-h-64 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0">
              <tr className="border-b border-gray-800 bg-gray-900">
                <th className="text-left p-2 text-gray-500 font-medium">Building</th>
                <th className="text-left p-2 text-gray-500 font-medium">Tranche</th>
                <th className="text-right p-2 text-gray-500 font-medium">Amount</th>
                <th className="text-right p-2 text-gray-500 font-medium">Maturity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {maturities.map((m, i) => (
                <tr key={i}>
                  <td className="p-2">
                    {onBuildingClick ? (
                      <button
                        type="button"
                        onClick={() => onBuildingClick(m.buildingId)}
                        className="hover:text-brand-400 transition-colors text-left"
                      >
                        {m.buildingName}
                      </button>
                    ) : (
                      m.buildingName
                    )}
                  </td>
                  <td className="p-2">
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                      m.tranche === 'Senior'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-purple-500/20 text-purple-400'
                    }`}>
                      {m.tranche}
                    </span>
                  </td>
                  <td className="p-2 text-right font-mono">{formatCurrency(m.amount, true)}</td>
                  <td className="p-2 text-right text-gray-400">{m.maturityDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
