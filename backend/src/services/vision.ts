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
  city?: string;
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

// ─── OpenAI Vision provider (GPT-4o) ─────────────────────────────────────────
class OpenAIVisionProvider implements VisionProvider {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async analyze(imageBuffer: Buffer, mimeType: string): Promise<VisionResult> {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey: this.apiKey });

    const base64Image = imageBuffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64Image}`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are a building identification AI. Analyze the skyline image and return a JSON object with this exact structure:
{
  "city": "string (the city shown in the photo, e.g. 'New York', 'Chicago', 'Los Angeles', 'San Francisco')",
  "labels": [{ "name": "string", "confidence": 0.0-1.0, "boundingBox": { "x": number, "y": number, "width": number, "height": number } }],
  "landmarks": [{ "name": "string", "confidence": 0.0-1.0, "boundingBox": { "x": number, "y": number, "width": number, "height": number } }]
}
city: identify which city the skyline belongs to.
labels: general scene labels (e.g. "skyscraper", "urban", "building").
landmarks: specific named buildings you can identify. Include bounding box coordinates in pixel space relative to the image dimensions.
Only include buildings you can identify with reasonable confidence.`,
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Identify the buildings in this skyline photo.' },
            { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
          ],
        },
      ],
      max_tokens: 1024,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { labels: [], landmarks: [] };
    }

    const parsed = JSON.parse(content) as VisionResult;
    return {
      city: parsed.city ?? undefined,
      labels: Array.isArray(parsed.labels) ? parsed.labels : [],
      landmarks: Array.isArray(parsed.landmarks) ? parsed.landmarks : [],
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
    case 'openai': {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new VisionProviderNotConfiguredError('openai (missing OPENAI_API_KEY)');
      }
      return new OpenAIVisionProvider(apiKey);
    }
    case 'mock':
      return new MockVisionProvider();
    default:
      throw new VisionProviderNotConfiguredError(provider);
  }
}
