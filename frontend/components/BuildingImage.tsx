'use client';

import { useState } from 'react';
import type { Building } from '@/lib/types';

interface BuildingImageProps {
  building: Building;
  className?: string;
  height?: string;
}

export default function BuildingImage({ building, className = '', height = '160px' }: BuildingImageProps) {
  const [error, setError] = useState(false);

  const streetViewKey = process.env.NEXT_PUBLIC_GOOGLE_STREET_VIEW_KEY;

  // Priority: explicit image_url > Street View > gradient placeholder
  const imageUrl = building.imageUrl
    ?? (streetViewKey && building.latitude && building.longitude
      ? `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${building.latitude},${building.longitude}&fov=90&heading=235&pitch=10&key=${streetViewKey}`
      : null);

  if (!imageUrl || error) {
    // Gradient placeholder with building initials
    const initials = building.name
      .split(/[\s-]+/)
      .slice(0, 2)
      .map(w => w[0])
      .join('')
      .toUpperCase();

    // Deterministic color from building name
    const hash = building.name.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
    const hue = Math.abs(hash) % 360;

    return (
      <div
        className={`flex items-center justify-center ${className}`}
        style={{
          height,
          background: `linear-gradient(135deg, hsl(${hue}, 40%, 15%) 0%, hsl(${(hue + 60) % 360}, 30%, 10%) 100%)`,
        }}
      >
        <span className="text-2xl font-bold text-white/20">{initials}</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl}
      alt={`${building.name} exterior`}
      className={`object-cover ${className}`}
      style={{ height }}
      onError={() => setError(true)}
      loading="lazy"
    />
  );
}
