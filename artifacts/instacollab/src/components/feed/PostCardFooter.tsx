import React from 'react';
import { Heart, MessageCircle, Bookmark, Repeat } from 'lucide-react';
import { ShareIcon } from '../common/ShareIcon';
import { Post as PostType } from '../../types';
import { Avatar } from '../common/Avatar';
import {
  formatContentDateTime,
  formatRepostedDateTime,
  formatPostedDateTime,
  contentTimestampIso,
  openProfilePreview,
  handleAvatarError,
  getFontClass,
  getAlignClass,
  truncateText,
  resolveCaptionColorClass,
  formatMentionsAndTags,
} from '../../lib/utils';
import { resolveCommentAuthor, type CommentLike } from '../../lib/entityResolve';
import { CaptionModal } from './CaptionModal';
import { snapshotPostPlayback } from '../../lib/postPlayback';
import type { User } from '../../types';

type ResolvedPost = ReturnType<typeof import('../../lib/entityResolve').resolvePost>;
type ResolvedUser = ReturnType<typeof import('../../lib/safe').resolveUser>;

export type PostCardFooterProps = {
  post: PostType;
  livePost: ResolvedPost;
  postAuthor: ResolvedUser;
  showOptionsModal: boolean;
  onLike?: (id: string) => void;
  onSave?: (id: string) => void;
  onViewComments?: (id: string) => void;
  onOpenShareModal: () => void;
  onOpenRepostModal: () => void;
  commentText: string;
  onCommentTextChange: (value: string) => void;
  onCommentSubmit: (e: React.FormEvent) => void;
  showFullCaptionModal: boolean;
  onShowFullCaption: () => void;
  onCloseFullCaption: () => void;
  postComments: Record<string, CommentLike[] | undefined> | undefined;
  currentUser: User;
  users: User[] | null | undefined;
  originalPostCreatedAt?: string;
};

export function PostCardFooter({
  post,
  livePost,
  postAuthor,
  showOptionsModal,
  onLike,
  onSave,
  onViewComments,
  onOpenShareModal,
  onOpenRepostModal,
  commentText,
  onCommentTextChange,
  onCommentSubmit,
  showFullCaptionModal,
  onShowFullCaption,
  onCloseFullCaption,
  postComments,
  currentUser,
  users,
  originalPostCreatedAt,
}: PostCardFooterProps) {
  const openComments = () => {
    if (!onViewComments) return;
    snapshotPostPlayback(livePost.id, 'modal');
    onViewComments(livePost.id);
  };

  return (
    <>
      <div className={`flex items-center justify-between p-4 pb-2 relative ${showOptionsModal ? 'z-0' : 'z-[1]'}`}>
        <div className="flex items-center gap-5">
          <button
            onClick={() => onLike && onLike(livePost.id)}
            className="flex items-center gap-1.5 hover:opacity-70 transition-transform active:scale-90 group"
          >
            <Heart
              fill={livePost.isLiked ? 'currentColor' : 'none'}
              className={`w-[26px] h-[26px] transition-colors ${livePost.isLiked ? 'text-red-500' : 'text-foreground group-hover:text-red-500'}`}
            />
            <span className="font-bold text-[15px]">{(livePost.likes || 0).toLocaleString()}</span>
          </button>
          <button
            onClick={openComments}
            className="flex items-center gap-1.5 hover:opacity-70 transition-transform active:scale-90 group"
          >
            <MessageCircle className="w-[26px] h-[26px] stroke-foreground group-hover:stroke-primary transition-colors" />
            <span className="font-bold text-[15px]">{livePost.comments || 0}</span>
          </button>
          <button
            onClick={onOpenRepostModal}
            className="flex items-center gap-1.5 hover:opacity-70 transition-transform active:scale-90 group"
          >
            <Repeat className="w-[26px] h-[26px] stroke-foreground group-hover:stroke-primary transition-colors" />
            <span className="font-bold text-[15px]">{livePost?.reposts || 0}</span>
          </button>
          <button
            onClick={onOpenShareModal}
            className="flex items-center gap-1.5 hover:opacity-70 transition-transform active:scale-90 group"
          >
            <ShareIcon />
          </button>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => onSave && onSave(livePost.id)}
            className="hover:opacity-70 transition-transform active:scale-90 group"
          >
            <Bookmark
              fill={livePost.isSaved ? 'currentColor' : 'none'}
              className="w-[26px] h-[26px] transition-colors text-foreground"
            />
          </button>
        </div>
      </div>

      <div className="px-4 mb-3">
        <p className={`post-caption-text text-[14px] leading-relaxed break-words ${getFontClass(post.font)} ${getAlignClass(post.alignment)} ${resolveCaptionColorClass(post.color)}`}>
          <span className="font-bold mr-2 hover:underline cursor-pointer" onClick={() => openProfilePreview(postAuthor)}>
            {postAuthor.username || 'Unknown'}
          </span>
          {formatMentionsAndTags(truncateText(post.caption, 180).text)}
          {truncateText(post.caption, 180).showMore && (
            <button onClick={onShowFullCaption} className="text-foreground/70 ml-1 hover:underline font-bold">
              view more
            </button>
          )}
        </p>
      </div>

      {showFullCaptionModal && <CaptionModal post={livePost} onClose={onCloseFullCaption} />}

      {(postComments?.[livePost.id] || []).map((comment: CommentLike, idx: number) => {
        const commentUser = resolveCommentAuthor(users, comment, currentUser);
        return (
          <div key={comment.id || idx} className="px-4 mt-1 text-[14px] leading-relaxed flex items-start gap-2">
            <img
              src={commentUser.avatarUrl || undefined}
              alt="avatar"
              className="w-5 h-5 rounded-full object-cover border border-border shrink-0 mt-0.5 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => openProfilePreview(commentUser)}
              onError={handleAvatarError}
            />
            <div>
              <span
                className="font-bold mr-2 hover:underline cursor-pointer"
                onClick={() => openProfilePreview(commentUser)}
              >
                {commentUser.username}
              </span>
              <span className="text-foreground">{comment.text}</span>
            </div>
          </div>
        );
      })}

      {(livePost.comments || 0) > 2 && (
        <div
          onClick={openComments}
          className="px-4 mt-1 text-[14px] text-muted-foreground cursor-pointer font-medium hover:underline w-max"
        >
          View all {(livePost.comments || 0)} comments
        </div>
      )}

      <form onSubmit={onCommentSubmit} className="px-4 mt-3 flex items-center pb-2">
        <div className="mr-3">
          <Avatar user={currentUser} size="sm" />
        </div>
        <input
          type="text"
          value={commentText}
          onChange={(e) => onCommentTextChange(e.target.value)}
          placeholder="Add a comment..."
          className="flex-1 bg-transparent border-none outline-none text-[14px] font-medium text-foreground placeholder:text-muted-foreground"
        />
        {commentText.trim() && (
          <button type="submit" className="text-primary font-bold text-[14px] ml-2 hover:text-primary/80 transition-colors">
            Post
          </button>
        )}
      </form>

      {livePost.repost ? (
        <div className="px-4 mt-1 mb-3 space-y-0.5">
          <time
            dateTime={contentTimestampIso(livePost.createdAt)}
            className="block text-[11px] text-muted-foreground font-medium"
          >
            {formatRepostedDateTime(livePost.createdAt)}
          </time>
          {originalPostCreatedAt ? (
            <time
              dateTime={contentTimestampIso(originalPostCreatedAt)}
              className="block text-[11px] text-muted-foreground/80 font-medium"
            >
              {formatPostedDateTime(originalPostCreatedAt)}
            </time>
          ) : null}
        </div>
      ) : (
        <time
          dateTime={contentTimestampIso(post.createdAt)}
          className="px-4 mt-1 mb-3 block text-[11px] text-muted-foreground font-medium"
        >
          {formatContentDateTime(post.createdAt)}
        </time>
      )}
    </>
  );
}
