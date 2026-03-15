'use client';

import { useState, useMemo } from 'react';
import type { BuildingFinancials } from '@/lib/types';
import { formatCurrency, formatPercent } from '@/lib/format';

interface DCFCalculatorProps {
  financials: BuildingFinancials;
}

// Newton-Raphson IRR solver
function calculateIRR(cashFlows: number[], guess = 0.1, maxIter = 200, tol = 0.0001): number | null {
  let rate = guess;
  for (let i = 0; i < maxIter; i++) {
    let npv = 0;
    let dnpv = 0;
    for (let t = 0; t < cashFlows.length; t++) {
      const factor = Math.pow(1 + rate, t);
      npv += cashFlows[t] / factor;
      if (t > 0) dnpv -= t * cashFlows[t] / (factor * (1 + rate));
    }
    if (Math.abs(npv) < tol) return rate;
    if (Math.abs(dnpv) < 1e-10) return null;
    rate = rate - npv / dnpv;
    if (!isFinite(rate) || rate < -1) return null;
  }
  return Math.abs(rate) < 10 ? rate : null;
}

function calculateNPV(cashFlows: number[], discountRate: number): number {
  return cashFlows.reduce((sum, cf, t) => sum + cf / Math.pow(1 + discountRate, t), 0);
}

export default function DCFCalculator({ financials }: DCFCalculatorProps) {
  const { valuation, debt, equity } = financials;

  // Weighted avg interest rate
  const debtTranches = [debt.seniorLoan, ...(debt.mezz ? [debt.mezz] : [])];
  const weightedRate = debt.totalDebt > 0
    ? debtTranches.reduce((s, t) => s + t.amount * t.interestRate, 0) / debt.totalDebt
    : 0.06;

  // User assumptions (as percentages for display, decimals for calc)
  const [purchasePrice, setPurchasePrice] = useState(valuation.estimatedValue);
  const [currentNOI, setCurrentNOI] = useState(valuation.noi);
  const [noiGrowth, setNoiGrowth] = useState(3); // percent
  const [exitCapRate, setExitCapRate] = useState(Math.round((valuation.capRate + 0.005) * 1000) / 10); // percent
  const [holdPeriod, setHoldPeriod] = useState(5);
  const [discountRate, setDiscountRate] = useState(8); // percent
  const [loanAmount, setLoanAmount] = useState(debt.totalDebt);
  const [interestRate, setInterestRate] = useState(Math.round(weightedRate * 1000) / 10); // percent

  const results = useMemo(() => {
    const g = noiGrowth / 100;
    const exitCap = exitCapRate / 100;
    const disc = discountRate / 100;
    const ir = interestRate / 100;
    const equityInvested = purchasePrice - loanAmount;
    if (equityInvested <= 0 || exitCap <= 0) return null;

    // Annual debt service (interest-only)
    const annualDS = loanAmount * ir;

    // Project cash flows
    const cashFlows: { year: number; noi: number; debtService: number; cashFlow: number }[] = [];
    for (let y = 1; y <= holdPeriod; y++) {
      const noi = currentNOI * Math.pow(1 + g, y);
      cashFlows.push({ year: y, noi, debtService: annualDS, cashFlow: noi - annualDS });
    }

    // Terminal value at exit
    const exitNOI = currentNOI * Math.pow(1 + g, holdPeriod + 1);
    const terminalValue = exitNOI / exitCap;
    const saleProceeds = terminalValue - loanAmount; // balloon payoff

    // Equity cash flow series for IRR: negative equity, annual CFs, final year includes sale
    const equityCFs = [-equityInvested];
    cashFlows.forEach((cf, i) => {
      const isLast = i === cashFlows.length - 1;
      equityCFs.push(cf.cashFlow + (isLast ? saleProceeds : 0));
    });

    const irr = calculateIRR(equityCFs);
    const totalCashReturned = equityCFs.slice(1).reduce((s, v) => s + v, 0);
    const equityMultiple = totalCashReturned / equityInvested;
    const npv = calculateNPV(equityCFs, disc);
    const cashOnCash = cashFlows[0] ? cashFlows[0].cashFlow / equityInvested : 0;

    return {
      equityInvested,
      cashFlows,
      terminalValue,
      saleProceeds,
      irr,
      equityMultiple,
      npv,
      cashOnCash,
    };
  }, [purchasePrice, currentNOI, noiGrowth, exitCapRate, holdPeriod, discountRate, loanAmount, interestRate]);

  // Sensitivity table: IRR across exit cap × NOI growth
  const sensitivityTable = useMemo(() => {
    const growthSteps = [-1, 0, 1, 2, 3, 4, 5];
    const exitSteps = [exitCapRate - 1.5, exitCapRate - 1, exitCapRate - 0.5, exitCapRate, exitCapRate + 0.5, exitCapRate + 1, exitCapRate + 1.5]
      .filter(v => v > 0);

    const equityInvested = purchasePrice - loanAmount;
    if (equityInvested <= 0) return null;
    const ir = interestRate / 100;
    const annualDS = loanAmount * ir;

    return {
      growthSteps,
      exitSteps,
      values: growthSteps.map(g => exitSteps.map(ec => {
        const gd = g / 100;
        const ecd = ec / 100;
        if (ecd <= 0) return null;

        const cfs = [-equityInvested];
        for (let y = 1; y <= holdPeriod; y++) {
          const noi = currentNOI * Math.pow(1 + gd, y);
          const cf = noi - annualDS;
          const isLast = y === holdPeriod;
          const exitNOI = currentNOI * Math.pow(1 + gd, holdPeriod + 1);
          const sale = isLast ? (exitNOI / ecd) - loanAmount : 0;
          cfs.push(cf + sale);
        }
        return calculateIRR(cfs);
      })),
    };
  }, [purchasePrice, currentNOI, noiGrowth, exitCapRate, holdPeriod, loanAmount, interestRate]);

  const inputClass = 'w-full px-3 py-2 rounded-lg border border-gray-700 bg-gray-900/50 text-gray-200 text-sm focus:outline-none focus:border-brand-500 text-right';
  const labelClass = 'text-xs text-gray-500 mb-1';

  return (
    <div className="space-y-6">
      {/* Assumptions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <p className={labelClass}>Purchase Price</p>
          <input type="number" value={purchasePrice} onChange={e => setPurchasePrice(Number(e.target.value))} className={inputClass} />
        </div>
        <div>
          <p className={labelClass}>Current NOI</p>
          <input type="number" value={currentNOI} onChange={e => setCurrentNOI(Number(e.target.value))} className={inputClass} />
        </div>
        <div>
          <p className={labelClass}>NOI Growth (%)</p>
          <input type="number" value={noiGrowth} step={0.5} onChange={e => setNoiGrowth(Number(e.target.value))} className={inputClass} />
        </div>
        <div>
          <p className={labelClass}>Exit Cap Rate (%)</p>
          <input type="number" value={exitCapRate} step={0.25} onChange={e => setExitCapRate(Number(e.target.value))} className={inputClass} />
        </div>
        <div>
          <p className={labelClass}>Hold Period (yrs)</p>
          <input type="number" value={holdPeriod} min={1} max={20} onChange={e => setHoldPeriod(Number(e.target.value))} className={inputClass} />
        </div>
        <div>
          <p className={labelClass}>Discount Rate (%)</p>
          <input type="number" value={discountRate} step={0.5} onChange={e => setDiscountRate(Number(e.target.value))} className={inputClass} />
        </div>
        <div>
          <p className={labelClass}>Loan Amount</p>
          <input type="number" value={loanAmount} onChange={e => setLoanAmount(Number(e.target.value))} className={inputClass} />
        </div>
        <div>
          <p className={labelClass}>Interest Rate (%)</p>
          <input type="number" value={interestRate} step={0.25} onChange={e => setInterestRate(Number(e.target.value))} className={inputClass} />
        </div>
      </div>

      {/* Results */}
      {results && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl bg-gray-900/60 border border-gray-800 p-3">
              <p className="text-xs text-gray-500 uppercase mb-1">Levered IRR</p>
              <p className={`text-xl font-semibold ${results.irr != null && results.irr > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {results.irr != null ? `${(results.irr * 100).toFixed(1)}%` : 'N/A'}
              </p>
            </div>
            <div className="rounded-xl bg-gray-900/60 border border-gray-800 p-3">
              <p className="text-xs text-gray-500 uppercase mb-1">Equity Multiple</p>
              <p className="text-xl font-semibold">{results.equityMultiple.toFixed(2)}x</p>
            </div>
            <div className="rounded-xl bg-gray-900/60 border border-gray-800 p-3">
              <p className="text-xs text-gray-500 uppercase mb-1">NPV</p>
              <p className={`text-xl font-semibold ${results.npv > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatCurrency(results.npv, true)}
              </p>
            </div>
            <div className="rounded-xl bg-gray-900/60 border border-gray-800 p-3">
              <p className="text-xs text-gray-500 uppercase mb-1">Cash-on-Cash (Yr 1)</p>
              <p className="text-xl font-semibold">{(results.cashOnCash * 100).toFixed(1)}%</p>
            </div>
          </div>

          {/* Annual Cash Flows */}
          <div className="rounded-xl border border-gray-800 overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900/60">
                  <th className="text-left p-3 text-gray-500 font-medium">Year</th>
                  <th className="text-right p-3 text-gray-500 font-medium">NOI</th>
                  <th className="text-right p-3 text-gray-500 font-medium">Debt Service</th>
                  <th className="text-right p-3 text-gray-500 font-medium">Cash Flow</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                <tr className="text-gray-500">
                  <td className="p-3">0</td>
                  <td className="p-3 text-right">—</td>
                  <td className="p-3 text-right">—</td>
                  <td className="p-3 text-right font-mono text-red-400">({formatCurrency(results.equityInvested, true)})</td>
                </tr>
                {results.cashFlows.map(cf => (
                  <tr key={cf.year}>
                    <td className="p-3">{cf.year}</td>
                    <td className="p-3 text-right font-mono">{formatCurrency(cf.noi, true)}</td>
                    <td className="p-3 text-right font-mono text-gray-400">({formatCurrency(cf.debtService, true)})</td>
                    <td className="p-3 text-right font-mono">{formatCurrency(cf.cashFlow, true)}</td>
                  </tr>
                ))}
                <tr className="bg-gray-900/40">
                  <td className="p-3 font-medium" colSpan={2}>Exit (Sale Proceeds)</td>
                  <td className="p-3 text-right text-xs text-gray-500">TV: {formatCurrency(results.terminalValue, true)}</td>
                  <td className="p-3 text-right font-mono font-semibold text-green-400">{formatCurrency(results.saleProceeds, true)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Sensitivity Table */}
          {sensitivityTable && (
            <div>
              <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                IRR Sensitivity — Exit Cap Rate vs NOI Growth
              </h4>
              <div className="rounded-xl border border-gray-800 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-800 bg-gray-900/60">
                      <th className="p-2 text-gray-500 font-medium text-left">Growth \ Exit</th>
                      {sensitivityTable.exitSteps.map(ec => (
                        <th key={ec} className={`p-2 text-gray-500 font-medium text-center ${Math.abs(ec - exitCapRate) < 0.01 ? 'text-brand-400' : ''}`}>
                          {ec.toFixed(1)}%
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {sensitivityTable.growthSteps.map((g, gi) => (
                      <tr key={g}>
                        <td className={`p-2 font-medium ${Math.abs(g - noiGrowth) < 0.01 ? 'text-brand-400' : 'text-gray-400'}`}>
                          {g.toFixed(1)}%
                        </td>
                        {sensitivityTable.values[gi].map((irr, ei) => {
                          const isBase = Math.abs(g - noiGrowth) < 0.01 && Math.abs(sensitivityTable.exitSteps[ei] - exitCapRate) < 0.01;
                          const irrPct = irr != null ? irr * 100 : null;
                          return (
                            <td
                              key={ei}
                              className={`p-2 text-center font-mono ${
                                isBase ? 'bg-brand-500/10 font-bold' : ''
                              } ${
                                irrPct == null ? 'text-gray-600' :
                                irrPct > 15 ? 'text-green-400' :
                                irrPct > 8 ? 'text-green-300/70' :
                                irrPct > 0 ? 'text-yellow-400' : 'text-red-400'
                              }`}
                            >
                              {irrPct != null ? `${irrPct.toFixed(1)}%` : '—'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
