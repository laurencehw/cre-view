'use client';

import { useState, useEffect } from 'react';
import type { Building, AcrisTransaction } from '@/lib/types';
import { formatCurrency } from '@/lib/format';
import { useAuth } from '@/lib/auth';

interface MortgageHistoryProps {
  building: Building;
}

interface PlutoResult {
  borough: string;
  block: string;
  lot: string;
}

const BOROUGH_MAP: Record<string, number> = {
  MANHATTAN: 1, MN: 1,
  BRONX: 2, BX: 2,
  BROOKLYN: 3, BK: 3,
  QUEENS: 4, QN: 4,
  'STATEN ISLAND': 5, SI: 5,
};

export default function MortgageHistory({ building }: MortgageHistoryProps) {
  const { authHeaders } = useAuth();
  const [transactions, setTransactions] = useState<AcrisTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bblInfo, setBblInfo] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

  useEffect(() => {
    let cancelled = false;

    async function fetchMortgageData() {
      setIsLoading(true);
      setError(null);

      try {
        // Step 1: Search PLUTO for this building to get BBL
        const plutoRes = await fetch(
          `${apiUrl}/api/nyc/pluto/search?address=${encodeURIComponent(building.name)}&limit=1`,
        );
        if (!plutoRes.ok) throw new Error('Failed to search PLUTO');
        const plutoData = await plutoRes.json();

        if (cancelled) return;

        const plutoBuilding = plutoData.data?.[0];
        if (!plutoBuilding?.borough || !plutoBuilding?.block || !plutoBuilding?.lot) {
          // Try address search instead
          const addrParts = building.address.split(',')[0]?.trim();
          if (addrParts) {
            const plutoRes2 = await fetch(
              `${apiUrl}/api/nyc/pluto/search?address=${encodeURIComponent(addrParts)}&limit=1`,
            );
            if (plutoRes2.ok) {
              const plutoData2 = await plutoRes2.json();
              if (cancelled) return;
              const b2 = plutoData2.data?.[0];
              if (!b2?.borough || !b2?.block || !b2?.lot) {
                setError('Could not find BBL data for this building');
                setIsLoading(false);
                return;
              }
              await fetchAcris(b2.borough, b2.block, b2.lot);
              return;
            }
          }
          setError('Could not find BBL data for this building');
          setIsLoading(false);
          return;
        }

        await fetchAcris(plutoBuilding.borough, plutoBuilding.block, plutoBuilding.lot);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load mortgage data');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    async function fetchAcris(boroughName: string, block: string, lot: string) {
      const boroughCode = BOROUGH_MAP[boroughName.toUpperCase()] ?? BOROUGH_MAP[boroughName];
      if (!boroughCode) {
        setError(`Unknown borough: ${boroughName}`);
        return;
      }

      setBblInfo(`Borough ${boroughCode}, Block ${block}, Lot ${lot}`);

      const params = new URLSearchParams({
        borough: String(boroughCode),
        block: String(block),
        lot: String(lot),
        limit: '20',
      });

      const acrisRes = await fetch(`${apiUrl}/api/nyc/acris/search?${params}`, {
        headers: authHeaders(),
      });

      if (acrisRes.status === 401) {
        setError('Sign in to view mortgage history');
        return;
      }
      if (!acrisRes.ok) throw new Error('Failed to fetch ACRIS data');

      const acrisData = await acrisRes.json();
      setTransactions(acrisData.data ?? []);
    }

    fetchMortgageData();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps — fetch once per building
  }, [building.id]);

  return (
    <section>
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
        NYC Mortgage & Deed History
      </h3>

      {bblInfo && (
        <p className="text-xs text-gray-600 mb-2">ACRIS lookup: {bblInfo}</p>
      )}

      {isLoading && (
        <div className="animate-pulse space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 bg-gray-800/40 rounded" />
          ))}
        </div>
      )}

      {error && (
        <p className="text-xs text-gray-500">{error}</p>
      )}

      {!isLoading && !error && transactions.length === 0 && (
        <p className="text-xs text-gray-500">No ACRIS transaction records found</p>
      )}

      {transactions.length > 0 && (
        <div className="rounded-xl border border-gray-800 overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/60">
                <th className="text-left p-3 text-gray-500 font-medium">Date</th>
                <th className="text-left p-3 text-gray-500 font-medium">Type</th>
                <th className="text-right p-3 text-gray-500 font-medium">Amount</th>
                <th className="text-left p-3 text-gray-500 font-medium">Parties</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {transactions.map((t) => (
                <tr key={t.documentId}>
                  <td className="p-3 text-gray-400">{t.recordedDate}</td>
                  <td className="p-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-300">
                      {t.documentType}
                    </span>
                  </td>
                  <td className="p-3 text-right font-mono">
                    {t.amount > 0 ? formatCurrency(t.amount, true) : '—'}
                  </td>
                  <td className="p-3 text-xs text-gray-400">
                    {t.parties?.slice(0, 2).map(p => `${p.name} (${p.role})`).join(', ')}
                    {(t.parties?.length ?? 0) > 2 && ` +${t.parties.length - 2}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
