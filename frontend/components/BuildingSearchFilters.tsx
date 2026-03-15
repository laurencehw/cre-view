'use client';

import { useState, useEffect } from 'react';

export interface FilterState {
  search: string;
  city: string;
  primaryUse: string;
  minFloors: string;
  maxFloors: string;
  sortBy: string;
  sortDir: 'ASC' | 'DESC';
}

interface BuildingSearchFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  cities: string[];
  propertyTypes: string[];
}

export const defaultFilters: FilterState = {
  search: '',
  city: '',
  primaryUse: '',
  minFloors: '',
  maxFloors: '',
  sortBy: 'name',
  sortDir: 'ASC',
};

export default function BuildingSearchFilters({
  filters,
  onFiltersChange,
  cities,
  propertyTypes,
}: BuildingSearchFiltersProps) {
  // Debounce search input
  const [searchInput, setSearchInput] = useState(filters.search);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        onFiltersChange({ ...filters, search: searchInput });
      }
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps — debounce: only fire on searchInput change
  }, [searchInput]);

  const update = (partial: Partial<FilterState>) => {
    onFiltersChange({ ...filters, ...partial });
  };

  const hasActiveFilters = filters.city || filters.primaryUse || filters.minFloors || filters.maxFloors;

  const clearFilters = () => {
    setSearchInput('');
    onFiltersChange(defaultFilters);
  };

  const inputClass = 'px-3 py-2 rounded-lg border border-gray-700 bg-gray-900/50 text-gray-200 text-sm focus:outline-none focus:border-brand-500';
  const selectClass = `${inputClass} appearance-none cursor-pointer`;

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <input
        type="text"
        placeholder="Search by name, address, or owner..."
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        className={`w-full ${inputClass} placeholder-gray-500`}
      />

      {/* Filter row */}
      <div className="flex flex-wrap gap-2 items-end">
        <select
          value={filters.city}
          onChange={(e) => update({ city: e.target.value })}
          className={selectClass}
        >
          <option value="">All Cities</option>
          {cities.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select
          value={filters.primaryUse}
          onChange={(e) => update({ primaryUse: e.target.value })}
          className={selectClass}
        >
          <option value="">All Types</option>
          {propertyTypes.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <div className="flex items-center gap-1">
          <input
            type="number"
            placeholder="Min floors"
            value={filters.minFloors}
            onChange={(e) => update({ minFloors: e.target.value })}
            min={1}
            className={`w-24 ${inputClass} placeholder-gray-500`}
          />
          <span className="text-gray-600">–</span>
          <input
            type="number"
            placeholder="Max"
            value={filters.maxFloors}
            onChange={(e) => update({ maxFloors: e.target.value })}
            min={1}
            className={`w-20 ${inputClass} placeholder-gray-500`}
          />
        </div>

        <select
          value={`${filters.sortBy}:${filters.sortDir}`}
          onChange={(e) => {
            const [sortBy, sortDir] = e.target.value.split(':') as [string, 'ASC' | 'DESC'];
            update({ sortBy, sortDir });
          }}
          className={selectClass}
        >
          <option value="name:ASC">Name A–Z</option>
          <option value="name:DESC">Name Z–A</option>
          <option value="floors:DESC">Most Floors</option>
          <option value="floors:ASC">Fewest Floors</option>
          <option value="completionYear:DESC">Newest</option>
          <option value="completionYear:ASC">Oldest</option>
          <option value="owner:ASC">Owner A–Z</option>
        </select>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="px-3 py-2 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
