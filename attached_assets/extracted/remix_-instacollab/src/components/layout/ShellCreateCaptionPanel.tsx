import { User } from '../../types';
import { handleAvatarError } from '../../lib/utils';
import { Avatar } from '../common/Avatar';
import {
  SelectedAudioStrip,
  type CustomAudioSelection,
} from '../common/AudioTrackPicker';

export type ShellCreateCaptionPanelProps = {
  currentUser: User;
  users: User[];
  caption: string;
  onCaptionChange: (value: string) => void;
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
  return (
    <div className="flex-1 w-full flex flex-col overflow-hidden min-h-0">
      <div className="px-4 flex items-center gap-3 mb-3 shrink-0">
        <Avatar user={currentUser} size="sm" />
        <span className="font-bold text-[14px]">{currentUser.username}</span>
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
          <span className="text-xs font-medium">{caption.length}/2200</span>
        </div>
      </div>
    </div>
  );
}
