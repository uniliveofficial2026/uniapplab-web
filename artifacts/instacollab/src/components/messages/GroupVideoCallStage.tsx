import { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutGrid } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { RemoteCallVideo } from '../../lib/chat/chatCallKit';
import { CallVideoSurface } from './CallVideoSurface';

const LOCAL_FOCUS_ID = '__local__';

type GroupVideoCallStageProps = {
  remoteVideos: RemoteCallVideo[];
  localStream?: MediaStream | null;
  localLabel?: string;
  localTile?: React.ReactNode;
};

function gridClassForCount(count: number): string {
  if (count <= 1) return 'grid-cols-1';
  if (count <= 4) return 'grid-cols-2';
  return 'grid-cols-3';
}

type VideoTileProps = {
  id: string;
  name: string;
  stream: MediaStream;
  mirrored?: boolean;
  focused?: boolean;
  compact?: boolean;
  onSelect: (id: string) => void;
};

function VideoTile({
  id,
  name,
  stream,
  mirrored = false,
  focused = false,
  compact = false,
  onSelect,
}: VideoTileProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      className={`group relative min-h-0 overflow-hidden bg-zinc-900 text-left transition-[box-shadow,transform] active:scale-[0.98] ${
        compact
          ? `h-16 w-24 shrink-0 rounded-lg border-2 ${focused ? 'border-primary ring-2 ring-primary/40' : 'border-white/20'}`
          : `h-full w-full border-2 ${focused ? 'border-primary' : 'border-transparent hover:border-white/30'}`
      }`}
      aria-label={focused ? `${name} — full screen` : `View ${name} full screen`}
      aria-pressed={focused}
    >
      <CallVideoSurface
        stream={stream}
        mirrored={mirrored}
        className="h-full w-full object-cover"
        label={name}
      />
      <span
        className={`absolute bottom-1.5 left-1.5 rounded bg-black/55 font-semibold text-white ${
          compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px] sm:text-xs'
        }`}
      >
        {name}
      </span>
      {!compact ? (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-opacity group-hover:bg-black/20 group-hover:opacity-100">
          <span className="rounded-full bg-black/60 px-3 py-1 text-[11px] font-semibold text-white">
            Tap to focus
          </span>
        </span>
      ) : null}
    </button>
  );
}

export function GroupVideoCallStage({
  remoteVideos,
  localStream = null,
  localLabel = 'You',
  localTile,
}: GroupVideoCallStageProps) {
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const tiles = useMemo(() => {
    const remote = remoteVideos.map((entry) => ({
      id: entry.participantId,
      name: entry.participantName,
      stream: entry.stream,
      mirrored: false,
    }));
    if (localStream) {
      return [
        ...remote,
        { id: LOCAL_FOCUS_ID, name: localLabel, stream: localStream, mirrored: true },
      ];
    }
    return remote;
  }, [remoteVideos, localStream, localLabel]);

  const focusedTile = useMemo(
    () => tiles.find((tile) => tile.id === focusedId) ?? null,
    [tiles, focusedId],
  );

  useEffect(() => {
    if (focusedId && !tiles.some((tile) => tile.id === focusedId)) {
      setFocusedId(null);
    }
  }, [tiles, focusedId]);

  const handleSelect = useCallback((id: string) => {
    setFocusedId((prev) => (prev === id ? null : id));
  }, []);

  const showGrid = !focusedId || !focusedTile;
  const gridCount = remoteVideos.length;

  return (
    <div className="absolute inset-0 bg-black">
      <AnimatePresence mode="wait">
        {showGrid ? (
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className={`absolute inset-0 grid gap-0.5 p-0.5 ${gridClassForCount(gridCount)}`}
          >
            {remoteVideos.map((entry) => (
              <VideoTile
                key={entry.participantId}
                id={entry.participantId}
                name={entry.participantName}
                stream={entry.stream}
                onSelect={handleSelect}
              />
            ))}
          </motion.div>
        ) : (
          <motion.div
            key={`focus-${focusedId}`}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 flex flex-col"
          >
            <div className="relative min-h-0 flex-1">
              <CallVideoSurface
                stream={focusedTile.stream}
                mirrored={focusedTile.mirrored}
                className="absolute inset-0 h-full w-full object-cover"
                label={focusedTile.name}
              />
              <div className="absolute left-0 right-0 top-[calc(var(--app-safe-top)+3.5rem)] z-10 flex items-center justify-between gap-2 px-4">
                <span className="truncate rounded-full bg-black/55 px-3 py-1.5 text-sm font-semibold text-white backdrop-blur-md">
                  {focusedTile.name}
                </span>
                <button
                  type="button"
                  onClick={() => setFocusedId(null)}
                  className="flex shrink-0 items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md hover:bg-black/70 transition-colors"
                  aria-label="Show all participants"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Grid
                </button>
              </div>
            </div>

            {tiles.length > 1 ? (
              <div className="shrink-0 border-t border-white/10 bg-black/80 px-3 py-2.5 backdrop-blur-md">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-white/45">
                  Tap to switch
                </p>
                <div className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {tiles.map((tile) => (
                    <VideoTile
                      key={tile.id}
                      id={tile.id}
                      name={tile.name}
                      stream={tile.stream}
                      mirrored={tile.mirrored}
                      focused={tile.id === focusedId}
                      compact
                      onSelect={handleSelect}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>

      {showGrid && localTile ? localTile : null}
      {!showGrid && focusedId !== LOCAL_FOCUS_ID && localTile ? localTile : null}
    </div>
  );
}
