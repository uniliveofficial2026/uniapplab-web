import React from 'react';
import { handleAvatarError } from '../../../lib/utils';

type Props = {
  postId: string;
  imageUrl: string;
  likesLabel: string;
  className?: string;
};

/** Post thumbnail frame — parent owns post data and click navigation. */
export function UniLivesPostCardFrame({
  postId,
  imageUrl,
  likesLabel,
  className = 'aspect-square relative bg-[color:var(--color-unilives-discovery-surface)]',
}: Props) {
  return (
    <div className={className} data-post-id={postId} data-unilives-post-card="">
      <img
        src={imageUrl}
        alt=""
        className="h-full w-full object-cover"
        onError={handleAvatarError}
      />
      <span className="absolute bottom-1 left-1 text-[10px] font-bold text-white drop-shadow">
        {likesLabel}
      </span>
    </div>
  );
}
