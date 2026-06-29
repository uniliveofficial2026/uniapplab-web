import React from 'react';
import { Mic, Upload, Cloud, CloudOff, Trash2, Play } from 'lucide-react';
import { listKaraokeCoverRecordings } from '../../lib/karaokeRecordings';
import type { KaraokeUploadedSongMeta } from '../../lib/karaokeUploads';
import type { KaraokeLibrarySong } from './karaokeTypes';

type KaraokeMyUploadsPanelProps = {
  songs: KaraokeLibrarySong[];
  metas?: KaraokeUploadedSongMeta[];
  emptyMessage?: string;
  onListen?: (song: KaraokeLibrarySong) => void;
  onSing: (song: KaraokeLibrarySong) => void;
  onDelete?: (songId: string) => void;
  onUploadClick?: () => void;
};

export function KaraokeMyUploadsPanel({
  songs,
  metas = [],
  emptyMessage = 'No backing tracks uploaded yet. Upload a song to sing over — your vocal recordings will appear under Covers.',
  onListen,
  onSing,
  onDelete,
  onUploadClick,
}: KaraokeMyUploadsPanelProps) {
  const metaById = new Map(metas.map((meta) => [meta.id, meta]));

  if (songs.length === 0) {
    return (
      <div className="text-center py-10 px-4 border-2 border-dashed border-border rounded-2xl">
        <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground font-medium mb-4">{emptyMessage}</p>
        {onUploadClick && (
          <button
            type="button"
            onClick={onUploadClick}
            className="px-5 py-2.5 bg-primary text-primary-foreground font-bold rounded-full text-sm hover:bg-primary/90 transition"
          >
            Upload Song
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {songs.map((song) => {
        const meta = metaById.get(song.id);
        const cloudSynced = Boolean(meta?.cloudSynced);
        const coverCount = listKaraokeCoverRecordings(song.id).length;
        return (
          <div
            key={song.id}
            className="flex items-start gap-3 p-3 bg-card border border-primary/30 hover:border-primary/50 hover:shadow-md rounded-2xl transition-all group"
          >
            <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 group-hover:scale-105 transition-transform">
              <img
                src={song.img || `https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&auto=format&fit=crop&q=60&seed=${song.id}`}
                className="w-full h-full object-cover"
                alt={song.title}
              />
              <div className="absolute top-0 left-0 bg-primary text-primary-foreground text-[8px] font-bold px-1.5 py-0.5 rounded-br-lg uppercase">
                Upload
              </div>
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-2">
              <div className="min-w-0">
                <h4 className="font-bold text-sm truncate group-hover:text-primary transition-colors">{song.title}</h4>
                <p className="text-xs text-muted-foreground truncate mb-1">{song.artist}</p>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium flex-wrap">
                  <span className="text-primary/80 uppercase font-black">{song.type || 'solo'}</span>
                  {song.category && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-border" />
                      <span>{song.category}</span>
                    </>
                  )}
                  <span className="w-1 h-1 rounded-full bg-border" />
                  <span className={`inline-flex items-center gap-0.5 ${cloudSynced ? 'text-emerald-500' : 'text-amber-500'}`}>
                    {cloudSynced ? <Cloud className="w-3 h-3" /> : <CloudOff className="w-3 h-3" />}
                    {cloudSynced ? 'Cloud' : 'Local'}
                  </span>
                  <span className="w-1 h-1 rounded-full bg-border" />
                  <span>{coverCount} cover{coverCount === 1 ? '' : 's'}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {onListen && (
                  <button
                    type="button"
                    onClick={() => onListen(song)}
                    className="px-3 py-1.5 rounded-full bg-secondary hover:bg-secondary/80 text-foreground flex items-center gap-1.5 transition-all shadow-sm text-xs font-bold"
                    title="Listen & view lyrics"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Listen
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onSing(song)}
                  className="px-3 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground flex items-center gap-1.5 transition-all shadow-sm text-xs font-bold"
                  title="Sing & Record"
                >
                  <Mic className="w-3.5 h-3.5" />
                  Sing
                </button>
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(song.id)}
                    className="p-1.5 rounded-full hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition"
                    title="Delete upload"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
