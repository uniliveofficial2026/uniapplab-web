import React, { useState } from 'react';
import { Heart } from 'lucide-react';
import type { User } from '../../types';
import { db as dbInstance } from '../../lib/db/localDb';
import {
  formatContentDateTime,
  contentTimestampIso,
  handleAvatarError,
  openProfilePreview,
} from '../../lib/utils';
import { resolveCommentAuthor, type CommentLike } from '../../lib/entityResolve';

type Db = typeof dbInstance;

export type ReelsCommentItemProps = {
  comment: CommentLike;
  depth?: number;
  reelId: string;
  db: Db;
  me: User;
  setReplyingTo: React.Dispatch<
    React.SetStateAction<{ commentId: string; username: string } | null>
  >;
  setCommentText: (value: string) => void;
  commentInputRef: React.RefObject<HTMLInputElement | null>;
};

export function ReelsCommentItem({
  comment,
  depth = 0,
  reelId,
  db,
  me,
  setReplyingTo,
  setCommentText,
  commentInputRef,
}: ReelsCommentItemProps) {
  const [showReplies, setShowReplies] = useState(depth > 0);
  const commentAuthor = resolveCommentAuthor(db.users, comment, db.currentUser);
  const avatarClass = depth > 0 ? 'w-7 h-7' : 'w-9 h-9';
  const isLiked = !!me.id && (comment.likedBy?.includes(me.id) ?? false);

  const sharedProps = {
    reelId,
    db,
    me,
    setReplyingTo,
    setCommentText,
    commentInputRef,
  };

  return (
    <div className={depth > 0 ? 'mt-3' : ''}>
      <div className="flex gap-3">
        <img
          src={commentAuthor.avatarUrl || undefined}
          onError={handleAvatarError}
          className={`${avatarClass} rounded-full object-cover shrink-0 border border-border cursor-pointer hover:opacity-80 transition-opacity`}
          onClick={() => openProfilePreview(commentAuthor as User)}
          alt=""
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="font-bold text-sm cursor-pointer hover:underline"
              onClick={() => openProfilePreview(commentAuthor as User)}
            >
              {commentAuthor.username}
            </span>
            <time
              className="text-xs text-muted-foreground font-medium"
              dateTime={
                typeof comment.timestamp === 'number'
                  ? contentTimestampIso(comment.timestamp)
                  : undefined
              }
            >
              {typeof comment.timestamp === 'number'
                ? formatContentDateTime(comment.timestamp)
                : 'just now'}
            </time>
          </div>
          <p className="text-sm mt-0.5 leading-snug break-words whitespace-pre-wrap">
            {comment.text}
          </p>
          <div className="mt-1 flex items-center gap-4 text-xs font-bold text-muted-foreground">
            <button
              type="button"
              onClick={() => {
                if (!comment.id) return;
                setShowReplies(true);
                setReplyingTo({
                  commentId: comment.id,
                  username: commentAuthor.username || 'user',
                });
                setCommentText(`@${commentAuthor.username} `);
                commentInputRef.current?.focus();
              }}
              className="hover:text-foreground"
            >
              Reply
            </button>
          </div>
          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-1">
              {!showReplies ? (
                <button
                  type="button"
                  onClick={() => setShowReplies(true)}
                  className="text-xs font-bold text-muted-foreground flex items-center gap-2 mt-2 mb-1 hover:text-foreground"
                >
                  <span className="w-6 h-[1px] bg-border" />
                  View {comment.replies.length} repl
                  {comment.replies.length === 1 ? 'y' : 'ies'}
                </button>
              ) : (
                <>
                  {depth === 0 && (
                    <button
                      type="button"
                      onClick={() => setShowReplies(false)}
                      className="text-xs font-bold text-muted-foreground flex items-center gap-2 mt-2 mb-2 hover:text-foreground"
                    >
                      <span className="w-6 h-[1px] bg-border" />
                      Hide replies
                    </button>
                  )}
                  <div
                    className={
                      depth > 0
                        ? 'ml-1 border-l-2 border-border pl-3'
                        : ''
                    }
                  >
                    {comment.replies.map((reply: CommentLike) => (
                      <ReelsCommentItem
                        key={reply.id ?? `reply-${reply.timestamp ?? depth}-${reply.text?.slice(0, 12) ?? ''}`}
                        comment={reply}
                        depth={depth + 1}
                        {...sharedProps}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        <div className="ml-auto flex flex-col items-center gap-1 shrink-0 px-1">
          <button
            type="button"
            onClick={() => {
              if (!comment.id || !me.id) return;
              db.likeReelComment(reelId, comment.id, me.id);
            }}
            className="p-1 hover:scale-110 transition-transform"
            aria-label={isLiked ? 'Unlike comment' : 'Like comment'}
          >
            <Heart
              className={`w-3.5 h-3.5 ${
                isLiked
                  ? 'fill-current text-red-500'
                  : 'text-muted-foreground hover:text-red-500'
              }`}
            />
          </button>
          {(comment.likes ?? 0) > 0 && (
            <span className="text-[10px] font-bold text-muted-foreground">
              {comment.likes}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
