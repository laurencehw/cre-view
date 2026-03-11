// Pluggable computer vision service adapter.
// Swap the active provider via the VISION_PROVIDER environment variable.

export interface DetectedLabel {
  name: string;
  confidence: number;
  boundingBox?: { x: number; y: number; width: number; height: number };
}

export interface VisionResult {
  labels: DetectedLabel[];
  landmarks: DetectedLabel[];
}

// ─── Provider interface ───────────────────────────────────────────────────────
interface VisionProvider {
  analyze(imageBuffer: Buffer, mimeType: string): Promise<VisionResult>;
}

// ─── Mock provider (default for MVP) ─────────────────────────────────────────
class MockVisionProvider implements VisionProvider {
  async analyze(_imageBuffer: Buffer, _mimeType: string): Promise<VisionResult> {
    return {
      labels: [
        { name: 'skyscraper', confidence: 0.98 },
        { name: 'building', confidence: 0.97 },
        { name: 'urban', confidence: 0.92 },
      ],
      landmarks: [
        { name: 'Empire State Building', confidence: 0.95 },
        { name: 'One World Trade Center', confidence: 0.87 },
      ],
    };
  }
}

// ─── Azure provider stub ──────────────────────────────────────────────────────
class AzureVisionProvider implements VisionProvider {
  constructor(
    private readonly endpoint: string,
    private readonly apiKey: string,
  ) {}

  async analyze(_imageBuffer: Buffer, _mimeType: string): Promise<VisionResult> {
    // TODO: Implement using @azure/cognitiveservices-computervision
    // const client = new ComputerVisionClient(
    //   new ApiKeyCredentials({ inHeader: { 'Ocp-Apim-Subscription-Key': this.apiKey } }),
    //   this.endpoint,
    // );
    throw new Error('AzureVisionProvider not yet implemented');
  }
}

// ─── Google Cloud Vision provider stub ───────────────────────────────────────
class GcpVisionProvider implements VisionProvider {
  async analyze(_imageBuffer: Buffer, _mimeType: string): Promise<VisionResult> {
    // TODO: Implement using @google-cloud/vision
    throw new Error('GcpVisionProvider not yet implemented');
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────
export class VisionProviderNotConfiguredError extends Error {
  constructor(provider: string) {
    super(`Vision provider "${provider}" is not yet implemented. Set VISION_PROVIDER=mock or implement the provider.`);
    this.name = 'VisionProviderNotConfiguredError';
  }
}

export function createVisionService(): VisionProvider {
  const provider = process.env.VISION_PROVIDER ?? 'mock';

  switch (provider) {
    case 'azure': {
      const endpoint = process.env.AZURE_VISION_ENDPOINT;
      const key = process.env.AZURE_VISION_KEY;
      if (!endpoint || !key) {
        throw new VisionProviderNotConfiguredError('azure (missing AZURE_VISION_ENDPOINT or AZURE_VISION_KEY)');
      }
      return new AzureVisionProvider(endpoint, key);
    }
    case 'gcp':
      return new GcpVisionProvider();
    case 'mock':
      return new MockVisionProvider();
    default:
      throw new VisionProviderNotConfiguredError(provider);
  }
}
