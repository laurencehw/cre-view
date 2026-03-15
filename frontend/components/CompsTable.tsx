'use client';

import { useState, useEffect } from 'react';
import type { Building, BuildingFinancials } from '@/lib/types';
import { formatCurrency, formatPercent } from '@/lib/format';
import { useAuth } from '@/lib/auth';

interface CompsTableProps {
  buildingId: string;
  currentBuilding: Building;
  onBuildingSelect?: (id: string) => void;
}

interface CompWithFinancials extends Building {
  financials?: BuildingFinancials | null;
}

export default function CompsTable({ buildingId, currentBuilding, onBuildingSelect }: CompsTableProps) {
  const { isAuthenticated, authHeaders } = useAuth();
  const [comps, setComps] = useState<CompWithFinancials[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

  useEffect(() => {
    let cancelled = false;

    async function fetchComps() {
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(`${apiUrl}/api/buildings/${buildingId}/comps?limit=5`);
        if (!res.ok) throw new Error('Failed to load comparable buildings');
        const data = await res.json();

        if (cancelled) return;
        const buildings: Building[] = data.data ?? [];

        // Fetch financials for each comp if authenticated
        if (isAuthenticated && buildings.length > 0) {
          const withFinancials = await Promise.all(
            buildings.map(async (b) => {
              try {
                const fRes = await fetch(`${apiUrl}/api/buildings/${b.id}/financials`, {
                  headers: authHeaders(),
                });
                const fin = fRes.ok ? await fRes.json() : null;
                return { ...b, financials: fin } as CompWithFinancials;
              } catch {
                return { ...b, financials: null } as CompWithFinancials;
              }
            }),
          );
          if (!cancelled) setComps(withFinancials);
        } else {
          if (!cancelled) setComps(buildings.map(b => ({ ...b, financials: null })));
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchComps();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingId, isAuthenticated]);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-12 bg-gray-800/40 rounded" />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-xs text-gray-500">{error}</p>;
  }

  if (comps.length === 0) {
    return <p className="text-xs text-gray-500">No comparable buildings found</p>;
  }

  return (
    <div className="rounded-xl border border-gray-800 overflow-x-auto">
      <table className="w-full text-sm min-w-[600px]">
        <thead>
          <tr className="border-b border-gray-800 bg-gray-900/60">
            <th className="text-left p-3 text-gray-500 font-medium">Building</th>
            <th className="text-right p-3 text-gray-500 font-medium">Floors</th>
            <th className="text-left p-3 text-gray-500 font-medium">Type</th>
            <th className="text-right p-3 text-gray-500 font-medium">Valuation</th>
            <th className="text-right p-3 text-gray-500 font-medium">Cap Rate</th>
            <th className="text-right p-3 text-gray-500 font-medium">NOI</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {/* Current building for comparison context */}
          <tr className="bg-brand-500/5">
            <td className="p-3">
              <span className="font-medium text-brand-400">{currentBuilding.name}</span>
              <span className="text-xs text-gray-500 ml-2">(current)</span>
            </td>
            <td className="p-3 text-right font-mono">{currentBuilding.floors}</td>
            <td className="p-3 text-gray-400">{currentBuilding.primaryUse}</td>
            <td className="p-3 text-right font-mono text-gray-400" colSpan={3}>—</td>
          </tr>
          {comps.map(comp => (
            <tr key={comp.id} className="hover:bg-gray-900/40 transition-colors">
              <td className="p-3">
                {onBuildingSelect ? (
                  <button
                    type="button"
                    onClick={() => onBuildingSelect(comp.id)}
                    className="font-medium text-sm hover:text-brand-400 transition-colors text-left"
                  >
                    {comp.name}
                  </button>
                ) : (
                  <span className="font-medium">{comp.name}</span>
                )}
                <p className="text-xs text-gray-600 truncate max-w-[200px]">{comp.address}</p>
              </td>
              <td className="p-3 text-right font-mono">{comp.floors}</td>
              <td className="p-3 text-gray-400">{comp.primaryUse}</td>
              <td className="p-3 text-right font-mono">
                {comp.financials ? formatCurrency(comp.financials.valuation.estimatedValue, true) : '—'}
              </td>
              <td className="p-3 text-right font-mono">
                {comp.financials ? formatPercent(comp.financials.valuation.capRate) : '—'}
              </td>
              <td className="p-3 text-right font-mono">
                {comp.financials ? formatCurrency(comp.financials.valuation.noi, true) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
