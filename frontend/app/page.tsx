'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import ImageCapture from '@/components/ImageCapture';
import BuildingCard from '@/components/BuildingCard';
import FinancialPanel from '@/components/FinancialPanel';
import SkylineOverlay from '@/components/SkylineOverlay';
import BuildingMap from '@/components/BuildingMap';
import AuthPanel from '@/components/AuthPanel';
import { useAuth } from '@/lib/auth';
import type { DetectedBuilding, Building, BuildingFinancials } from '@/lib/types';

export default function HomePage() {
  const { isAuthenticated, authHeaders } = useAuth();

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [detectedBuildings, setDetectedBuildings] = useState<DetectedBuilding[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<DetectedBuilding | null>(null);
  const [buildingDetails, setBuildingDetails] = useState<Building | null>(null);
  const [financials, setFinancials] = useState<BuildingFinancials | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingFinancials, setIsLoadingFinancials] = useState(false);
  const [financialError, setFinancialError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [allBuildingDetails, setAllBuildingDetails] = useState<Building[]>([]);

  // Clean up object URL on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  // Track the latest financial fetch to prevent race conditions
  const latestFetchRef = useRef<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

  const handleImageSelected = async (file: File) => {
    setError(null);
    setDetectedBuildings([]);
    setSelectedBuilding(null);
    setFinancials(null);
    setAllBuildingDetails([]);
    setSearchQuery('');
    setIsAnalyzing(true);

    // Store preview URL for the overlay
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImagePreviewUrl(URL.createObjectURL(file));

    try {
      if (!isAuthenticated) {
        throw new Error('Please sign in to analyze skyline images');
      }

      const formData = new FormData();
      formData.append('image', file);

      const res = await fetch(`${apiUrl}/api/analyze-skyline`, {
        method: 'POST',
        headers: authHeaders(),
        body: formData,
      });

      if (res.status === 401) {
        throw new Error('Session expired — please sign in again');
      }

      if (!res.ok) {
        let errorMessage = 'Analysis failed';
        try {
          const text = await res.text();
          try {
            const body = JSON.parse(text);
            errorMessage = body.error ?? errorMessage;
          } catch {
            errorMessage = text || errorMessage;
          }
        } catch {
          // network-level failure; keep default message
        }
        throw new Error(errorMessage);
      }

      const data = await res.json();
      const detected: DetectedBuilding[] = data.detectedBuildings ?? [];
      setDetectedBuildings(detected);

      // Fetch building details for the map (optionalAuth, no token required)
      const detailPromises = detected.map((b) =>
        fetch(`${apiUrl}/api/buildings/${b.buildingId}`, {
          headers: authHeaders(),
        })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      );
      const details = (await Promise.all(detailPromises)).filter(Boolean) as Building[];
      setAllBuildingDetails(details);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleBuildingSelect = useCallback(async (building: DetectedBuilding) => {
    const fetchId = building.buildingId;
    latestFetchRef.current = fetchId;

    setSelectedBuilding(building);
    setBuildingDetails(null);
    setFinancials(null);
    setFinancialError(null);
    setIsLoadingFinancials(true);

    const headers = authHeaders();

    // Start both requests in parallel
    const financialsPromise = fetch(`${apiUrl}/api/buildings/${building.buildingId}/financials`, { headers });
    const detailsPromise = fetch(`${apiUrl}/api/buildings/${building.buildingId}`, { headers });

    try {
      // Await financials first so the primary panel can render ASAP
      const financialsRes = await financialsPromise;

      if (latestFetchRef.current !== fetchId) return;

      if (financialsRes.status === 401) {
        throw new Error('Please sign in to view financial data');
      }
      if (!financialsRes.ok) throw new Error('Failed to load financial data');
      const financialsData = await financialsRes.json();

      if (latestFetchRef.current !== fetchId) return;
      setFinancials(financialsData);

      // Handle details separately so slowness doesn't block financials
      try {
        const detailsRes = await detailsPromise;
        if (latestFetchRef.current !== fetchId) return;
        if (detailsRes.ok) {
          const detailsData = await detailsRes.json();
          setBuildingDetails(detailsData);
        }
      } catch {
        // Ignore details fetch errors; financials are already shown
      }
    } catch (err) {
      if (latestFetchRef.current !== fetchId) return;
      setFinancialError(err instanceof Error ? err.message : 'Failed to load financial data');
    } finally {
      if (latestFetchRef.current === fetchId) {
        setIsLoadingFinancials(false);
      }
    }
  }, [apiUrl, authHeaders]);

  // Filtered building list (used by both render and keyboard nav)
  const filteredBuildings = useMemo(
    () =>
      detectedBuildings.filter(
        (b) => !searchQuery || b.name.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [detectedBuildings, searchQuery],
  );

  // Keyboard navigation: ArrowUp/ArrowDown or j/k to move & select, Escape to deselect
  const buildingListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (filteredBuildings.length === 0) return;
      // Don't intercept when user is typing in the search input
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;

      const currentIdx = selectedBuilding
        ? filteredBuildings.findIndex((b) => b.buildingId === selectedBuilding.buildingId)
        : -1;

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        const next = Math.min(currentIdx + 1, filteredBuildings.length - 1);
        handleBuildingSelect(filteredBuildings[next]);
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        const prev = Math.max(currentIdx - 1, 0);
        handleBuildingSelect(filteredBuildings[prev]);
      } else if (e.key === 'Escape') {
        setSelectedBuilding(null);
        setFinancials(null);
        setBuildingDetails(null);
        setFinancialError(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredBuildings, selectedBuilding, handleBuildingSelect]);

  return (
    <main className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🏙️</span>
          <div>
            <h1 className="text-xl font-bold tracking-tight">CRE View</h1>
            <p className="text-xs text-gray-400">Skyline Financial Intelligence</p>
          </div>
        </div>
        <AuthPanel />
      </header>

      <div className="flex flex-1 flex-col lg:flex-row overflow-hidden">
        {/* Left panel — upload */}
        <section className="w-full lg:w-96 border-b lg:border-b-0 lg:border-r border-gray-800 p-6 flex flex-col gap-6">
          <div>
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
              Capture Skyline
            </h2>
            {!isAuthenticated && (
              <div className="rounded-lg bg-yellow-900/20 border border-yellow-800/50 p-3 text-xs text-yellow-300 mb-3">
                Sign in to analyze skylines and view financial data.
                <br />
                <span className="text-yellow-500">Dev account: dev@creview.local / dev123</span>
              </div>
            )}
            <ImageCapture onImageSelected={handleImageSelected} isLoading={isAnalyzing} />
          </div>

          {error && (
            <div className="rounded-lg bg-red-900/30 border border-red-800 p-4 text-sm text-red-300">
              {error}
            </div>
          )}

          {isAnalyzing && (
            <div className="flex items-center gap-3 text-sm text-gray-400">
              <span className="animate-spin">⏳</span>
              Analyzing skyline…
            </div>
          )}

          {imagePreviewUrl && detectedBuildings.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
                Analysis Result
              </h2>
              <SkylineOverlay
                imageSrc={imagePreviewUrl}
                buildings={detectedBuildings}
                selectedBuildingId={selectedBuilding?.buildingId}
                onBuildingClick={handleBuildingSelect}
              />
            </div>
          )}

          {detectedBuildings.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
                Detected Buildings ({detectedBuildings.length})
              </h2>
              {detectedBuildings.length > 3 && (
                <input
                  type="text"
                  placeholder="Filter buildings…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full mb-3 px-3 py-2 text-sm rounded-lg border border-gray-700 bg-gray-900/50 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-brand-500"
                />
              )}
              <div ref={buildingListRef} className="flex flex-col gap-3" aria-label="Detected buildings">
                {filteredBuildings.map((b) => (
                  <BuildingCard
                    key={b.buildingId}
                    building={b}
                    isSelected={selectedBuilding?.buildingId === b.buildingId}
                    onClick={() => handleBuildingSelect(b)}
                  />
                ))}
              </div>
              {filteredBuildings.length > 0 && (
                <p className="text-xs text-gray-600 mt-2">
                  Use arrow keys to navigate, Escape to deselect
                </p>
              )}
            </div>
          )}
        </section>

        {/* Right panel — financial detail */}
        <section className="flex-1 overflow-auto">
          {selectedBuilding && financials ? (
            <div>
              <FinancialPanel building={selectedBuilding} financials={financials} details={buildingDetails} />
              {allBuildingDetails.length > 0 && (
                <div className="px-6 pb-6 max-w-3xl mx-auto">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    Building Locations
                  </h3>
                  <BuildingMap
                    buildings={allBuildingDetails}
                    selectedBuildingId={buildingDetails?.id}
                  />
                </div>
              )}
            </div>
          ) : selectedBuilding && financialError ? (
            <div className="flex items-center justify-center h-full p-8">
              <div className="rounded-lg bg-red-900/30 border border-red-800 p-4 text-sm text-red-300 max-w-sm text-center">
                {financialError}
              </div>
            </div>
          ) : selectedBuilding && isLoadingFinancials ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              Loading financial data…
            </div>
          ) : detectedBuildings.length > 0 && allBuildingDetails.length > 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-6 p-8">
              <p className="text-gray-500 text-lg">Select a building to view financial data</p>
              <div className="w-full max-w-lg">
                <BuildingMap buildings={allBuildingDetails} />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-600 p-8">
              <span className="text-6xl">📸</span>
              <p className="text-center text-lg">
                Upload or capture a skyline photo to identify buildings and see their financial data.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
