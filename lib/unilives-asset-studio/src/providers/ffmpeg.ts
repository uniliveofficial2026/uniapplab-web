import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

export function resolveFfmpegBinary(): string | null {
  for (const candidate of [
    process.env.FFMPEG_BIN,
    'ffmpeg',
    '/opt/homebrew/bin/ffmpeg',
    '/usr/local/bin/ffmpeg',
  ]) {
    if (!candidate) continue;
    if (candidate.includes('/') && existsSync(candidate)) return candidate;
    const which = spawnSync('which', [candidate], { encoding: 'utf8' });
    if (which.status === 0 && which.stdout.trim()) return which.stdout.trim();
  }
  return null;
}

export function ffmpegDoctor(): { ok: boolean; path: string | null; version?: string } {
  const bin = resolveFfmpegBinary();
  if (!bin) return { ok: false, path: null };
  const ver = spawnSync(bin, ['-version'], { encoding: 'utf8' });
  const line = (ver.stdout || '').split('\n')[0]?.trim();
  return { ok: ver.status === 0, path: bin, version: line };
}

/** Local mux: image + audio → MP4 preview (no paid API). */
export function ffmpegMuxStillWithAudio(opts: {
  imagePath: string;
  audioPath: string;
  outMp4: string;
  durationSeconds?: number;
}): { ok: boolean; stderr: string } {
  const bin = resolveFfmpegBinary();
  if (!bin) return { ok: false, stderr: 'ffmpeg missing' };
  const dur = String(opts.durationSeconds ?? 4);
  const r = spawnSync(
    bin,
    [
      '-y',
      '-loop', '1',
      '-i', opts.imagePath,
      '-i', opts.audioPath,
      '-c:v', 'libx264',
      '-tune', 'stillimage',
      '-c:a', 'aac',
      '-shortest',
      '-t', dur,
      '-pix_fmt', 'yuv420p',
      opts.outMp4,
    ],
    { encoding: 'utf8' },
  );
  return { ok: r.status === 0, stderr: r.stderr || '' };
}
