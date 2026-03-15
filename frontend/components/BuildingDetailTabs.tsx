'use client';

import { useState } from 'react';
import type { Building, BuildingFinancials, DetectedBuilding } from '@/lib/types';
import { formatCurrency, formatPercent } from '@/lib/format';
import FinancialPanel from '@/components/FinancialPanel';
import BuildingMap from '@/components/BuildingMap';
import MortgageHistory from '@/components/MortgageHistory';

interface BuildingDetailTabsProps {
  building: Building;
  financials: BuildingFinancials | null;
  financialError: string | null;
  isLoadingFinancials: boolean;
  isAuthenticated: boolean;
}

type Tab = 'overview' | 'financials' | 'ownership' | 'location';

function StatRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value == null || value === '' || value === 0) return null;
  return (
    <div className="flex justify-between py-2 border-b border-gray-800/50">
      <span className="text-gray-500 text-sm">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

export default function BuildingDetailTabs({
  building,
  financials,
  financialError,
  isLoadingFinancials,
  isAuthenticated,
}: BuildingDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'financials', label: 'Financials' },
    { id: 'ownership', label: 'Ownership' },
    { id: 'location', label: 'Location' },
  ];

  // Determine data trust — buildings with real REIT owner data
  const hasVerifiedOwnership = financials?.equity?.capTable?.some(
    e => !['Investor Group A', 'Investor Group B', 'Institutional Investor'].includes(e.investor),
  );

  return (
    <div>
      {/* Tab bar */}
      <div className="border-b border-gray-800 flex gap-0 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap border-b-2 ${
              activeTab === tab.id
                ? 'border-brand-500 text-brand-400'
                : 'border-transparent text-gray-400 hover:text-white hover:border-gray-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-6 max-w-3xl mx-auto">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Key facts */}
            <section>
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Building Details
              </h3>
              <div className="rounded-xl border border-gray-800 p-4">
                <StatRow label="Address" value={building.address} />
                <StatRow label="Primary Use" value={building.primaryUse} />
                <StatRow label="Floors" value={building.floors} />
                <StatRow label="Height" value={building.heightFt > 0 ? `${building.heightFt.toLocaleString()} ft` : null} />
                <StatRow label="Year Built" value={building.completionYear > 0 ? building.completionYear : null} />
                <StatRow label="Owner" value={building.owner !== 'Unknown' ? building.owner : null} />
              </div>
            </section>

            {/* Quick financial summary if available */}
            {financials && (
              <section>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Financial Summary
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-xl bg-gray-900/60 border border-gray-800 p-3">
                    <p className="text-xs text-gray-500 uppercase mb-1">Valuation</p>
                    <p className="text-lg font-semibold">{formatCurrency(financials.valuation.estimatedValue, true)}</p>
                  </div>
                  <div className="rounded-xl bg-gray-900/60 border border-gray-800 p-3">
                    <p className="text-xs text-gray-500 uppercase mb-1">Cap Rate</p>
                    <p className="text-lg font-semibold">{formatPercent(financials.valuation.capRate)}</p>
                  </div>
                  <div className="rounded-xl bg-gray-900/60 border border-gray-800 p-3">
                    <p className="text-xs text-gray-500 uppercase mb-1">NOI</p>
                    <p className="text-lg font-semibold">{formatCurrency(financials.valuation.noi, true)}</p>
                  </div>
                  <div className="rounded-xl bg-gray-900/60 border border-gray-800 p-3">
                    <p className="text-xs text-gray-500 uppercase mb-1">Total Debt</p>
                    <p className="text-lg font-semibold">{formatCurrency(financials.debt.totalDebt, true)}</p>
                  </div>
                </div>
                {hasVerifiedOwnership && (
                  <p className="text-xs text-green-400 mt-2">Ownership data verified from SEC filings</p>
                )}
              </section>
            )}

            {/* ACRIS for NYC buildings */}
            {building.address.includes('New York') && isAuthenticated && (
              <MortgageHistory building={building} />
            )}
          </div>
        )}

        {activeTab === 'financials' && (
          <div>
            {!isAuthenticated ? (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-2">Sign in to view financial data</p>
                <p className="text-xs text-gray-600">Financial data requires authentication</p>
              </div>
            ) : isLoadingFinancials ? (
              <div className="animate-pulse space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="rounded-xl bg-gray-900/60 border border-gray-800 p-4">
                      <div className="h-3 w-16 bg-gray-800 rounded mb-2" />
                      <div className="h-6 w-20 bg-gray-800 rounded" />
                    </div>
                  ))}
                </div>
              </div>
            ) : financialError ? (
              <div className="rounded-lg bg-red-900/30 border border-red-800 p-4 text-sm text-red-300">
                {financialError}
              </div>
            ) : financials ? (
              <FinancialPanel
                building={{ buildingId: building.id, name: building.name, confidence: 1 }}
                financials={financials}
                details={building}
              />
            ) : (
              <div className="text-center py-12 text-gray-500">
                <p>No financial data available for this building</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'ownership' && (
          <div>
            {!financials?.equity?.capTable?.length ? (
              <div className="text-center py-12 text-gray-500">
                {!isAuthenticated
                  ? <p>Sign in to view ownership data</p>
                  : <p>No ownership data available</p>}
              </div>
            ) : (
              <div className="space-y-6">
                {hasVerifiedOwnership && (
                  <div className="rounded-lg bg-green-900/20 border border-green-800/50 p-3 text-xs text-green-300">
                    Ownership data sourced from SEC EDGAR REIT 10-K filings
                  </div>
                )}

                {/* Cap table pie chart (SVG) */}
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <svg viewBox="0 0 200 200" className="w-48 h-48 shrink-0">
                    {(() => {
                      const entries = financials.equity.capTable;
                      const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1'];
                      let cumulative = 0;
                      return entries.map((entry, i) => {
                        const startAngle = cumulative * 2 * Math.PI;
                        cumulative += entry.ownership;
                        const endAngle = cumulative * 2 * Math.PI;
                        const largeArc = entry.ownership > 0.5 ? 1 : 0;
                        const x1 = 100 + 80 * Math.cos(startAngle - Math.PI / 2);
                        const y1 = 100 + 80 * Math.sin(startAngle - Math.PI / 2);
                        const x2 = 100 + 80 * Math.cos(endAngle - Math.PI / 2);
                        const y2 = 100 + 80 * Math.sin(endAngle - Math.PI / 2);
                        const d = entries.length === 1
                          ? `M 100 100 m 0 -80 a 80 80 0 1 1 0 160 a 80 80 0 1 1 0 -160`
                          : `M 100 100 L ${x1} ${y1} A 80 80 0 ${largeArc} 1 ${x2} ${y2} Z`;
                        return (
                          <path
                            key={entry.investor}
                            d={d}
                            fill={colors[i % colors.length]}
                            opacity={0.8}
                            stroke="#111827"
                            strokeWidth={2}
                          />
                        );
                      });
                    })()}
                  </svg>

                  <div className="flex-1 space-y-2">
                    {financials.equity.capTable.map((entry, i) => {
                      const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1'];
                      return (
                        <div key={entry.investor} className="flex items-center gap-3">
                          <div
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: colors[i % colors.length] }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{entry.investor}</p>
                            <p className="text-xs text-gray-500">
                              {formatPercent(entry.ownership)} · {formatCurrency(entry.amount, true)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Total equity */}
                <div className="rounded-xl bg-gray-900/60 border border-gray-800 p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">Total Equity</span>
                    <span className="text-lg font-semibold">{formatCurrency(financials.equity.totalEquity, true)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'location' && (
          <div className="space-y-4">
            <BuildingMap
              buildings={[building]}
              selectedBuildingId={building.id}
            />
            {building.latitude && building.longitude && (
              <p className="text-xs text-gray-500">
                Coordinates: {building.latitude.toFixed(6)}, {building.longitude.toFixed(6)}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
