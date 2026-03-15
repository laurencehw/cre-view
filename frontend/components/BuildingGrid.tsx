'use client';

import type { Building } from '@/lib/types';
import { formatCurrency } from '@/lib/format';

interface BuildingGridProps {
  buildings: Building[];
  total: number;
  page: number;
  totalPages: number;
  onBuildingSelect: (id: string) => void;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

function BuildingSummaryCard({
  building,
  onClick,
}: {
  building: Building;
  onClick: () => void;
}) {
  // Extract city from address
  const parts = building.address.split(',').map(s => s.trim());
  const city = parts.length >= 2 ? parts[parts.length - 2] : '';

  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left rounded-xl border border-gray-800 bg-gray-900/40 p-4 hover:border-gray-600 hover:bg-gray-900/60 transition-all group"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-semibold text-sm group-hover:text-brand-400 transition-colors leading-tight">
          {building.name}
        </h3>
        {city && (
          <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700">
            {city}
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500 mb-3 truncate">{building.address}</p>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-400">
        {building.floors > 0 && <span>{building.floors} floors</span>}
        {building.primaryUse && <span>{building.primaryUse}</span>}
        {building.completionYear > 0 && <span>Built {building.completionYear}</span>}
      </div>
      {building.owner && building.owner !== 'Unknown' && (
        <p className="text-xs text-gray-500 mt-2 truncate">Owner: {building.owner}</p>
      )}
    </button>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4 animate-pulse">
      <div className="h-4 w-3/4 bg-gray-800 rounded mb-2" />
      <div className="h-3 w-full bg-gray-800/60 rounded mb-3" />
      <div className="flex gap-3">
        <div className="h-3 w-16 bg-gray-800/40 rounded" />
        <div className="h-3 w-16 bg-gray-800/40 rounded" />
      </div>
    </div>
  );
}

export default function BuildingGrid({
  buildings,
  total,
  page,
  totalPages,
  onBuildingSelect,
  onPageChange,
  isLoading,
}: BuildingGridProps) {
  if (isLoading) {
    return (
      <div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (buildings.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg mb-1">No buildings found</p>
        <p className="text-sm">Try adjusting your search or filters</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs text-gray-500 mb-4">
        {total} building{total !== 1 ? 's' : ''} found
        {totalPages > 1 && ` · Page ${page} of ${totalPages}`}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {buildings.map(b => (
          <BuildingSummaryCard
            key={b.id}
            building={b}
            onClick={() => onBuildingSelect(b.id)}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="px-3 py-1.5 rounded-lg border border-gray-700 bg-gray-800 text-gray-300 text-xs hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 7) {
                pageNum = i + 1;
              } else if (page <= 4) {
                pageNum = i + 1;
              } else if (page >= totalPages - 3) {
                pageNum = totalPages - 6 + i;
              } else {
                pageNum = page - 3 + i;
              }
              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => onPageChange(pageNum)}
                  className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                    pageNum === page
                      ? 'bg-brand-600 text-white'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="px-3 py-1.5 rounded-lg border border-gray-700 bg-gray-800 text-gray-300 text-xs hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
