import { useEffect, useRef } from 'react';
import { Parser, Player } from 'svga';

type GiftSvgaPlayerProps = {
  url: string;
  className?: string;
  onEnded: () => void;
};

async function loadAndPlay(
  url: string,
  canvas: HTMLCanvasElement,
  disableWorker: boolean,
  onEnded: () => void,
): Promise<{ player: Player; parser: Parser }> {
  const parser = new Parser({
    isDisableWebWorker: disableWorker,
  });
  const svga = await parser.load(url);
  const player = new Player({
    container: canvas,
    loop: 1,
  });
  player.onEnd = onEnded;
  await player.mount(svga);
  player.start();
  return { player, parser };
}

/** TRTC basic gift player — transparent SVGA canvas overlay. */
export function GiftSvgaPlayer({ url, className, onEnded }: GiftSvgaPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    let cancelled = false;
    let player: Player | null = null;
    let parser: Parser | null = null;

    const finish = () => {
      if (!cancelled) onEndedRef.current();
    };

    void (async () => {
      try {
        ({ player, parser } = await loadAndPlay(url, canvas, false, finish));
      } catch {
        if (cancelled) return;
        try {
          player?.destroy();
          parser?.destroy();
          ({ player, parser } = await loadAndPlay(url, canvas, true, finish));
        } catch {
          finish();
        }
      }
    })();

    return () => {
      cancelled = true;
      try {
        player?.stop();
        player?.clear();
        player?.destroy();
      } catch {
        /* ignore teardown */
      }
      try {
        parser?.destroy();
      } catch {
        /* ignore teardown */
      }
    };
  }, [url]);

  return (
    <canvas
      ref={canvasRef}
      className={className ?? 'pointer-events-none h-full w-full object-contain'}
      style={{ width: '100%', height: '100%' }}
      aria-hidden
    />
  );
}
