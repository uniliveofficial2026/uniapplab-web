import React, { useState } from 'react';
import { Avatar } from '../common/Avatar';
import { handleAvatarError } from '../../lib/utils';
import { useDB } from '../../lib/useDB';
import type { User } from '../../types';

const SUGGESTED_HASHTAGS = [
  '#fyp',
  '#viral',
  '#trending',
  '#explore',
  '#photography',
  '#art',
  '#daily',
];

const SUGGESTED_MENTIONS = ['@alex', '@sarah', '@design_guru', '@tech_insider', '@daily_vibes'];

type StoryCaptionComposerProps = {
  user: User;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Omit for unlimited caption length. */
  maxLength?: number;
};

export function StoryCaptionComposer({
  user,
  value,
  onChange,
  placeholder = 'Write a caption...',
  maxLength,
}: StoryCaptionComposerProps) {
  const db = useDB();
  const [showHashtagList, setShowHashtagList] = useState(false);
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');

  const append = (chunk: string) => onChange((value.trim() + ' ' + chunk).trim() + ' ');

  const toggleTag = (tag: string) => {
    if (value.includes(tag)) {
      onChange(value.replace(new RegExp(tag + '\\s*', 'g'), '').trim());
    } else {
      append(tag);
    }
  };

  const toggleMention = (handle: string) => {
    if (value.includes(handle)) {
      onChange(value.replace(new RegExp(handle + '\\s*', 'g'), '').trim());
    } else {
      append(handle);
    }
  };

  return (
    <div className="flex-1 w-full min-w-0 flex flex-col overflow-hidden min-h-0">
      <div className="px-4 flex items-center gap-3 mb-3 shrink-0">
        <Avatar user={user} size="sm" />
        <span className="font-bold text-[14px]">{user.username}</span>
      </div>

      <textarea
        value={value}
        onChange={(e) =>
          onChange(
            maxLength != null ? e.target.value.slice(0, maxLength) : e.target.value
          )
        }
        maxLength={maxLength}
        placeholder={placeholder}
        className="flex-1 w-full p-4 text-[15px] resize-none outline-none bg-transparent placeholder:text-muted-foreground placeholder:font-medium min-h-[120px]"
      />

      <div className="border-t border-border p-3 flex items-center text-muted-foreground gap-1 relative shrink-0">
        {showHashtagList && (
          <div className="absolute bottom-full left-0 mb-2 w-full bg-card border border-border rounded-xl shadow-xl overflow-hidden z-50">
            <div className="px-3 py-2 border-b border-border flex items-center justify-between bg-secondary/20">
              <span className="text-xs font-bold text-foreground">Select Hashtags</span>
              <button
                type="button"
                onClick={() => setShowHashtagList(false)}
                className="text-xs font-bold text-primary hover:underline"
              >
                Done
              </button>
            </div>
            <div className="p-3 flex flex-wrap gap-2 max-h-32 overflow-y-auto no-scrollbar">
              {SUGGESTED_HASHTAGS.map((tag) => {
                const isSelected = value.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      isSelected
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary hover:bg-secondary/80 text-foreground'
                    }`}
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
                  setShowMentionList(false);
                  setMentionSearch('');
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
                onChange={(e) => setMentionSearch(e.target.value)}
                placeholder="Search creators..."
                className="w-full text-xs bg-secondary border border-border rounded-lg px-2.5 py-1.5 outline-none font-medium focus:border-primary placeholder:text-muted-foreground"
              />
            </div>
            <div className="p-1 flex flex-col gap-1 max-h-44 overflow-y-auto no-scrollbar">
              {(() => {
                const dbUsers = db.users;
                const filteredDbUsers = dbUsers.filter(
                  (u) =>
                    u.username.toLowerCase().includes(mentionSearch.toLowerCase()) ||
                    (u.displayName &&
                      u.displayName.toLowerCase().includes(mentionSearch.toLowerCase())),
                );
                const hasExactMatch = dbUsers.some(
                  (u) => u.username.toLowerCase() === mentionSearch.toLowerCase().replace('@', ''),
                );
                const showCustomAdd = mentionSearch.trim().length > 0 && !hasExactMatch;

                return (
                  <>
                    {filteredDbUsers.map((u) => {
                      const handle = '@' + u.username;
                      const isSelected = value.includes(handle);
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => toggleMention(handle)}
                          className={`flex items-center gap-2.5 w-full p-2 rounded-lg text-left transition-colors ${
                            isSelected ? 'bg-primary/10 hover:bg-primary/20' : 'hover:bg-secondary'
                          }`}
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
                          toggleMention(handle);
                          setMentionSearch('');
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
                    {mentionSearch === '' &&
                      SUGGESTED_MENTIONS.map((handle) => {
                        const isSelected = value.includes(handle);
                        return (
                          <button
                            key={handle}
                            type="button"
                            onClick={() => toggleMention(handle)}
                            className={`px-3 py-2 rounded-lg text-left text-xs font-bold transition-colors ${
                              isSelected
                                ? 'bg-primary/10 text-primary'
                                : 'hover:bg-secondary text-foreground'
                            }`}
                          >
                            {handle}
                          </button>
                        );
                      })}
                  </>
                );
              })()}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => append('😊')}
          className="p-2 hover:bg-secondary rounded-lg transition-colors"
        >
          <span className="text-xl">😊</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setShowHashtagList(!showHashtagList);
            setShowMentionList(false);
          }}
          className={`px-3 py-1.5 rounded-lg transition-colors font-semibold text-lg ${
            showHashtagList ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary text-foreground'
          }`}
        >
          #
        </button>
        <button
          type="button"
          onClick={() => {
            setShowMentionList(!showMentionList);
            setShowHashtagList(false);
          }}
          className={`px-3 py-1.5 rounded-lg transition-colors font-semibold text-lg ${
            showMentionList ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary text-foreground'
          }`}
        >
          @
        </button>
        <div className="flex-1 text-right">
          <span className="text-xs font-medium">
            {maxLength != null
              ? `${value.length}/${maxLength}`
              : value.length > 0
                ? `${value.length} · Unlimited`
                : 'Unlimited'}
          </span>
        </div>
      </div>
    </div>
  );
}
