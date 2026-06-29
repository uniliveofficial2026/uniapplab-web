import React from 'react';
import { Loader2, MapPin, Navigation, Search, X } from 'lucide-react';
import { User } from '../../types';
import { handleAvatarError } from '../../lib/utils';
import { Avatar } from '../common/Avatar';
import {
  SelectedAudioStrip,
  type CustomAudioSelection,
} from '../common/AudioTrackPicker';
import {
  fetchApproximateLocationByIp,
  requestDeviceLocation,
  searchPlaces,
  type PlaceSearchResult,
} from '../messages/messages/chatLocationGeo';
import { geolocationErrorMessage, getLocationPreviewLabel } from '../messages/messages/chatLocationUtils';

export type ShellCreateCaptionPanelProps = {
  currentUser: User;
  users: User[];
  caption: string;
  onCaptionChange: (value: string) => void;
  location: string;
  onLocationChange: (value: string) => void;
  showHashtagList: boolean;
  onShowHashtagListChange: (value: boolean) => void;
  showMentionList: boolean;
  onShowMentionListChange: (value: boolean) => void;
  mentionSearch: string;
  onMentionSearchChange: (value: string) => void;
  suggestedHashtags: string[];
  soundtrackSelected: boolean;
  backgroundAudio: CustomAudioSelection;
  audioTrack: string;
  onEditSoundtrack: () => void;
  onClearSoundtrack: () => void;
};

export function ShellCreateCaptionPanel({
  currentUser,
  users,
  caption,
  onCaptionChange,
  location,
  onLocationChange,
  showHashtagList,
  onShowHashtagListChange,
  showMentionList,
  onShowMentionListChange,
  mentionSearch,
  onMentionSearchChange,
  suggestedHashtags,
  soundtrackSelected,
  backgroundAudio,
  audioTrack,
  onEditSoundtrack,
  onClearSoundtrack,
}: ShellCreateCaptionPanelProps) {
  const [showLocationPicker, setShowLocationPicker] = React.useState(false);
  const [locationQuery, setLocationQuery] = React.useState('');
  const [locationLoading, setLocationLoading] = React.useState(false);
  const [locationError, setLocationError] = React.useState<string | null>(null);
  const [locationResults, setLocationResults] = React.useState<PlaceSearchResult[]>([]);

  const closeLocationPicker = () => {
    setShowLocationPicker(false);
    setLocationQuery('');
    setLocationResults([]);
    setLocationError(null);
  };

  const applyLocation = (value: string) => {
    onLocationChange(value.trim());
    closeLocationPicker();
  };

  const handleUseCurrentLocation = async () => {
    setLocationLoading(true);
    setLocationError(null);
    try {
      const current = await requestDeviceLocation();
      applyLocation(getLocationPreviewLabel(current));
    } catch (error) {
      const code = (error as GeolocationPositionError)?.code ?? 3;
      try {
        const approx = await fetchApproximateLocationByIp();
        if (approx) {
          applyLocation(getLocationPreviewLabel(approx));
          return;
        }
      } catch {
        /* fall through */
      }
      setLocationError(geolocationErrorMessage(code));
    } finally {
      setLocationLoading(false);
    }
  };

  const handleSearchLocation = async () => {
    const query = locationQuery.trim();
    if (query.length < 2) return;
    setLocationLoading(true);
    setLocationError(null);
    try {
      const results = await searchPlaces(query);
      setLocationResults(results);
      if (results.length === 0) {
        setLocationError('No places found. Try a different search.');
      }
    } catch {
      setLocationError('Place search failed. Check your connection.');
    } finally {
      setLocationLoading(false);
    }
  };

  return (
    <div className="flex-1 w-full flex flex-col overflow-hidden min-h-0">
      <div className="px-4 mb-3 shrink-0">
        <div className="flex items-start gap-3">
          <Avatar user={currentUser} size="sm" />
          <div className="flex flex-col min-w-0 flex-1 gap-1">
            <span className="font-bold text-[14px]">{currentUser.username}</span>
            {location ? (
              <div className="flex items-center gap-1.5 min-w-0">
                <MapPin className="w-3.5 h-3.5 shrink-0 text-primary" />
                <span className="text-[12px] font-semibold text-foreground/80 truncate">
                  {location}
                </span>
                <button
                  type="button"
                  onClick={() => onLocationChange('')}
                  className="p-0.5 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  aria-label="Remove location"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : showLocationPicker ? (
              <div className="rounded-xl border border-border bg-secondary/40 p-2.5 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="search"
                    value={locationQuery}
                    onChange={(e) => setLocationQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleSearchLocation();
                    }}
                    placeholder="Search city, place, or address…"
                    className="flex-1 min-w-0 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[12px] font-medium outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSearchLocation()}
                    disabled={locationLoading || locationQuery.trim().length < 2}
                    className="px-2.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
                    aria-label="Search locations"
                  >
                    {locationLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleUseCurrentLocation()}
                    disabled={locationLoading}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-background border border-border text-[11px] font-bold hover:bg-secondary transition-colors disabled:opacity-50"
                  >
                    {locationLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Navigation className="w-3.5 h-3.5" />
                    )}
                    Use current location
                  </button>
                  {locationQuery.trim() ? (
                    <button
                      type="button"
                      onClick={() => applyLocation(locationQuery)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-background border border-border text-[11px] font-bold hover:bg-secondary transition-colors"
                    >
                      Use “{locationQuery.trim()}”
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={closeLocationPicker}
                    className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-muted-foreground hover:bg-secondary transition-colors"
                  >
                    Cancel
                  </button>
                </div>
                {locationError ? (
                  <p className="text-[11px] font-medium text-red-500">{locationError}</p>
                ) : null}
                {locationResults.length > 0 ? (
                  <ul className="max-h-28 overflow-y-auto no-scrollbar divide-y divide-border rounded-lg border border-border bg-background">
                    {locationResults.map((result) => (
                      <li key={`${result.label}-${result.location.latitude}`}>
                        <button
                          type="button"
                          onClick={() => applyLocation(result.label)}
                          className="w-full text-left px-2.5 py-2 text-[11px] font-medium hover:bg-secondary transition-colors"
                        >
                          {result.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setShowLocationPicker(true);
                  onShowHashtagListChange(false);
                  onShowMentionListChange(false);
                }}
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline w-fit"
              >
                <MapPin className="w-3.5 h-3.5" />
                Add location
              </button>
            )}
          </div>
        </div>
      </div>
      {soundtrackSelected && (
        <div className="px-4 mb-3 shrink-0">
          <SelectedAudioStrip
            customAudio={backgroundAudio}
            libraryTrackId={audioTrack}
            playbackId="editor:audio-strip-caption"
            onEdit={onEditSoundtrack}
            onRemove={onClearSoundtrack}
          />
        </div>
      )}
      <textarea
        value={caption}
        onChange={(e) => onCaptionChange(e.target.value)}
        placeholder="Write a caption..."
        className="flex-1 w-full p-4 text-[15px] resize-none outline-none bg-transparent text-foreground placeholder:text-foreground/45 placeholder:font-medium"
      />
      <div className="border-t border-border p-3 flex items-center text-muted-foreground gap-1 relative shrink-0">
        {showHashtagList && (
          <div className="absolute bottom-full left-0 mb-2 w-full bg-card border border-border rounded-xl shadow-xl overflow-hidden z-50">
            <div className="px-3 py-2 border-b border-border flex items-center justify-between bg-secondary/20">
              <span className="text-xs font-bold text-foreground">Select Hashtags</span>
              <button
                type="button"
                onClick={() => onShowHashtagListChange(false)}
                className="text-xs font-bold text-primary hover:underline"
              >
                Done
              </button>
            </div>
            <div className="p-3 flex flex-wrap gap-2 max-h-32 overflow-y-auto no-scrollbar">
              {suggestedHashtags.map((tag) => {
                const isSelected = caption.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        onCaptionChange(caption.replace(new RegExp(tag + '\\s*', 'g'), '').trim());
                      } else {
                        onCaptionChange((caption.trim() + ' ' + tag).trim() + ' ');
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-secondary/80 text-foreground'}`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {showMentionList && (
          <div className="absolute bottom-full left-0 mb-2 w-full bg-card border border-border rounded-xl shadow-xl overflow-hidden z-50 flex flex-col">
            <div className="px-3 py-2 border-b border-border flex items-center justify-between bg-secondary/20 shrink-0">
              <span className="text-xs font-bold text-foreground">Mention Creators</span>
              <button
                type="button"
                onClick={() => {
                  onShowMentionListChange(false);
                  onMentionSearchChange('');
                }}
                className="text-xs font-bold text-primary hover:underline"
              >
                Done
              </button>
            </div>
            <div className="p-2 border-b border-border shrink-0">
              <input
                type="text"
                value={mentionSearch}
                onChange={(e) => onMentionSearchChange(e.target.value)}
                placeholder="Search creators..."
                className="w-full text-xs bg-secondary border border-border rounded-lg px-2.5 py-1.5 outline-none font-medium focus:border-primary placeholder:text-muted-foreground"
              />
            </div>
            <div className="p-1 flex flex-col gap-1 max-h-44 overflow-y-auto no-scrollbar">
              {(() => {
                const filteredDbUsers = users.filter(
                  (u) =>
                    u.username.toLowerCase().includes(mentionSearch.toLowerCase()) ||
                    (u.displayName &&
                      u.displayName.toLowerCase().includes(mentionSearch.toLowerCase()))
                );

                const hasExactMatch = users.some(
                  (u) => u.username.toLowerCase() === mentionSearch.toLowerCase().replace('@', '')
                );
                const showCustomAdd = mentionSearch.trim().length > 0 && !hasExactMatch;

                return (
                  <>
                    {filteredDbUsers.map((u) => {
                      const handle = '@' + u.username;
                      const isSelected = caption.includes(handle);
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              onCaptionChange(
                                caption.replace(new RegExp(handle + '\\s*', 'g'), '').trim()
                              );
                            } else {
                              onCaptionChange((caption.trim() + ' ' + handle).trim() + ' ');
                            }
                          }}
                          className={`flex items-center gap-2.5 w-full p-2 rounded-lg text-left transition-colors ${isSelected ? 'bg-primary/10 hover:bg-primary/20' : 'hover:bg-secondary'}`}
                        >
                          <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 border border-border">
                            <img
                              src={u.avatarUrl}
                              alt={u.username}
                              className="w-full h-full object-cover"
                              onError={handleAvatarError}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-foreground truncate flex items-center gap-1">
                              {u.username}
                              {u.isVerified && <span className="text-blue-500">✓</span>}
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate">
                              {u.displayName}
                            </div>
                          </div>
                          {isSelected && (
                            <div className="w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-black">
                              ✓
                            </div>
                          )}
                        </button>
                      );
                    })}

                    {showCustomAdd && (
                      <button
                        type="button"
                        onClick={() => {
                          const handle = '@' + mentionSearch.replace('@', '').trim();
                          onCaptionChange((caption.trim() + ' ' + handle).trim() + ' ');
                          onMentionSearchChange('');
                        }}
                        className="flex items-center gap-2.5 w-full p-2 rounded-lg text-left hover:bg-secondary border border-dashed border-border"
                      >
                        <div className="w-7 h-7 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                          @
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-primary">Mention custom user</div>
                          <div className="text-[10px] text-muted-foreground truncate">
                            @{mentionSearch.replace('@', '').trim()}
                          </div>
                        </div>
                      </button>
                    )}

                    {filteredDbUsers.length === 0 && !showCustomAdd && (
                      <div className="p-4 text-center text-xs text-muted-foreground font-semibold">
                        No creators found. Type to mention.
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => onCaptionChange(caption + '😊 ')}
          className="p-2 hover:bg-secondary rounded-lg transition-colors"
        >
          <span className="text-xl">😊</span>
        </button>
        <button
          type="button"
          onClick={() => {
            onShowHashtagListChange(!showHashtagList);
            onShowMentionListChange(false);
          }}
          className={`px-3 py-1.5 rounded-lg transition-colors font-semibold text-lg ${showHashtagList ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary text-foreground'}`}
        >
          #
        </button>
        <button
          type="button"
          onClick={() => {
            onShowMentionListChange(!showMentionList);
            onShowHashtagListChange(false);
          }}
          className={`px-3 py-1.5 rounded-lg transition-colors font-semibold text-lg ${showMentionList ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary text-foreground'}`}
        >
          @
        </button>
        <div className="flex-1 text-right">
          <span className="text-xs font-medium">
            {caption.length > 0 ? `${caption.length} · Unlimited` : 'Unlimited'}
          </span>
        </div>
      </div>
    </div>
  );
}
