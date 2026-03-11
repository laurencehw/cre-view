'use client';

import type { DetectedBuilding, Building, BuildingFinancials } from '@/lib/types';
import { formatCurrency, formatPercent } from '@/lib/format';

interface FinancialPanelProps {
  building: DetectedBuilding;
  financials: BuildingFinancials;
  details?: Building | null;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-gray-900/60 border border-gray-800 p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}

export default function FinancialPanel({ building, financials, details }: FinancialPanelProps) {
  const { valuation, debt, equity } = financials;
  const ltv = valuation.estimatedValue > 0 ? debt.totalDebt / valuation.estimatedValue : 0;

  // Weighted average interest rate across all debt tranches
  const debtTranches = [debt.seniorLoan, ...(debt.mezz ? [debt.mezz] : [])];
  const weightedAvgRate =
    debt.totalDebt > 0
      ? debtTranches.reduce((sum, t) => sum + t.amount * t.interestRate, 0) / debt.totalDebt
      : 0;

  // Debt Service Coverage Ratio: NOI / annual debt service (simplified as interest-only)
  const annualDebtService = debtTranches.reduce((sum, t) => sum + t.amount * t.interestRate, 0);
  const dscr = annualDebtService > 0 ? valuation.noi / annualDebtService : 0;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Title */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold">{building.name}</h2>
        {details && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-gray-400">
            <span>{details.address}</span>
            <span>{details.floors} floors</span>
            <span>{details.heightFt.toLocaleString()} ft</span>
            <span>{details.primaryUse}</span>
            <span>Built {details.completionYear}</span>
          </div>
        )}
        <p className="text-sm text-gray-500 mt-1">As of {financials.asOfDate}</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        <StatCard label="Valuation" value={formatCurrency(valuation.estimatedValue, true)} />
        <StatCard label="Cap Rate" value={formatPercent(valuation.capRate)} />
        <StatCard label="NOI" value={formatCurrency(valuation.noi, true)} />
        <StatCard label="LTV" value={formatPercent(ltv)} />
        <StatCard label="DSCR" value={annualDebtService > 0 ? `${dscr.toFixed(2)}x` : 'N/A'} />
        <StatCard label="Wtd Avg Rate" value={formatPercent(weightedAvgRate)} />
      </div>

      {/* Debt */}
      <section className="mb-8">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Debt Structure
        </h3>
        <div className="rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/60">
                <th className="text-left p-3 text-gray-500 font-medium">Tranche</th>
                <th className="text-right p-3 text-gray-500 font-medium">Amount</th>
                <th className="text-right p-3 text-gray-500 font-medium">Rate</th>
                <th className="text-right p-3 text-gray-500 font-medium">Maturity</th>
                <th className="text-left p-3 text-gray-500 font-medium hidden sm:table-cell">Lender</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              <tr>
                <td className="p-3 font-medium">Senior Loan</td>
                <td className="p-3 text-right font-mono">{formatCurrency(debt.seniorLoan.amount, true)}</td>
                <td className="p-3 text-right font-mono">{formatPercent(debt.seniorLoan.interestRate)}</td>
                <td className="p-3 text-right text-gray-400">{debt.seniorLoan.maturityDate}</td>
                <td className="p-3 text-gray-400 hidden sm:table-cell">{debt.seniorLoan.lender}</td>
              </tr>
              {debt.mezz && (
                <tr>
                  <td className="p-3 font-medium">Mezzanine</td>
                  <td className="p-3 text-right font-mono">{formatCurrency(debt.mezz.amount, true)}</td>
                  <td className="p-3 text-right font-mono">{formatPercent(debt.mezz.interestRate)}</td>
                  <td className="p-3 text-right text-gray-400">{debt.mezz.maturityDate}</td>
                  <td className="p-3 text-gray-400 hidden sm:table-cell">{debt.mezz.lender}</td>
                </tr>
              )}
              <tr className="bg-gray-900/40">
                <td className="p-3 font-semibold">Total Debt</td>
                <td className="p-3 text-right font-mono font-semibold">{formatCurrency(debt.totalDebt, true)}</td>
                <td colSpan={3} />
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Equity / Cap Table */}
      <section>
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Cap Table — {formatCurrency(equity.totalEquity, true)} Total Equity
        </h3>
        <div className="rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/60">
                <th className="text-left p-3 text-gray-500 font-medium">Investor</th>
                <th className="text-right p-3 text-gray-500 font-medium">Ownership</th>
                <th className="text-right p-3 text-gray-500 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {equity.capTable.map((entry) => (
                <tr key={entry.investor}>
                  <td className="p-3">{entry.investor}</td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="hidden sm:block w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-500 rounded-full"
                          style={{ width: `${entry.ownership * 100}%` }}
                        />
                      </div>
                      <span className="font-mono">{formatPercent(entry.ownership)}</span>
                    </div>
                  </td>
                  <td className="p-3 text-right font-mono">{formatCurrency(entry.amount, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
