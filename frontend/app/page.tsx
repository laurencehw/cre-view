'use client';

import { useState } from 'react';
import ImageCapture from '@/components/ImageCapture';
import BuildingCard from '@/components/BuildingCard';
import FinancialPanel from '@/components/FinancialPanel';
import type { DetectedBuilding, BuildingFinancials } from '@/lib/types';

export default function HomePage() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [detectedBuildings, setDetectedBuildings] = useState<DetectedBuilding[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<DetectedBuilding | null>(null);
  const [financials, setFinancials] = useState<BuildingFinancials | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingFinancials, setIsLoadingFinancials] = useState(false);
  const [financialError, setFinancialError] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

  const handleImageSelected = async (file: File) => {
    setError(null);
    setDetectedBuildings([]);
    setSelectedBuilding(null);
    setFinancials(null);
    setIsAnalyzing(true);

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
      setDetectedBuildings(data.detectedBuildings ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleBuildingSelect = async (building: DetectedBuilding) => {
    setSelectedBuilding(building);
    setFinancials(null);
    setFinancialError(null);
    setIsLoadingFinancials(true);

    try {
      const res = await fetch(`${apiUrl}/api/buildings/${building.buildingId}/financials`);
      if (!res.ok) throw new Error('Failed to load financial data');
      const data = await res.json();
      setFinancials(data);
    } catch (err) {
      setFinancialError(err instanceof Error ? err.message : 'Failed to load financial data');
    } finally {
      setIsLoadingFinancials(false);
    }
  };

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

          {detectedBuildings.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
                Detected Buildings ({detectedBuildings.length})
              </h2>
              <div className="flex flex-col gap-3">
                {detectedBuildings.map((b) => (
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
            <FinancialPanel building={selectedBuilding} financials={financials} />
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
