'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import type { FilterState } from '@/components/BuildingSearchFilters';

interface SavedSearch {
  id: string;
  name: string;
  filters: FilterState;
  createdAt: string;
}

interface SavedSearchesProps {
  currentFilters: FilterState;
  onLoadSearch: (filters: FilterState) => void;
}

export default function SavedSearches({ currentFilters, onLoadSearch }: SavedSearchesProps) {
  const { isAuthenticated, authHeaders } = useAuth();
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

  // Fetch saved searches
  useEffect(() => {
    if (!isAuthenticated) return;

    fetch(`${apiUrl}/api/saved-searches`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : { data: [] })
      .then(data => setSearches(data.data ?? []))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  if (!isAuthenticated) return null;

  const hasActiveFilters = currentFilters.search || currentFilters.city || currentFilters.primaryUse
    || currentFilters.minFloors || currentFilters.maxFloors;

  const handleSave = async () => {
    if (!saveName.trim()) return;
    setIsSaving(true);
    try {
      const res = await fetch(`${apiUrl}/api/saved-searches`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: saveName.trim(), filters: currentFilters }),
      });
      if (res.ok) {
        const saved = await res.json();
        setSearches(prev => [{ ...saved, createdAt: new Date().toISOString() }, ...prev]);
        setSaveName('');
      }
    } catch {
      // Silent fail
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`${apiUrl}/api/saved-searches/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      setSearches(prev => prev.filter(s => s.id !== id));
    } catch {
      // Silent fail
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-2 rounded-lg border border-gray-700 bg-gray-800 text-gray-300 text-sm hover:bg-gray-700 transition-colors flex items-center gap-1.5"
      >
        <span className="text-xs">💾</span>
        Searches
        {searches.length > 0 && (
          <span className="text-[10px] bg-gray-700 rounded-full px-1.5 text-gray-400">{searches.length}</span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-72 rounded-xl border border-gray-800 bg-gray-900 shadow-xl z-50">
          <div className="p-3 border-b border-gray-800">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Save Current Search</p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search name..."
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                className="flex-1 px-2 py-1.5 rounded-lg border border-gray-700 bg-gray-800 text-gray-200 text-xs placeholder-gray-500 focus:outline-none focus:border-brand-500"
              />
              <button
                type="button"
                onClick={handleSave}
                disabled={!saveName.trim() || !hasActiveFilters || isSaving}
                className="px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-medium disabled:opacity-40 hover:bg-brand-700 transition-colors"
              >
                Save
              </button>
            </div>
            {!hasActiveFilters && (
              <p className="text-[10px] text-gray-600 mt-1">Set some filters first</p>
            )}
          </div>

          <div className="max-h-48 overflow-y-auto">
            {searches.length === 0 ? (
              <p className="p-3 text-xs text-gray-600 text-center">No saved searches yet</p>
            ) : (
              searches.map(s => (
                <div
                  key={s.id}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-gray-800/50 transition-colors border-b border-gray-800/50 last:border-0"
                >
                  <button
                    type="button"
                    onClick={() => { onLoadSearch(s.filters); setIsOpen(false); }}
                    className="flex-1 text-left text-xs text-gray-300 hover:text-white transition-colors truncate"
                  >
                    {s.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(s.id)}
                    className="text-gray-600 hover:text-red-400 transition-colors text-xs shrink-0"
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
