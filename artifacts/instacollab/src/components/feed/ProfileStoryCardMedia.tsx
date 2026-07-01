import React from 'react';
import type { StoryDraftMedia } from '../stories/storyDraft';
import { handleAvatarError } from '../../lib/utils';
import { getStorySegmentPreviewUrl, pickStoryCardPreviewSegment } from '../../lib/storyPreview';
import { nativeVideoControlGuardProps } from '../../lib/nativeVideoControls';

type ProfileStoryCardMediaProps = {
  segments: StoryDraftMedia[];
  fallbackUrl?: string;
  alt: string;
};

export function ProfileStoryCardMedia({
  segments,
  fallbackUrl,
  alt,
}: ProfileStoryCardMediaProps) {
  const segment = pickStoryCardPreviewSegment(segments);
  const shellClass = 'profile-story-card-live profile-story-card-live--preview';

  if (!segment) {
    return (
      <div className={shellClass}>
        <div
          className="profile-story-card-media-el profile-story-card-media-el--placeholder"
          aria-label={alt}
        />
      </div>
    );
  }

  if (segment.isText) {
    return (
      <div className={shellClass}>
        <div
          className={`profile-story-card-text ${
            segment.textBg || 'bg-gradient-to-br from-indigo-500 to-purple-600'
          }`}
        >
          <p
            className={`profile-story-card-text-content ${segment.font || ''} ${
              segment.textColor || 'text-white'
            }`}
          >
            {(segment.textContent || segment.caption || '').slice(0, 120)}
          </p>
        </div>
      </div>
    );
  }

  if (segment.isVideo && segment.url) {
    return (
      <div className={shellClass}>
        <video
          src={segment.url}
          muted
          playsInline
          autoPlay
          loop
          controls
          preload="metadata"
          className="profile-story-card-media-el"
          aria-label={alt}
          {...nativeVideoControlGuardProps()}
        />
      </div>
    );
  }

  const previewUrl = getStorySegmentPreviewUrl(segment, fallbackUrl);
  if (!previewUrl) {
    return (
      <div className={shellClass}>
        <div
          className="profile-story-card-media-el profile-story-card-media-el--placeholder"
          aria-label={alt}
        />
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <img
        src={previewUrl}
        alt={alt}
        className="profile-story-card-media-el"
        onError={handleAvatarError}
      />
    </div>
  );
}
