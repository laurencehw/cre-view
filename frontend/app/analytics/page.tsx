'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { formatCurrency, formatPercent } from '@/lib/format';
import { CityChart, CapRateChart, TypeMixChart } from '@/components/MarketCharts';
import type { Building } from '@/lib/types';

// Load map client-side only (Leaflet needs window)
const InteractiveMap = dynamic(() => import('@/components/InteractiveMap'), {
  ssr: false,
  loading: () => <div className="h-96 bg-gray-900/40 rounded-xl animate-pulse" />,
});

interface MarketSummary {
  byCity: { city: string; count: number; avgCapRate: number; avgFloors: number }[];
  byType: { type: string; count: number; avgCapRate: number; avgValue: number }[];
  totals: { buildingCount: number; avgCapRate: number; totalValue: number };
}

interface Portfolio {
  owner: string;
  buildingCount: number;
  totalValue: number;
  avgCapRate: number;
  buildings: { id: string; name: string; address: string }[];
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-gray-900/60 border border-gray-800 p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}

export default function AnalyticsPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
  const [summary, setSummary] = useState<MarketSummary | null>(null);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [allBuildings, setAllBuildings] = useState<Building[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedOwner, setExpandedOwner] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const [summaryRes, portfolioRes, buildingsRes] = await Promise.all([
          fetch(`${apiUrl}/api/analytics/market-summary`),
          fetch(`${apiUrl}/api/analytics/portfolios`),
          fetch(`${apiUrl}/api/buildings?limit=100`),
        ]);

        if (summaryRes.ok) setSummary(await summaryRes.json());
        if (portfolioRes.ok) {
          const pData = await portfolioRes.json();
          setPortfolios(pData.data ?? []);
        }
        if (buildingsRes.ok) {
          const bData = await buildingsRes.json();
          setAllBuildings(bData.data ?? []);
        }
      } catch {
        // Silent fail — show whatever data we got
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [apiUrl]);

  const navigateToBuilding = (id: string) => {
    window.history.pushState({}, '', `/buildings/${id}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.location.href = `/buildings/${id}`;
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto animate-pulse">
        <div className="h-8 w-64 bg-gray-800 rounded mb-6" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-900/40 rounded-xl" />
          ))}
        </div>
        <div className="h-96 bg-gray-900/40 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-1">Market Analytics</h2>
        <p className="text-sm text-gray-400">Aggregate statistics across {summary?.totals.buildingCount ?? 0} commercial properties</p>
      </div>

      {/* Top-line stats */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <StatCard label="Total Buildings" value={String(summary.totals.buildingCount)} />
          <StatCard label="Avg Cap Rate" value={summary.totals.avgCapRate > 0 ? formatPercent(summary.totals.avgCapRate) : 'N/A'} />
          <StatCard label="Total Portfolio Value" value={summary.totals.totalValue > 0 ? formatCurrency(summary.totals.totalValue, true) : 'N/A'} />
        </div>
      )}

      {/* Interactive Map */}
      {allBuildings.length > 0 && (
        <section className="mb-8">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Building Locations
          </h3>
          <InteractiveMap
            buildings={allBuildings}
            onBuildingClick={(b) => navigateToBuilding(b.id)}
            height="400px"
          />
        </section>
      )}

      {/* Charts row */}
      {summary && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="rounded-xl border border-gray-800 p-5">
            <CityChart data={summary.byCity} />
          </div>
          <div className="rounded-xl border border-gray-800 p-5">
            <TypeMixChart data={summary.byType} />
          </div>
        </div>
      )}

      {/* Cap rate comparison */}
      {summary && summary.byCity.some(c => c.avgCapRate > 0) && (
        <section className="mb-8">
          <div className="rounded-xl border border-gray-800 p-5">
            <CapRateChart data={summary.byCity} />
          </div>
        </section>
      )}

      {/* Portfolio Rankings */}
      {portfolios.length > 0 && (
        <section className="mb-8">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Portfolio Rankings
          </h3>
          <p className="text-xs text-gray-600 mb-4">Owners with 2+ buildings, ranked by total portfolio value</p>
          <div className="rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900/60">
                  <th className="text-left p-3 text-gray-500 font-medium">Owner / REIT</th>
                  <th className="text-right p-3 text-gray-500 font-medium">Buildings</th>
                  <th className="text-right p-3 text-gray-500 font-medium">Portfolio Value</th>
                  <th className="text-right p-3 text-gray-500 font-medium">Avg Cap Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {portfolios.map(p => (
                  <tr key={p.owner}>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => setExpandedOwner(expandedOwner === p.owner ? null : p.owner)}
                        className="text-left hover:text-brand-400 transition-colors"
                      >
                        <span className="font-medium">{p.owner}</span>
                        <span className="text-gray-600 ml-2 text-xs">
                          {expandedOwner === p.owner ? '▾' : '▸'}
                        </span>
                      </button>
                      {expandedOwner === p.owner && (
                        <div className="mt-2 ml-2 space-y-1">
                          {p.buildings.map(b => (
                            <a
                              key={b.id}
                              href={`/buildings/${b.id}`}
                              className="block text-xs text-gray-400 hover:text-brand-400 transition-colors"
                            >
                              {b.name}
                              <span className="text-gray-600 ml-1">— {b.address}</span>
                            </a>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-right font-mono">{p.buildingCount}</td>
                    <td className="p-3 text-right font-mono">
                      {p.totalValue > 0 ? formatCurrency(p.totalValue, true) : '—'}
                    </td>
                    <td className="p-3 text-right font-mono">
                      {p.avgCapRate > 0 ? formatPercent(p.avgCapRate) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
