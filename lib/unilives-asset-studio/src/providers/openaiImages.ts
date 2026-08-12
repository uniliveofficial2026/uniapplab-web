import OpenAI from 'openai';
import { envGet, getSafetyConfig } from '../config/env.js';

export interface OpenAIImageGenerateInput {
  prompt: string;
  size?: '1024x1024' | '1024x1536' | '1536x1024' | 'auto';
  quality?: 'low' | 'medium' | 'high' | 'auto';
  /** When true, request transparent background if model supports it. */
  transparent?: boolean;
}

export interface OpenAIImageEditInput {
  prompt: string;
  /** Absolute local paths to approved reference images (never logged as secrets). */
  referenceImagePaths: string[];
  maskPath?: string;
  size?: '1024x1024' | '1024x1536' | '1536x1024' | 'auto';
}

export function createOpenAIClient(): OpenAI {
  const key = envGet('OPENAI_API_KEY');
  if (!key) throw new Error('OPENAI_API_KEY is missing');
  return new OpenAI({ apiKey: key });
}

/** Paid generate — must only be called after budgetGate allows a paid call. */
export async function openaiGenerateImage(input: OpenAIImageGenerateInput) {
  const client = createOpenAIClient();
  const model = getSafetyConfig().openaiImageModel;
  return client.images.generate({
    model,
    prompt: input.prompt,
    size: input.size ?? '1024x1024',
    quality: input.quality ?? 'high',
    ...(input.transparent ? { background: 'transparent' as const } : {}),
  });
}

/** Paid edit — preferred over full regenerate when reference exists. */
export async function openaiEditImage(input: OpenAIImageEditInput) {
  const { readFileSync } = await import('node:fs');
  const { toFile } = await import('openai');
  const client = createOpenAIClient();
  const model = getSafetyConfig().openaiImageModel;
  const primary = input.referenceImagePaths[0];
  if (!primary) throw new Error('openaiEditImage requires at least one reference image path');
  const image = await toFile(readFileSync(primary), 'reference.png', { type: 'image/png' });
  const mask = input.maskPath
    ? await toFile(readFileSync(input.maskPath), 'mask.png', { type: 'image/png' })
    : undefined;
  return client.images.edit({
    model,
    image,
    prompt: input.prompt,
    ...(mask ? { mask } : {}),
    size: input.size ?? '1024x1024',
  });
}
