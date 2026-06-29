import React from 'react';
import { Post as PostType } from '../../types';
import { Avatar } from '../common/Avatar';
import { PostMediaStage, type PostMediaStageProps } from './PostMediaStage';
import { formatContentDateTime, formatPostedDateTime, contentTimestampIso, openProfilePreview } from '../../lib/utils';

type ResolvedPost = ReturnType<typeof import('../../lib/entityResolve').resolvePost>;

type RepostPostMediaPanelProps = {
  repost: PostType;
  mediaPost: PostType;
  mediaLivePost: ResolvedPost;
  isTextPost?: boolean;
  headerSize?: 'sm' | 'md';
  shellClassName?: string;
  mediaStageProps: Omit<PostMediaStageProps, 'post' | 'livePost' | 'isTextPost'>;
};

export function RepostPostMediaPanel({
  repost,
  mediaPost,
  mediaLivePost,
  isTextPost = false,
  headerSize = 'sm',
  shellClassName = 'absolute inset-1.5',
  mediaStageProps,
}: RepostPostMediaPanelProps) {
  const isMdHeader = headerSize === 'md';

  return (
    <div
      className={`${shellClassName} bg-card flex flex-col overflow-hidden border border-border/80 rounded-[18px] shadow-sm`}
    >
      <div
        className={`flex items-start gap-3 bg-card border-b border-border/50 shrink-0 ${
          isMdHeader ? 'p-4' : 'p-3'
        }`}
      >
        <div
          onClick={() => repost.user && openProfilePreview(repost.user)}
          className="cursor-pointer shrink-0"
        >
          <Avatar user={repost.user} size={headerSize} hideNote />
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <div
            className={`flex items-center gap-1.5 leading-tight ${
              isMdHeader ? 'text-[14px]' : 'text-[13px]'
            }`}
          >
            <span
              className="font-bold cursor-pointer hover:underline truncate"
              onClick={() => repost.user && openProfilePreview(repost.user)}
            >
              {repost.user?.displayName || repost.user?.username || 'Unknown'}
            </span>
            {repost.user?.isVerified && (
              <span className="bg-primary/20 text-primary text-[10px] px-1 rounded-sm shrink-0">
                ✓
              </span>
            )}
            <span className={`text-muted-foreground shrink-0 ${isMdHeader ? 'font-semibold text-[13px]' : ''}`}>
              • Follow
            </span>
          </div>
          <time
            dateTime={contentTimestampIso(repost.createdAt)}
            className={`block text-muted-foreground font-medium leading-tight mt-0.5 ${
              isMdHeader ? 'text-xs' : 'text-[11px]'
            }`}
          >
            {formatPostedDateTime(repost.createdAt || Date.now())}
          </time>

          {repost.caption && (
            <div
              className={`font-medium text-foreground leading-relaxed mt-2 ${
                isMdHeader ? 'text-[14px] line-clamp-3' : 'text-[13px] line-clamp-2'
              }`}
            >
              {repost.caption}
            </div>
          )}
        </div>
      </div>

      <div className="w-full flex-1 relative min-h-0 bg-secondary overflow-hidden">
        <div className="absolute inset-0">
          <PostMediaStage
          post={mediaPost}
          livePost={mediaLivePost}
          isTextPost={isTextPost}
          {...mediaStageProps}
        />
        </div>
      </div>
    </div>
  );
}
