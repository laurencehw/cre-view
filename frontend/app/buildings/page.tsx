'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Building, BuildingFinancials } from '@/lib/types';
import type { PaginatedResult } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import BuildingGrid from '@/components/BuildingGrid';
import BuildingSearchFilters, { defaultFilters, type FilterState } from '@/components/BuildingSearchFilters';
import BuildingDetailTabs from '@/components/BuildingDetailTabs';
import SavedSearches from '@/components/SavedSearches';
import WatchlistButton from '@/components/WatchlistButton';

export default function BuildingsPage() {
  const { isAuthenticated, authHeaders } = useAuth();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

  // ─── Routing state ──────────────────────────────────────────────────────────
  const [buildingId, setBuildingId] = useState<string | null>(null);

  useEffect(() => {
    const match = window.location.pathname.match(/^\/buildings\/(.+)/);
    if (match) setBuildingId(decodeURIComponent(match[1]));

    const handlePopState = () => {
      const m = window.location.pathname.match(/^\/buildings\/(.+)/);
      setBuildingId(m ? decodeURIComponent(m[1]) : null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateToBuilding = (id: string) => {
    window.history.pushState({}, '', `/buildings/${id}`);
    setBuildingId(id);
    window.scrollTo(0, 0);
  };

  const navigateToList = () => {
    window.history.pushState({}, '', '/buildings');
    setBuildingId(null);
  };

  // ─── Search state ───────────────────────────────────────────────────────────
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [page, setPage] = useState(1);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoadingList, setIsLoadingList] = useState(true);

  // Filter options from backend
  const [cities, setCities] = useState<string[]>([]);
  const [propertyTypes, setPropertyTypes] = useState<string[]>([]);

  // Fetch filter options on mount
  useEffect(() => {
    fetch(`${apiUrl}/api/buildings/filters`)
      .then(r => r.ok ? r.json() : { cities: [], propertyTypes: [] })
      .then(data => {
        setCities(data.cities ?? []);
        setPropertyTypes(data.propertyTypes ?? []);
      })
      .catch(() => {});
  }, [apiUrl]);

  // Fetch buildings when filters or page change
  useEffect(() => {
    if (buildingId) return; // Don't fetch list when viewing detail

    setIsLoadingList(true);
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', '18');
    if (filters.search) params.set('search', filters.search);
    if (filters.city) params.set('city', filters.city);
    if (filters.primaryUse) params.set('primaryUse', filters.primaryUse);
    if (filters.minFloors) params.set('minFloors', filters.minFloors);
    if (filters.maxFloors) params.set('maxFloors', filters.maxFloors);
    if (filters.sortBy) params.set('sortBy', filters.sortBy);
    if (filters.sortDir) params.set('sortDir', filters.sortDir);

    fetch(`${apiUrl}/api/buildings?${params}`)
      .then(r => {
        if (!r.ok) throw new Error('Failed to load buildings');
        return r.json();
      })
      .then((data: PaginatedResult<Building>) => {
        setBuildings(data.data);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      })
      .catch(() => {
        setBuildings([]);
        setTotal(0);
        setTotalPages(0);
      })
      .finally(() => setIsLoadingList(false));
  }, [apiUrl, filters, page, buildingId]);

  const handleFiltersChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    setPage(1); // Reset to first page on filter change
  };

  // ─── Detail state ───────────────────────────────────────────────────────────
  const [detailBuilding, setDetailBuilding] = useState<Building | null>(null);
  const [detailFinancials, setDetailFinancials] = useState<BuildingFinancials | null>(null);
  const [detailFinancialError, setDetailFinancialError] = useState<string | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isLoadingFinancials, setIsLoadingFinancials] = useState(false);

  // Fetch building detail when buildingId changes
  useEffect(() => {
    if (!buildingId) {
      setDetailBuilding(null);
      setDetailFinancials(null);
      setDetailFinancialError(null);
      return;
    }

    setIsLoadingDetail(true);
    setDetailFinancials(null);
    setDetailFinancialError(null);

    // Fetch building details
    fetch(`${apiUrl}/api/buildings/${buildingId}`)
      .then(r => {
        if (!r.ok) throw new Error('Building not found');
        return r.json();
      })
      .then(data => setDetailBuilding(data))
      .catch(() => setDetailBuilding(null))
      .finally(() => setIsLoadingDetail(false));

    // Fetch financials (requires auth)
    if (isAuthenticated) {
      setIsLoadingFinancials(true);
      fetch(`${apiUrl}/api/buildings/${buildingId}/financials`, {
        headers: authHeaders(),
      })
        .then(r => {
          if (r.status === 401) throw new Error('Please sign in to view financial data');
          if (r.status === 404) return null;
          if (!r.ok) throw new Error('Failed to load financial data');
          return r.json();
        })
        .then(data => setDetailFinancials(data))
        .catch(err => setDetailFinancialError(err instanceof Error ? err.message : 'Failed'))
        .finally(() => setIsLoadingFinancials(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingId, apiUrl, isAuthenticated]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  // Detail view
  if (buildingId) {
    if (isLoadingDetail) {
      return (
        <div className="p-6 max-w-4xl mx-auto animate-pulse">
          <div className="h-4 w-24 bg-gray-800 rounded mb-6" />
          <div className="h-8 w-96 bg-gray-800 rounded mb-2" />
          <div className="h-4 w-64 bg-gray-800/60 rounded mb-6" />
          <div className="h-10 w-full bg-gray-800/40 rounded mb-4" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-gray-900/60 border border-gray-800 p-4">
                <div className="h-3 w-16 bg-gray-800 rounded mb-2" />
                <div className="h-6 w-20 bg-gray-800 rounded" />
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (!detailBuilding) {
      return (
        <div className="p-6 max-w-4xl mx-auto">
          <button
            type="button"
            onClick={navigateToList}
            className="text-sm text-gray-400 hover:text-white transition-colors mb-6"
          >
            &larr; Back to buildings
          </button>
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">Building not found</p>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-4xl mx-auto">
        {/* Back button + title */}
        <div className="p-6 pb-0">
          <button
            type="button"
            onClick={navigateToList}
            className="text-sm text-gray-400 hover:text-white transition-colors mb-4 inline-flex items-center gap-1"
          >
            &larr; Back to buildings
          </button>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">{detailBuilding.name}</h2>
            <WatchlistButton buildingId={detailBuilding.id} />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-gray-400">
            <span>{detailBuilding.address}</span>
            {detailBuilding.floors > 0 && <span>{detailBuilding.floors} floors</span>}
            {detailBuilding.primaryUse && <span>{detailBuilding.primaryUse}</span>}
          </div>
        </div>

        <BuildingDetailTabs
          building={detailBuilding}
          financials={detailFinancials}
          financialError={detailFinancialError}
          isLoadingFinancials={isLoadingFinancials}
          isAuthenticated={isAuthenticated}
          onBuildingSelect={navigateToBuilding}
        />
      </div>
    );
  }

  // List view
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-1">Buildings</h2>
        <p className="text-sm text-gray-400">Browse and search commercial real estate across major US cities</p>
      </div>

      <div className="mb-6">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <BuildingSearchFilters
              filters={filters}
              onFiltersChange={handleFiltersChange}
              cities={cities}
              propertyTypes={propertyTypes}
            />
          </div>
          <SavedSearches currentFilters={filters} onLoadSearch={handleFiltersChange} />
        </div>
      </div>

      <BuildingGrid
        buildings={buildings}
        total={total}
        page={page}
        totalPages={totalPages}
        onBuildingSelect={navigateToBuilding}
        onPageChange={setPage}
        isLoading={isLoadingList}
      />
    </div>
  );
}
