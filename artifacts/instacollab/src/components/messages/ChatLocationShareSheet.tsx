import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, MapPin, Navigation, RefreshCw, Search, Send, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { ChatMessageLocation } from '../../types';
import {
  buildStaticMapPreviewUrl,
  formatCoordinates,
  geolocationErrorMessage,
} from './messages/chatLocationUtils';
import {
  fetchApproximateLocationByIp,
  nudgeLocation,
  parseManualCoordinates,
  readCachedDeviceLocation,
  requestDeviceLocation,
  searchPlaces,
  writeCachedDeviceLocation,
  type PlaceSearchResult,
} from './messages/chatLocationGeo';
import { handleMediaError } from '../../lib/utils';

type ChatLocationShareSheetProps = {
  open: boolean;
  onClose: () => void;
  onSend: (location: ChatMessageLocation) => void;
};

type SheetMode = 'gps' | 'search' | 'manual';

export function ChatLocationShareSheet({ open, onClose, onSend }: ChatLocationShareSheetProps) {
  const [loading, setLoading] = useState(false);
  const [loadingHint, setLoadingHint] = useState('Getting your location…');
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ChatMessageLocation | null>(null);
  const [label, setLabel] = useState('');
  const [mode, setMode] = useState<SheetMode>('gps');
  const [usedStaleCache, setUsedStaleCache] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<PlaceSearchResult[]>([]);

  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const gpsLookupIdRef = useRef(0);

  const resetState = useCallback(() => {
    setLoading(false);
    setLoadingHint('Getting your location…');
    setGpsError(null);
    setDraft(null);
    setLabel('');
    setMode('gps');
    setUsedStaleCache(false);
    setSearchQuery('');
    setSearchLoading(false);
    setSearchResults([]);
    setManualLat('');
    setManualLng('');
  }, []);

  const applyDraft = useCallback((location: ChatMessageLocation, fromCache = false) => {
    setDraft(location);
    setUsedStaleCache(fromCache);
    setLabel((prev) => (prev.trim() ? prev : location.label || ''));
    setManualLat(String(location.latitude));
    setManualLng(String(location.longitude));
  }, []);

  const runGpsLookup = useCallback(async () => {
    const lookupId = Date.now();
    gpsLookupIdRef.current = lookupId;
    setLoading(true);
    setGpsError(null);
    setLoadingHint('Getting your location…');

    const cached = readCachedDeviceLocation();
    if (cached) {
      applyDraft(cached, true);
      setLoadingHint('Updating GPS fix…');
    }

    try {
      const fresh = await requestDeviceLocation();
      if (gpsLookupIdRef.current !== lookupId) return;
      applyDraft(fresh, false);
      setUsedStaleCache(false);
      setGpsError(null);
    } catch (error) {
      if (gpsLookupIdRef.current !== lookupId) return;
      const code = (error as GeolocationPositionError)?.code ?? 3;
      setGpsError(geolocationErrorMessage(code));
      if (!cached) {
        setDraft(null);
      }
    } finally {
      if (gpsLookupIdRef.current === lookupId) {
        setLoading(false);
      }
    }
  }, [applyDraft]);

  useEffect(() => {
    if (!open) {
      resetState();
      return;
    }
    void runGpsLookup();
  }, [open, resetState, runGpsLookup]);

  const handleApproximate = async () => {
    setLoading(true);
    setLoadingHint('Looking up approximate location…');
    setGpsError(null);
    try {
      const approx = await fetchApproximateLocationByIp();
      if (!approx) {
        setGpsError('Could not detect approximate location. Search for a place instead.');
        return;
      }
      writeCachedDeviceLocation(approx);
      applyDraft(approx, false);
      setMode('gps');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (searchQuery.trim().length < 2) return;
    setSearchLoading(true);
    try {
      const results = await searchPlaces(searchQuery);
      setSearchResults(results);
      if (results.length === 0) {
        setGpsError('No places found. Try a different search.');
      } else {
        setGpsError(null);
      }
    } catch {
      setGpsError('Place search failed. Check your connection.');
    } finally {
      setSearchLoading(false);
    }
  };

  const selectSearchResult = (result: PlaceSearchResult) => {
    writeCachedDeviceLocation(result.location);
    applyDraft(result.location, false);
    setLabel(result.label);
    setGpsError(null);
    setMode('gps');
    setSearchResults([]);
  };

  const applyManualCoords = () => {
    const parsed = parseManualCoordinates(manualLat, manualLng);
    if (!parsed) {
      setGpsError('Enter valid latitude (-90 to 90) and longitude (-180 to 180).');
      return;
    }
    writeCachedDeviceLocation(parsed);
    applyDraft(parsed, false);
    setGpsError(null);
    setMode('gps');
  };

  const handleSend = () => {
    if (!draft) return;
    onSend({
      ...draft,
      label: label.trim() || draft.label,
    });
  };

  const nudge = (dLat: number, dLng: number) => {
    if (!draft) return;
    const next = nudgeLocation(draft, dLat, dLng);
    applyDraft(next, false);
  };

  if (!open) return null;

  const showReady = !!draft && !loading;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="Close location share"
            className="fixed inset-0 z-[390] bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Share location"
            className="fixed inset-x-0 bottom-0 z-[395] mx-auto w-full max-w-lg max-h-[min(88vh,720px)] rounded-t-3xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-bold">Share location</p>
                  <p className="text-[11px] text-muted-foreground">GPS, search, or enter coordinates</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-full hover:bg-secondary transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-1 p-2 border-b border-border shrink-0">
              {(
                [
                  { id: 'gps' as const, label: 'Current' },
                  { id: 'search' as const, label: 'Search' },
                  { id: 'manual' as const, label: 'Coords' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setMode(tab.id);
                    setGpsError(null);
                  }}
                  className={`flex-1 py-2 rounded-xl text-[12px] font-bold transition-colors ${
                    mode === tab.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-4 flex flex-col gap-3 overflow-y-auto min-h-0 flex-1">
              {loading && mode === 'gps' ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3 text-muted-foreground">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm font-medium text-center">{loadingHint}</p>
                  {draft ? (
                    <p className="text-[11px] text-center text-muted-foreground">
                      Showing last known position while GPS updates…
                    </p>
                  ) : null}
                </div>
              ) : null}

              {mode === 'search' ? (
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2">
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleSearch();
                      }}
                      placeholder="Search city, address, place…"
                      className="flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                    <button
                      type="button"
                      onClick={() => void handleSearch()}
                      disabled={searchLoading || searchQuery.trim().length < 2}
                      className="px-4 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50"
                    >
                      {searchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    </button>
                  </div>
                  <ul className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                    {searchResults.map((result) => (
                      <li key={`${result.location.latitude}-${result.location.longitude}-${result.label}`}>
                        <button
                          type="button"
                          onClick={() => selectSearchResult(result)}
                          className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-secondary text-[12px] font-medium leading-snug"
                        >
                          {result.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {mode === 'manual' ? (
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">Latitude</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={manualLat}
                        onChange={(e) => setManualLat(e.target.value)}
                        placeholder="37.7749"
                        className="rounded-xl border border-border bg-background px-3 py-2 text-sm tabular-nums"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">Longitude</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={manualLng}
                        onChange={(e) => setManualLng(e.target.value)}
                        placeholder="-122.4194"
                        className="rounded-xl border border-border bg-background px-3 py-2 text-sm tabular-nums"
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={applyManualCoords}
                    className="w-full py-2.5 rounded-full bg-secondary font-bold text-sm"
                  >
                    Apply coordinates
                  </button>
                  {draft ? (
                    <div className="grid grid-cols-3 gap-1">
                      <button type="button" onClick={() => nudge(0.01, 0)} className="py-2 rounded-lg bg-secondary text-xs font-bold">N</button>
                      <button type="button" onClick={() => nudge(-0.01, 0)} className="py-2 rounded-lg bg-secondary text-xs font-bold">S</button>
                      <button type="button" onClick={() => nudge(0, 0.01)} className="py-2 rounded-lg bg-secondary text-xs font-bold">E</button>
                      <button type="button" onClick={() => nudge(0, -0.01)} className="py-2 rounded-lg bg-secondary text-xs font-bold">W</button>
                      <button type="button" onClick={() => nudge(0.001, 0)} className="py-2 rounded-lg bg-secondary text-xs font-bold col-span-2 text-[10px]">Fine N</button>
                      <button type="button" onClick={() => nudge(0, 0.001)} className="py-2 rounded-lg bg-secondary text-xs font-bold text-[10px]">Fine E</button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {gpsError ? (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-3">
                  <p className="text-[12px] font-semibold text-amber-800 dark:text-amber-200">{gpsError}</p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => void runGpsLookup()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Retry GPS
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleApproximate()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-[11px] font-bold"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      Approximate
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('search');
                        setGpsError(null);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-[11px] font-bold"
                    >
                      <Search className="w-3.5 h-3.5" />
                      Search place
                    </button>
                  </div>
                </div>
              ) : null}

              {usedStaleCache && draft && !loading ? (
                <p className="text-[11px] text-center text-amber-700 dark:text-amber-300 font-medium">
                  Using last known position — tap Retry GPS for a fresh fix
                </p>
              ) : null}

              {showReady && draft ? (
                <>
                  <div className="rounded-2xl overflow-hidden border border-border aspect-[2/1] bg-zinc-900 shrink-0">
                    <img
                      src={buildStaticMapPreviewUrl(draft)}
                      alt="Location preview"
                      className="w-full h-full object-cover"
                      onError={handleMediaError}
                    />
                  </div>
                  <p className="text-[12px] text-muted-foreground tabular-nums text-center">
                    {formatCoordinates(draft)}
                    {draft.accuracyMeters
                      ? ` · ±${Math.round(draft.accuracyMeters)} m`
                      : ''}
                  </p>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
                      Place name (optional)
                    </span>
                    <input
                      type="text"
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      placeholder="e.g. Coffee shop, Home"
                      maxLength={120}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleSend}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-full bg-primary text-primary-foreground font-bold text-sm shadow-md hover:opacity-95 transition-opacity shrink-0"
                  >
                    <Send className="w-4 h-4" />
                    Send location
                  </button>
                </>
              ) : null}

              {!loading && !draft && mode === 'gps' && !gpsError ? (
                <p className="text-sm text-center text-muted-foreground py-6">
                  Waiting for location…
                </p>
              ) : null}
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
