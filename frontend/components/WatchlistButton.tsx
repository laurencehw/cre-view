'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';

interface WatchlistButtonProps {
  buildingId: string;
  size?: 'sm' | 'md';
}

export default function WatchlistButton({ buildingId, size = 'md' }: WatchlistButtonProps) {
  const { isAuthenticated, authHeaders } = useAuth();
  const [isWatchlisted, setIsWatchlisted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

  // Check if building is in watchlist
  useEffect(() => {
    if (!isAuthenticated) return;

    fetch(`${apiUrl}/api/watchlist`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : { data: [] })
      .then(data => {
        const ids = (data.data ?? []).map((w: { buildingId: string }) => w.buildingId);
        setIsWatchlisted(ids.includes(buildingId));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingId, isAuthenticated]);

  if (!isAuthenticated) return null;

  const toggle = async () => {
    setIsLoading(true);
    try {
      if (isWatchlisted) {
        await fetch(`${apiUrl}/api/watchlist/${buildingId}`, {
          method: 'DELETE',
          headers: authHeaders(),
        });
        setIsWatchlisted(false);
      } else {
        await fetch(`${apiUrl}/api/watchlist/${buildingId}`, {
          method: 'POST',
          headers: authHeaders(),
        });
        setIsWatchlisted(true);
      }
    } catch {
      // Silent fail
    } finally {
      setIsLoading(false);
    }
  };

  const sizeClasses = size === 'sm'
    ? 'w-7 h-7 text-sm'
    : 'w-9 h-9 text-lg';

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isLoading}
      title={isWatchlisted ? 'Remove from watchlist' : 'Add to watchlist'}
      className={`${sizeClasses} rounded-lg border transition-all flex items-center justify-center shrink-0 ${
        isWatchlisted
          ? 'border-yellow-600 bg-yellow-900/30 text-yellow-400 hover:bg-yellow-900/50'
          : 'border-gray-700 bg-gray-800/50 text-gray-500 hover:text-yellow-400 hover:border-yellow-700'
      } ${isLoading ? 'opacity-50' : ''}`}
    >
      {isWatchlisted ? '★' : '☆'}
    </button>
  );
}
