'use client';

import { useEffect, useRef, useState } from 'react';
import type { Building } from '@/lib/types';

interface InteractiveMapProps {
  buildings: Building[];
  selectedBuildingId?: string | null;
  onBuildingClick?: (building: Building) => void;
  height?: string;
}

export default function InteractiveMap({
  buildings,
  selectedBuildingId,
  onBuildingClick,
  height = '400px',
}: InteractiveMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const [ready, setReady] = useState(false);

  // Load Leaflet and initialize map
  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;

    async function init() {
      // Dynamic import avoids SSR/static-export issues
      const L = await import('leaflet');
      // @ts-ignore — CSS import handled by bundler
      await import('leaflet/dist/leaflet.css');

      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: true,
      }).setView([40.7484, -73.9856], 12);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>, &copy; <a href="https://carto.com/">CARTO</a>',
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;
      setReady(true);
    }

    init();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update markers when buildings or selection change
  useEffect(() => {
    if (!ready || !mapRef.current) return;

    const L = require('leaflet') as typeof import('leaflet');
    const map = mapRef.current;

    // Clear existing markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    if (buildings.length === 0) return;

    const bounds: L.LatLngTuple[] = [];

    buildings.forEach(b => {
      if (!b.latitude || !b.longitude) return;

      const isSelected = b.id === selectedBuildingId;
      const color = isSelected ? '#3b82f6' : '#10b981';
      const size = isSelected ? 14 : 9;

      const icon = L.divIcon({
        className: '',
        html: `<div style="width:${size}px;height:${size}px;background:${color};border-radius:50%;border:2px solid ${isSelected ? '#fff' : '#1f2937'};box-shadow:0 0 8px ${color}80;cursor:pointer;"></div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const marker = L.marker([b.latitude, b.longitude], { icon })
        .addTo(map)
        .bindPopup(
          `<div style="font-family:system-ui;"><strong style="font-size:13px;">${b.name}</strong><br/><span style="color:#9ca3af;font-size:11px;">${b.address}</span>${b.floors > 0 ? `<br/><span style="color:#6b7280;font-size:11px;">${b.floors} floors · ${b.primaryUse}</span>` : ''}</div>`,
          { className: 'dark-popup' },
        );

      if (onBuildingClick) {
        marker.on('click', () => onBuildingClick(b));
      }

      markersRef.current.push(marker);
      bounds.push([b.latitude, b.longitude]);
    });

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, buildings, selectedBuildingId]);

  return (
    <>
      <style jsx global>{`
        .dark-popup .leaflet-popup-content-wrapper {
          background: #1f2937;
          color: #f3f4f6;
          border-radius: 12px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.5);
        }
        .dark-popup .leaflet-popup-tip { background: #1f2937; }
        .dark-popup .leaflet-popup-close-button { color: #9ca3af; }
      `}</style>
      <div
        ref={containerRef}
        className="rounded-xl border border-gray-800 overflow-hidden"
        style={{ height, width: '100%' }}
      />
    </>
  );
}
