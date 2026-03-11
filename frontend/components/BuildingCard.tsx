'use client';

import type { DetectedBuilding } from '@/lib/types';

interface BuildingCardProps {
  building: DetectedBuilding;
  isSelected?: boolean;
  onClick?: () => void;
}

export default function BuildingCard({ building, isSelected = false, onClick }: BuildingCardProps) {
  const confidencePct = Math.round(building.confidence * 100);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        w-full text-left rounded-xl border p-4 transition-all
        ${isSelected
          ? 'border-brand-500 bg-brand-900/20'
          : 'border-gray-800 bg-gray-900/40 hover:border-gray-600 hover:bg-gray-900/60'
        }
      `}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-sm leading-snug">{building.name}</span>
        <span
          className={`
            flex-shrink-0 text-xs font-mono px-1.5 py-0.5 rounded
            ${confidencePct >= 90 ? 'bg-green-900/40 text-green-400' : 'bg-yellow-900/40 text-yellow-400'}
          `}
        >
          {confidencePct}%
        </span>
      </div>
      <p className="mt-1 text-xs text-gray-500">ID: {building.buildingId}</p>
    </button>
  );
}
