'use client';

import { useRef } from 'react';
import type { Building, BuildingFinancials } from '@/lib/types';
import { formatCurrency, formatPercent } from '@/lib/format';

interface DealSheetProps {
  building: Building;
  financials: BuildingFinancials;
}

export default function DealSheet({ building, financials }: DealSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  const { valuation, debt, equity } = financials;
  const ltv = valuation.estimatedValue > 0 ? debt.totalDebt / valuation.estimatedValue : 0;
  const debtTranches = [debt.seniorLoan, ...(debt.mezz ? [debt.mezz] : [])];
  const annualDS = debtTranches.reduce((s, t) => s + t.amount * t.interestRate, 0);
  const dscr = annualDS > 0 ? valuation.noi / annualDS : 0;

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow || !sheetRef.current) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${building.name} — Deal Sheet</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111; padding: 40px; max-width: 800px; margin: 0 auto; }
          h1 { font-size: 24px; margin-bottom: 4px; }
          h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #666; margin: 24px 0 12px; border-bottom: 1px solid #ddd; padding-bottom: 6px; }
          .subtitle { color: #666; font-size: 14px; margin-bottom: 4px; }
          .meta { color: #999; font-size: 12px; margin-bottom: 24px; }
          .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
          .kpi { background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 12px; }
          .kpi-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; margin-bottom: 4px; }
          .kpi-value { font-size: 20px; font-weight: 600; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 8px; }
          th { text-align: left; padding: 8px; background: #f8f9fa; border-bottom: 2px solid #dee2e6; font-size: 11px; text-transform: uppercase; color: #666; }
          td { padding: 8px; border-bottom: 1px solid #f0f0f0; }
          td.right { text-align: right; font-variant-numeric: tabular-nums; }
          .total-row td { font-weight: 600; border-top: 2px solid #dee2e6; }
          .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 11px; color: #999; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        ${sheetRef.current.innerHTML}
      </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 250);
  };

  return (
    <div>
      <button
        type="button"
        onClick={handlePrint}
        className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium transition-colors"
      >
        Generate Deal Sheet
      </button>

      {/* Hidden printable content */}
      <div ref={sheetRef} className="hidden">
        <h1>{building.name}</h1>
        <div className="subtitle">{building.address}</div>
        <div className="meta">
          {building.floors > 0 && `${building.floors} floors · `}
          {building.primaryUse}
          {building.completionYear > 0 && ` · Built ${building.completionYear}`}
          {building.owner && building.owner !== 'Unknown' && ` · Owner: ${building.owner}`}
        </div>

        <h2>Key Metrics</h2>
        <div className="kpi-grid">
          <div className="kpi"><div className="kpi-label">Valuation</div><div className="kpi-value">{formatCurrency(valuation.estimatedValue, true)}</div></div>
          <div className="kpi"><div className="kpi-label">Cap Rate</div><div className="kpi-value">{formatPercent(valuation.capRate)}</div></div>
          <div className="kpi"><div className="kpi-label">NOI</div><div className="kpi-value">{formatCurrency(valuation.noi, true)}</div></div>
          <div className="kpi"><div className="kpi-label">LTV</div><div className="kpi-value">{formatPercent(ltv)}</div></div>
          <div className="kpi"><div className="kpi-label">DSCR</div><div className="kpi-value">{dscr > 0 ? `${dscr.toFixed(2)}x` : 'N/A'}</div></div>
          <div className="kpi"><div className="kpi-label">Total Equity</div><div className="kpi-value">{formatCurrency(equity.totalEquity, true)}</div></div>
        </div>

        <h2>Debt Structure</h2>
        <table>
          <thead>
            <tr><th>Tranche</th><th style={{textAlign:'right'}}>Amount</th><th style={{textAlign:'right'}}>Rate</th><th style={{textAlign:'right'}}>Maturity</th><th>Lender</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Senior Loan</td>
              <td className="right">{formatCurrency(debt.seniorLoan.amount, true)}</td>
              <td className="right">{formatPercent(debt.seniorLoan.interestRate)}</td>
              <td className="right">{debt.seniorLoan.maturityDate}</td>
              <td>{debt.seniorLoan.lender}</td>
            </tr>
            {debt.mezz && (
              <tr>
                <td>Mezzanine</td>
                <td className="right">{formatCurrency(debt.mezz.amount, true)}</td>
                <td className="right">{formatPercent(debt.mezz.interestRate)}</td>
                <td className="right">{debt.mezz.maturityDate}</td>
                <td>{debt.mezz.lender}</td>
              </tr>
            )}
            <tr className="total-row">
              <td>Total Debt</td>
              <td className="right">{formatCurrency(debt.totalDebt, true)}</td>
              <td colSpan={3}></td>
            </tr>
          </tbody>
        </table>

        <h2>Cap Table</h2>
        <table>
          <thead>
            <tr><th>Investor</th><th style={{textAlign:'right'}}>Ownership</th><th style={{textAlign:'right'}}>Amount</th></tr>
          </thead>
          <tbody>
            {equity.capTable.map(e => (
              <tr key={e.investor}>
                <td>{e.investor}</td>
                <td className="right">{formatPercent(e.ownership)}</td>
                <td className="right">{formatCurrency(e.amount, true)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="footer">
          Generated by CRE View · Data as of {financials.asOfDate} · For informational purposes only
        </div>
      </div>
    </div>
  );
}
