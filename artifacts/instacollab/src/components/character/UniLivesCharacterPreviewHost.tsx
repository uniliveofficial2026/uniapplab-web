/**
 * UniLive’s character runtime preview — loads optimized public GLB.
 * Open with: /?unilivesCharacterPreview=1
 */
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, OrbitControls, useGLTF, useAnimations } from '@react-three/drei';
import type { Group } from 'three';
import { APP_DISPLAY_NAME } from '../../lib/appBrand';
import {
  resolveCharacterPreviewAudioUrl,
  resolveCharacterPreviewModelUrl,
} from '../../lib/unilives-assets/characterResolve';

export const UNILIVES_CHARACTER_GLB = resolveCharacterPreviewModelUrl().url;

function CharacterModel({
  url,
  playIdle,
}: {
  url: string;
  playIdle: boolean;
}) {
  const group = useRef<Group>(null);
  const { scene, animations } = useGLTF(url);
  const { actions, names } = useAnimations(animations, group);

  useEffect(() => {
    if (!playIdle) return;
    const preferred =
      names.find((n) => /idle/i.test(n)) ||
      names[0];
    if (!preferred) return;
    const action = actions[preferred];
    action?.reset().fadeIn(0.25).play();
    return () => {
      action?.fadeOut(0.2);
    };
  }, [actions, names, playIdle]);

  useFrame((_, delta) => {
    // Keep a tiny fallback spin if no clip is present.
    if (names.length === 0 && group.current) {
      group.current.rotation.y += delta * 0.25;
    }
  });

  const cloned = useMemo(() => scene.clone(true), [scene]);

  return (
    <group ref={group} dispose={null} position={[0, -0.9, 0]}>
      <primitive object={cloned} />
    </group>
  );
}

export function UniLivesCharacterPreviewHost() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(UNILIVES_CHARACTER_GLB, { method: 'HEAD' });
        if (!res.ok) throw new Error(`GLB missing (${res.status})`);
        if (!cancelled) setStatus('ready');
      } catch (e) {
        if (!cancelled) {
          setStatus('error');
          setError(e instanceof Error ? e.message : 'Failed to load character');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const audioSrc = resolveCharacterPreviewAudioUrl();
    if (!audioSrc) return;
    const audio = new Audio(audioSrc);
    audio.loop = true;
    audio.volume = 0.35;
    audioRef.current = audio;
    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (muted) {
      audio.pause();
      return;
    }
    void audio.play().catch(() => {
      /* autoplay may be blocked until user gesture */
    });
  }, [muted]);

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-[#0b1220] text-slate-100">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-sky-300/80">
            {APP_DISPLAY_NAME}
          </p>
          <h1 className="text-sm font-semibold">Character preview</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg bg-white/10 px-3 py-1.5 text-xs hover:bg-white/15"
            onClick={() => setMuted((m) => !m)}
          >
            {muted ? 'Unmute ambient' : 'Mute ambient'}
          </button>
          <a
            href="/"
            className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-400"
          >
            Exit
          </a>
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        {status === 'error' ? (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-rose-200">
            {error || 'Character asset unavailable'}
          </div>
        ) : (
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                Loading character…
              </div>
            }
          >
            {status === 'ready' ? (
              <Canvas camera={{ position: [1.8, 1.2, 2.4], fov: 40 }}>
                <color attach="background" args={['#0b1220']} />
                <ambientLight intensity={0.55} />
                <directionalLight position={[3, 5, 2]} intensity={1.15} />
                <Environment preset="city" />
                <CharacterModel url={UNILIVES_CHARACTER_GLB} playIdle />
                <OrbitControls
                  enablePan={false}
                  minDistance={1.2}
                  maxDistance={5}
                  target={[0, 0.7, 0]}
                  autoRotate
                  autoRotateSpeed={0.6}
                />
                <gridHelper args={[4, 16, '#334466', '#1a2438']} position={[0, -0.9, 0]} />
              </Canvas>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                Checking character asset…
              </div>
            )}
          </Suspense>
        )}
      </div>

      <footer className="border-t border-white/10 px-4 py-2 text-[11px] text-slate-400">
        Runtime GLB: {UNILIVES_CHARACTER_GLB} · masters stay in assets-source/
      </footer>
    </div>
  );
}

useGLTF.preload(UNILIVES_CHARACTER_GLB);
