import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  FolderOpen,
  Globe,
  Play,
  ChevronRight,
  Gamepad2,
  Sparkles,
} from 'lucide-react';
import { LOCAL_GAME_CATALOG } from '../../lib/localGames/catalog';
import { APP_DISPLAY_NAME } from '../../lib/appBrand';
import type { LocalGameRecord } from '../../lib/localGames/types';
import { LocalGamePlayer } from './LocalGamePlayer';

type GameHubScreenProps = {
  onOpenLocalGames: () => void;
  onOpenThirdParty: () => void;
};

function featuredRecord(): LocalGameRecord {
  const entry = LOCAL_GAME_CATALOG[0]!;
  return {
    id: entry.id,
    name: entry.cardName,
    status: 'Ready',
    playtime: '0m',
    image: entry.image,
    fileName: entry.zipFileName,
    sizeBytes: 0,
    playKind: 'web',
    entryPath: 'index.html',
    totalPlayMs: 0,
    importedAt: Date.now(),
    catalogId: entry.id,
    catalogZipRevision: entry.zipRevision,
    productionAppUrl: entry.productionAppUrl,
    embeddedAppUrl: entry.embeddedAppUrl,
  };
}

export function GameHubScreen({ onOpenLocalGames, onOpenThirdParty }: GameHubScreenProps) {
  const featured = LOCAL_GAME_CATALOG[0]!;
  const [playingFeatured, setPlayingFeatured] = useState<LocalGameRecord | null>(null);

  return (
    <div className="w-full min-h-0 flex-1 flex flex-col bg-background">
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="app-screen-scroll p-6 md:p-10 max-w-7xl mx-auto space-y-10 w-full min-w-0 app-content-gutter"
    >
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
          <Sparkles className="w-3.5 h-3.5" />
          {APP_DISPLAY_NAME}
        </div>
        <h1 className="text-4xl font-black text-foreground tracking-tighter">Game Hub</h1>
        <p className="text-xs text-muted-foreground font-semibold max-w-xl">
          Your center for local library games, third-party titles, and featured playable apps.
        </p>
      </div>

      {/* Featured production app */}
      <motion.div whileHover={{ scale: 1.01 }} className="relative">
        <div
          className={`relative h-64 md:h-72 rounded-3xl overflow-hidden text-white ${featured.image}`}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          <div className="relative h-full p-8 flex flex-col justify-end">
            <span className="absolute top-6 left-8 bg-black/35 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
              Featured
            </span>
            <h2 className="text-3xl font-black">{featured.cardName}</h2>
            <p className="text-white/80 font-semibold text-xs mt-1 max-w-lg">{featured.description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPlayingFeatured(featuredRecord())}
                className="inline-flex items-center justify-center gap-2 w-36 bg-white text-black font-black text-xs py-3 rounded-xl hover:bg-white/90 transition-all"
              >
                <Play className="w-3 h-3 fill-black" />
                Play Now
              </button>
              <button
                type="button"
                onClick={onOpenLocalGames}
                className="inline-flex items-center justify-center gap-2 px-4 bg-white/15 hover:bg-white/25 text-white font-black text-xs py-3 rounded-xl transition-all"
              >
                Open in Library
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Destinations */}
      <div className="space-y-4">
        <h3 className="text-xl font-black text-foreground">Browse</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={onOpenLocalGames}
            className="group text-left bg-card border border-border rounded-3xl p-6 hover:border-primary/40 transition-all shadow-sm flex items-start gap-4"
          >
            <div className="p-3 rounded-2xl bg-primary/10 text-primary shrink-0">
              <FolderOpen className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-black text-sm text-foreground">Local Games</h4>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
              </div>
              <p className="text-[11px] text-muted-foreground font-semibold mt-1 leading-relaxed">
                Import ZIP / HTML games, manage your library, and play installed titles.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={onOpenThirdParty}
            className="group text-left bg-card border border-border rounded-3xl p-6 hover:border-primary/40 transition-all shadow-sm flex items-start gap-4"
          >
            <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
              <Globe className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-black text-sm text-foreground">Third Party Games</h4>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
              </div>
              <p className="text-[11px] text-muted-foreground font-semibold mt-1 leading-relaxed">
                Discover hub titles and link Steam / Epic accounts.
              </p>
            </div>
          </button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-3xl p-6 flex items-center gap-4">
        <div className="p-3 rounded-2xl bg-secondary text-foreground shrink-0">
          <Gamepad2 className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h4 className="font-black text-sm">One place for play</h4>
          <p className="text-[11px] text-muted-foreground font-semibold mt-0.5">
            Game Hub is your entry point — Local Library and Third Party stay available as deep links.
          </p>
        </div>
      </div>

      {playingFeatured && (
        <LocalGamePlayer
          game={playingFeatured}
          onClose={() => setPlayingFeatured(null)}
          onSessionEnd={() => undefined}
        />
      )}
    </motion.div>
    </div>
  );
}
