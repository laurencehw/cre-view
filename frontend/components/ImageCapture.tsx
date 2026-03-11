'use client';

import { useRef, useState } from 'react';

interface ImageCaptureProps {
  onImageSelected: (file: File) => void;
  isLoading?: boolean;
}

export default function ImageCapture({ onImageSelected, isLoading = false }: ImageCaptureProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    onImageSelected(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0]);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    handleFile(e.dataTransfer.files?.[0]);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative flex flex-col items-center justify-center gap-2
          rounded-xl border-2 border-dashed p-8 cursor-pointer transition-colors
          ${isLoading
            ? 'border-gray-700 bg-gray-900/50 opacity-60 cursor-not-allowed'
            : 'border-gray-700 bg-gray-900/30 hover:border-brand-500 hover:bg-gray-900/50'
          }
        `}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Uploaded skyline"
            className="w-full max-h-48 object-cover rounded-lg"
          />
        ) : (
          <>
            <span className="text-3xl">🖼️</span>
            <p className="text-sm text-gray-400 text-center">
              Drop a skyline photo here, or click to browse
            </p>
            <p className="text-xs text-gray-600">JPEG, PNG or WebP · max 10 MB</p>
          </>
        )}

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-gray-950/70">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Hidden inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
        disabled={isLoading}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
        disabled={isLoading}
      />

      {/* Camera button (mobile) */}
      <button
        type="button"
        onClick={() => cameraInputRef.current?.click()}
        disabled={isLoading}
        className="
          flex items-center justify-center gap-2 rounded-lg
          bg-brand-600 hover:bg-brand-700 disabled:bg-gray-800 disabled:text-gray-500
          px-4 py-2.5 text-sm font-medium transition-colors
        "
      >
        📷 Take Photo
      </button>
    </div>
  );
}
