'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import ImageCapture from '@/components/ImageCapture';
import BuildingCard from '@/components/BuildingCard';
import FinancialPanel from '@/components/FinancialPanel';
import SkylineOverlay from '@/components/SkylineOverlay';
import BuildingMap from '@/components/BuildingMap';
import type { DetectedBuilding, Building, BuildingFinancials } from '@/lib/types';

export default function HomePage() {
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
      const formData = new FormData();
      formData.append('image', file);

      const res = await fetch(`${apiUrl}/api/analyze-skyline`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        let errorMessage = 'Analysis failed';
        try {
          const body = await res.json();
          errorMessage = body.error ?? errorMessage;
        } catch {
          const text = await res.text().catch(() => '');
          errorMessage = text || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = await res.json();
      const detected: DetectedBuilding[] = data.detectedBuildings ?? [];
      setDetectedBuildings(detected);

      // Fetch building details for the map
      const detailPromises = detected.map((b) =>
        fetch(`${apiUrl}/api/buildings/${b.buildingId}`)
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

    // Start both requests in parallel
    const financialsPromise = fetch(`${apiUrl}/api/buildings/${building.buildingId}/financials`);
    const detailsPromise = fetch(`${apiUrl}/api/buildings/${building.buildingId}`);

    try {
      // Await financials first so the primary panel can render ASAP
      const financialsRes = await financialsPromise;

      if (latestFetchRef.current !== fetchId) return;

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
  }, [apiUrl]);

  return (
    <main className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center gap-3">
        <span className="text-2xl">🏙️</span>
        <div>
          <h1 className="text-xl font-bold tracking-tight">CRE View</h1>
          <p className="text-xs text-gray-400">Skyline Financial Intelligence</p>
        </div>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row overflow-hidden">
        {/* Left panel — upload */}
        <section className="w-full lg:w-96 border-b lg:border-b-0 lg:border-r border-gray-800 p-6 flex flex-col gap-6">
          <div>
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
              Capture Skyline
            </h2>
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
              <div className="flex flex-col gap-3">
                {detectedBuildings
                  .filter((b) =>
                    !searchQuery || b.name.toLowerCase().includes(searchQuery.toLowerCase()),
                  )
                  .map((b) => (
                    <BuildingCard
                      key={b.buildingId}
                      building={b}
                      isSelected={selectedBuilding?.buildingId === b.buildingId}
                      onClick={() => handleBuildingSelect(b)}
                    />
                  ))}
              </div>
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
