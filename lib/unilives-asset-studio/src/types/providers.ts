export type ProviderName =
  | 'openai'
  | 'meshy'
  | 'runway'
  | 'kling'
  | 'elevenlabs'
  | 'blender'
  | 'ffmpeg';

export type ProviderConfigState = 'configured' | 'missing' | 'empty' | 'local-tool';

export interface ProviderStatusRow {
  provider: ProviderName;
  state: ProviderConfigState;
  detail: string;
}
