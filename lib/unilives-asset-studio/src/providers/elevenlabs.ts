import { envGet } from '../config/env.js';

export function elevenConfigured(): boolean {
  return Boolean(envGet('ELEVENLABS_API_KEY'));
}

/** Paid TTS — only after budgetGate allows. */
export async function elevenTextToSpeech(opts: {
  text: string;
  voiceId?: string;
  modelId?: string;
}): Promise<ArrayBuffer> {
  const key = envGet('ELEVENLABS_API_KEY');
  if (!key) throw new Error('ELEVENLABS_API_KEY is missing');
  const voiceId = opts.voiceId || 'cgSgspJ2msm6clMCkdW9';
  const modelId = opts.modelId || 'eleven_multilingual_v2';
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': key,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text: opts.text,
      model_id: modelId,
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs TTS failed with status ${res.status}`);
  return res.arrayBuffer();
}
