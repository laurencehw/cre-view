'use client';

import { useMemo } from 'react';
import type { Building } from '@/lib/types';

interface BuildingMapProps {
  buildings: Building[];
  selectedBuildingId?: string | null;
  onBuildingClick?: (building: Building) => void;
}

/**
 * Static map visualization using OpenStreetMap tiles.
 * Once you have a Mapbox token, swap this for a proper Mapbox GL JS map.
 *
 * For now this renders a simple centered-on-building map using an iframe
 * to OpenStreetMap, which requires no API key.
 */
export default function BuildingMap({ buildings, selectedBuildingId, onBuildingClick }: BuildingMapProps) {
  const center = useMemo(() => {
    if (buildings.length === 0) return { lat: 40.7484, lng: -73.9856 }; // NYC default

    const selected = buildings.find((b) => b.id === selectedBuildingId);
    if (selected) return { lat: selected.latitude, lng: selected.longitude };

    // Center on the average of all buildings
    const avgLat = buildings.reduce((sum, b) => sum + b.latitude, 0) / buildings.length;
    const avgLng = buildings.reduce((sum, b) => sum + b.longitude, 0) / buildings.length;
    return { lat: avgLat, lng: avgLng };
  }, [buildings, selectedBuildingId]);

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const hasMapbox = mapboxToken && mapboxToken !== 'your_mapbox_public_token_here';

  // Build markers string for Mapbox static API
  const markers = buildings
    .map((b) => {
      const color = b.id === selectedBuildingId ? 'f44' : '4a9';
      return `pin-s+${color}(${b.longitude},${b.latitude})`;
    })
    .join(',');

  if (hasMapbox) {
    const staticMapUrl = `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${markers}/${center.lng},${center.lat},13,0/600x300@2x?access_token=${mapboxToken}`;
    return (
      <div className="rounded-xl border border-gray-800 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={staticMapUrl}
          alt="Building locations map"
          className="w-full h-48 object-cover"
        />
        <div className="p-3 bg-gray-900/60">
          <div className="flex flex-wrap gap-2">
            {buildings.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => onBuildingClick?.(b)}
                className={`text-xs px-2 py-1 rounded-full transition-colors ${
                  b.id === selectedBuildingId
                    ? 'bg-brand-500/20 text-brand-400 border border-brand-500'
                    : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-500'
                }`}
              >
                {b.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Fallback: OpenStreetMap embed (no API key needed)
  const osmUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${center.lng - 0.02},${center.lat - 0.01},${center.lng + 0.02},${center.lat + 0.01}&layer=mapnik&marker=${center.lat},${center.lng}`;

  return (
    <div className="rounded-xl border border-gray-800 overflow-hidden">
      <iframe
        src={osmUrl}
        title="Building locations"
        className="w-full h-48 border-0"
        loading="lazy"
      />
      <div className="p-3 bg-gray-900/60">
        <p className="text-xs text-gray-500 mb-2">
          Set NEXT_PUBLIC_MAPBOX_TOKEN for enhanced maps with building markers.
        </p>
        <div className="flex flex-wrap gap-2">
          {buildings.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => onBuildingClick?.(b)}
              className={`text-xs px-2 py-1 rounded-full transition-colors ${
                b.id === selectedBuildingId
                  ? 'bg-brand-500/20 text-brand-400 border border-brand-500'
                  : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-500'
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
