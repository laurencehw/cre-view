'use client';

import { useRef, useEffect, useState } from 'react';
import type { DetectedBuilding } from '@/lib/types';

interface SkylineOverlayProps {
  imageSrc: string;
  buildings: DetectedBuilding[];
  selectedBuildingId?: string | null;
  onBuildingClick?: (building: DetectedBuilding) => void;
}

export default function SkylineOverlay({
  imageSrc,
  buildings,
  selectedBuildingId,
  onBuildingClick,
}: SkylineOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [imgSize, setImgSize] = useState<{ width: number; height: number } | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const img = entry.target.querySelector('img');
        if (img) {
          setImgSize({ width: img.clientWidth, height: img.clientHeight });
        }
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    setImgSize({ width: img.clientWidth, height: img.clientHeight });
  };

  // Scale bounding boxes from the coordinate space used by the API to the displayed image size
  const scaleX = imgSize && naturalSize ? imgSize.width / naturalSize.width : 1;
  const scaleY = imgSize && naturalSize ? imgSize.height / naturalSize.height : 1;

  return (
    <div ref={containerRef} className="relative inline-block w-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageSrc}
        alt="Analyzed skyline"
        className="w-full rounded-lg"
        onLoad={handleImageLoad}
      />

      {imgSize &&
        buildings.map((b) => {
          if (!b.boundingBox) return null;
          const { x, y, width, height } = b.boundingBox;
          const isSelected = selectedBuildingId === b.buildingId;

          return (
            <button
              key={b.buildingId}
              type="button"
              onClick={() => onBuildingClick?.(b)}
              className={`absolute border-2 rounded transition-colors cursor-pointer ${
                isSelected
                  ? 'border-brand-400 bg-brand-500/20'
                  : 'border-blue-400/60 bg-blue-500/10 hover:border-blue-300 hover:bg-blue-500/20'
              }`}
              style={{
                left: x * scaleX,
                top: y * scaleY,
                width: width * scaleX,
                height: height * scaleY,
              }}
              title={`${b.name} (${Math.round(b.confidence * 100)}%)`}
            >
              <span
                className={`absolute -top-6 left-0 text-xs px-1.5 py-0.5 rounded whitespace-nowrap ${
                  isSelected
                    ? 'bg-brand-500 text-white'
                    : 'bg-gray-900/90 text-gray-200'
                }`}
              >
                {b.name}
              </span>
            </button>
          );
        })}
    </div>
  );
}
