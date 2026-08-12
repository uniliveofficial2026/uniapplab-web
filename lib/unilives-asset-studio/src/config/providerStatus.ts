import { existsSync } from 'node:fs';
import { envGet, loadEnvLocal } from './env.js';
import type { ProviderStatusRow } from '../types/providers.js';

function keyState(name: string): 'configured' | 'missing' | 'empty' {
  loadEnvLocal();
  if (!(name in process.env) && !envGet(name)) {
    // distinguish missing vs empty from file: envGet empty either way
  }
  const v = envGet(name);
  if (!v) {
    // If key exists as empty string in env, treat as empty
    loadEnvLocal();
    const raw = process.env[name];
    if (raw === '') return 'empty';
    return 'missing';
  }
  return 'configured';
}

function which(bin: string): boolean {
  const path = process.env.PATH || '';
  for (const dir of path.split(':')) {
    if (dir && existsSync(`${dir}/${bin}`)) return true;
  }
  return existsSync(`/usr/local/bin/${bin}`) || existsSync(`/opt/homebrew/bin/${bin}`);
}

export function getProviderStatuses(): ProviderStatusRow[] {
  loadEnvLocal();
  const openai = keyState('OPENAI_API_KEY');
  const meshy = keyState('MESHY_API_KEY');
  const runway = keyState('RUNWAY_API_KEY');
  const klingApi = keyState('KLING_API_KEY');
  const klingAccess = keyState('KLING_ACCESS_KEY');
  const klingSecret = keyState('KLING_SECRET_KEY');
  const eleven = keyState('ELEVENLABS_API_KEY');

  const klingConfigured =
    klingApi === 'configured' ||
    (klingAccess === 'configured' && klingSecret === 'configured');

  return [
    {
      provider: 'openai',
      state: openai,
      detail: openai === 'configured' ? 'OPENAI_API_KEY present' : 'OPENAI_API_KEY missing',
    },
    {
      provider: 'meshy',
      state: meshy,
      detail: meshy === 'configured' ? 'MESHY_API_KEY present' : 'MESHY_API_KEY missing',
    },
    {
      provider: 'runway',
      state: runway,
      detail: runway === 'configured' ? 'RUNWAY_API_KEY present' : 'RUNWAY_API_KEY missing',
    },
    {
      provider: 'kling',
      state: klingConfigured ? 'configured' : klingApi === 'empty' && klingAccess === 'empty' ? 'empty' : 'missing',
      detail: klingConfigured
        ? 'KLING_API_KEY or ACCESS/SECRET pair present'
        : 'KLING credentials missing',
    },
    {
      provider: 'elevenlabs',
      state: eleven,
      detail: eleven === 'configured' ? 'ELEVENLABS_API_KEY present' : 'ELEVENLABS_API_KEY missing',
    },
    {
      provider: 'blender',
      state: which('blender') ? 'local-tool' : 'missing',
      detail: which('blender') ? 'blender binary found on PATH' : 'blender not found',
    },
    {
      provider: 'ffmpeg',
      state: which('ffmpeg') ? 'local-tool' : 'missing',
      detail: which('ffmpeg') ? 'ffmpeg binary found on PATH' : 'ffmpeg not found',
    },
  ];
}

export function printProviderStatuses(): void {
  for (const row of getProviderStatuses()) {
    console.log(`${row.provider}: ${row.state} (${row.detail})`);
  }
}
