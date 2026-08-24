import React, { useState } from 'react';
import { MapPin, SlidersHorizontal, X } from 'lucide-react';
import {
  countYoutubeSearchFilters,
  type YoutubeSearchFilters,
  type YoutubeSearchOrder,
  type YoutubeSearchType,
  type YoutubeUploadDate,
  type YoutubeVideoDuration,
} from '../../lib/youtubeSearchFilters';

type YoutubeSearchFilterBarProps = {
  value: YoutubeSearchFilters;
  onChange: (next: YoutubeSearchFilters) => void;
  variant?: 'app' | 'dark';
};

const TYPES: Array<{ id: YoutubeSearchType; label: string }> = [
  { id: 'video', label: 'Video' },
  { id: 'channel', label: 'Channel' },
  { id: 'playlist', label: 'Playlist' },
  { id: 'movie', label: 'Movie' },
  { id: 'episode', label: 'Show' },
  { id: 'all', label: 'All' },
];

const UPLOAD: Array<{ id: YoutubeUploadDate; label: string }> = [
  { id: 'any', label: 'Any time' },
  { id: 'hour', label: 'Last hour' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'year', label: 'This year' },
];

const DURATION: Array<{ id: YoutubeVideoDuration; label: string }> = [
  { id: 'any', label: 'Any' },
  { id: 'short', label: 'Short (<4 min)' },
  { id: 'medium', label: '4–20 min' },
  { id: 'long', label: 'Over 20 min' },
];

const SORT: Array<{ id: YoutubeSearchOrder; label: string }> = [
  { id: 'relevance', label: 'Relevance' },
  { id: 'date', label: 'Upload date' },
  { id: 'viewCount', label: 'View count' },
  { id: 'rating', label: 'Rating' },
  { id: 'title', label: 'Title' },
];

const REGIONS = ['', 'US', 'GB', 'CA', 'AU', 'IN', 'JP', 'KR', 'BR', 'DE', 'FR', 'MX', 'ES', 'IT'];
const LANGS = ['', 'en', 'es', 'zh', 'ja', 'ko', 'hi', 'pt', 'fr', 'de', 'ar'];

function Chip({
  active,
  dark,
  children,
  onClick,
}: {
  active: boolean;
  dark: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
        active
          ? 'bg-red-600 text-white'
          : dark
            ? 'bg-white/10 text-white/70 hover:text-white'
            : 'bg-muted/60 text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

function Row({
  label,
  dark,
  children,
}: {
  label: string;
  dark: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p
        className={`text-[10px] font-bold uppercase tracking-wider ${
          dark ? 'text-white/40' : 'text-muted-foreground'
        }`}
      >
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

export function YoutubeSearchFilterBar({
  value,
  onChange,
  variant = 'app',
}: YoutubeSearchFilterBarProps) {
  const dark = variant === 'dark';
  const [open, setOpen] = useState(countYoutubeSearchFilters(value) > 0);
  const [locating, setLocating] = useState(false);
  const activeCount = countYoutubeSearchFilters(value);
  const videoMode = value.type !== 'channel' && value.type !== 'playlist';

  const patch = (partial: YoutubeSearchFilters) => onChange({ ...value, ...partial });

  const toggleFeature = (key: keyof YoutubeSearchFilters, onValue: string, off: string) => {
    const current = value[key];
    patch({ [key]: current === onValue ? off : onValue } as YoutubeSearchFilters);
  };

  const requestNearMe = () => {
    if (value.location) {
      patch({ location: undefined, locationRadius: undefined });
      return;
    }
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        patch({
          location: `${pos.coords.latitude.toFixed(5)},${pos.coords.longitude.toFixed(5)}`,
          locationRadius: '25km',
          type: value.type === 'channel' || value.type === 'playlist' ? 'video' : value.type,
        });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 8000 },
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
            open || activeCount > 0
              ? 'bg-red-600 text-white'
              : dark
                ? 'border border-white/10 text-white/70'
                : 'border border-border text-muted-foreground'
          }`}
          aria-expanded={open}
        >
          <SlidersHorizontal size={13} />
          Filters{activeCount > 0 ? ` · ${activeCount}` : ''}
        </button>
        {activeCount > 0 ? (
          <button
            type="button"
            onClick={() => onChange({})}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-bold ${
              dark ? 'text-white/50 hover:text-white' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <X size={12} /> Clear
          </button>
        ) : null}
      </div>

      {open ? (
        <div
          className={`space-y-3 rounded-2xl border p-3 ${
            dark ? 'border-white/10 bg-black/30' : 'border-border bg-card/60'
          }`}
        >
          <Row label="Type" dark={dark}>
            {TYPES.map((entry) => (
              <Chip
                key={entry.id}
                dark={dark}
                active={(value.type ?? 'video') === entry.id}
                onClick={() => patch({ type: entry.id })}
              >
                {entry.label}
              </Chip>
            ))}
          </Row>

          <Row label="Sort by" dark={dark}>
            {SORT.map((entry) => (
              <Chip
                key={entry.id}
                dark={dark}
                active={(value.order ?? 'relevance') === entry.id}
                onClick={() => patch({ order: entry.id })}
              >
                {entry.label}
              </Chip>
            ))}
            {value.type === 'channel' ? (
              <Chip
                dark={dark}
                active={value.order === 'videoCount'}
                onClick={() => patch({ order: 'videoCount' })}
              >
                Video count
              </Chip>
            ) : null}
          </Row>

          <Row label="Upload date" dark={dark}>
            {UPLOAD.map((entry) => (
              <Chip
                key={entry.id}
                dark={dark}
                active={(value.uploadDate ?? 'any') === entry.id}
                onClick={() => patch({ uploadDate: entry.id })}
              >
                {entry.label}
              </Chip>
            ))}
          </Row>

          {videoMode ? (
            <>
              <Row label="Duration" dark={dark}>
                {DURATION.map((entry) => (
                  <Chip
                    key={entry.id}
                    dark={dark}
                    active={(value.videoDuration ?? 'any') === entry.id}
                    onClick={() => patch({ videoDuration: entry.id })}
                  >
                    {entry.label}
                  </Chip>
                ))}
              </Row>

              <Row label="Features" dark={dark}>
                <Chip
                  dark={dark}
                  active={value.eventType === 'live'}
                  onClick={() => toggleFeature('eventType', 'live', 'any')}
                >
                  Live
                </Chip>
                <Chip
                  dark={dark}
                  active={value.eventType === 'upcoming'}
                  onClick={() => toggleFeature('eventType', 'upcoming', 'any')}
                >
                  Upcoming
                </Chip>
                <Chip
                  dark={dark}
                  active={value.videoDefinition === 'high'}
                  onClick={() => toggleFeature('videoDefinition', 'high', 'any')}
                >
                  HD
                </Chip>
                <Chip
                  dark={dark}
                  active={value.videoCaption === 'closedCaption'}
                  onClick={() => toggleFeature('videoCaption', 'closedCaption', 'any')}
                >
                  Subtitles
                </Chip>
                <Chip
                  dark={dark}
                  active={value.videoLicense === 'creativeCommon'}
                  onClick={() => toggleFeature('videoLicense', 'creativeCommon', 'any')}
                >
                  Creative Commons
                </Chip>
                <Chip
                  dark={dark}
                  active={value.videoDimension === '3d'}
                  onClick={() => toggleFeature('videoDimension', '3d', 'any')}
                >
                  3D
                </Chip>
                <Chip dark={dark} active={Boolean(value.location)} onClick={requestNearMe}>
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={11} />
                    {locating ? 'Locating…' : 'Near me'}
                  </span>
                </Chip>
              </Row>
            </>
          ) : null}

          <Row label="Safe search" dark={dark}>
            {(
              [
                { id: 'moderate', label: 'Moderate' },
                { id: 'none', label: 'Off' },
                { id: 'strict', label: 'Strict' },
              ] as const
            ).map((entry) => (
              <Chip
                key={entry.id}
                dark={dark}
                active={(value.safeSearch ?? 'moderate') === entry.id}
                onClick={() => patch({ safeSearch: entry.id })}
              >
                {entry.label}
              </Chip>
            ))}
          </Row>

          <div className="grid grid-cols-2 gap-2">
            <label className={`space-y-1 text-[10px] font-bold uppercase tracking-wider ${dark ? 'text-white/40' : 'text-muted-foreground'}`}>
              Region
              <select
                value={value.regionCode ?? ''}
                onChange={(event) => patch({ regionCode: event.target.value || undefined })}
                className={`mt-1 w-full rounded-xl border px-2 py-2 text-xs font-bold normal-case ${
                  dark
                    ? 'border-white/10 bg-black/40 text-white'
                    : 'border-border bg-background text-foreground'
                }`}
              >
                {REGIONS.map((code) => (
                  <option key={code || 'any'} value={code}>
                    {code || 'Any region'}
                  </option>
                ))}
              </select>
            </label>
            <label className={`space-y-1 text-[10px] font-bold uppercase tracking-wider ${dark ? 'text-white/40' : 'text-muted-foreground'}`}>
              Language
              <select
                value={value.relevanceLanguage ?? ''}
                onChange={(event) =>
                  patch({ relevanceLanguage: event.target.value || undefined })
                }
                className={`mt-1 w-full rounded-xl border px-2 py-2 text-xs font-bold normal-case ${
                  dark
                    ? 'border-white/10 bg-black/40 text-white'
                    : 'border-border bg-background text-foreground'
                }`}
              >
                {LANGS.map((code) => (
                  <option key={code || 'any'} value={code}>
                    {code || 'Any language'}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {value.channelId ? (
            <button
              type="button"
              onClick={() => patch({ channelId: undefined })}
              className="rounded-full bg-red-600/20 px-3 py-1.5 text-[11px] font-bold text-red-500"
            >
              Channel filter · clear
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
