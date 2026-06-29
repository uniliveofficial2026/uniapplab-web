import { type CommentLike, type CommentThreadStore } from '../../entityResolve';
import { postUserId, reelUserId, safeUserId } from '../../safe';
import { normalizeEditorColorFields } from '../../themeText';
import type { StoryDraftMedia } from '../../../components/stories/storyDraft';
import type { Post, Reel, User } from '../../../types';
import type { CommentsLayer } from '../layers';
import type { Constructor, DbCoreBacked, MixinCtor } from '../mixin';

export function WithComments<T extends Constructor<DbCoreBacked>>(Base: T): MixinCtor<T, CommentsLayer> {
  return class extends Base {
    constructor(...args: any[]) {
      super(...args);
    }
    get reelComments(): CommentThreadStore {
      return this.load<CommentThreadStore>('reel_comments', {}) || {};
    }

    addReelComment(reelId: string, comment: CommentLike) {
      const rComments = this.asLocalDB().reelComments || {};
      const existing = rComments[reelId] || [];
      const newComment = {
        id: Math.random().toString(36).substring(2, 9),
        likes: 0,
        replies: [],
        timestamp: Date.now(),
        ...this.asLocalDB().enrichCommentPayload(comment),
      };
      this.save('reel_comments', {
        ...rComments,
        [reelId]: this.cappedList([newComment, ...existing], 'reel_comments'),
      });
      this.asLocalDB().syncReelCommentCount(reelId);
      this.notifyCommentOnReel(reelId, String(newComment.text ?? comment?.text ?? ''));
    }

    private commentMentionsUser(text: string, user: User | undefined): boolean {
      const body = String(text ?? '').trim();
      const username = user?.username?.trim();
      if (!body || !username) return false;
      return new RegExp(`@${username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(
        body
      );
    }

    private findPostCommentById(
      postId: string,
      commentId: string,
      comments = this.asLocalDB().postComments[postId] ?? []
    ): CommentLike | null {
      for (const comment of comments) {
        if (comment?.id === commentId) return comment;
        const replies = Array.isArray(comment?.replies) ? comment.replies : [];
        const nested = this.findPostCommentById(postId, commentId, replies);
        if (nested) return nested;
      }
      return null;
    }

    private notifyReplyOnPost(
      postId: string,
      parentCommentId: string,
      replyText: string
    ) {
      const meId = this.asLocalDB().currentUserId;
      const post = this.asLocalDB().posts.find((p: Post) => p?.id === postId);
      const parent = this.findPostCommentById(postId, parentCommentId);
      const parentAuthorId = safeUserId(parent?.userId);

      const ownerId = postUserId(post);
      const parentUser = parentAuthorId
        ? this.asLocalDB().users.find((u: User) => u?.id === parentAuthorId)
        : undefined;
      const mention = this.commentMentionsUser(replyText, parentUser);

      if (parentAuthorId && meId && parentAuthorId !== meId) {
        this.asLocalDB().pushNotificationForUser(parentAuthorId, {
          type: mention ? 'mention' : 'comment',
          actorUserId: meId,
          postId,
          postImage: post?.imageUrl || post?.videoUrl,
          text: mention
            ? `mentioned you: "${replyText.slice(0, 80)}${replyText.length > 80 ? '…' : ''}"`
            : `replied: ${replyText}`.trim(),
        });
      }

      if (ownerId && meId && ownerId !== meId && ownerId !== parentAuthorId) {
        this.notifyCommentOnPost(postId, replyText);
      } else if (!parentAuthorId || parentAuthorId === meId) {
        this.notifyCommentOnPost(postId, replyText);
      }
    }

    private notifyCommentOnPost(postId: string, text: string) {
      const meId = this.asLocalDB().currentUserId;
      const post = this.asLocalDB().posts.find((p: Post) => p?.id === postId);
      const ownerId = postUserId(post);
      if (!meId || !ownerId || ownerId === meId) return;
      const owner = this.asLocalDB().users.find((u: User) => u?.id === ownerId);
      const mention = this.commentMentionsUser(text, owner);
      this.asLocalDB().pushNotificationForUser(ownerId, {
        type: mention ? 'mention' : 'comment',
        actorUserId: meId,
        postId,
        postImage: post?.imageUrl || post?.videoUrl,
        text: mention
          ? `mentioned you: "${text.slice(0, 80)}${text.length > 80 ? '…' : ''}"`
          : text,
      });
    }

    private notifyCommentOnReel(reelId: string, text: string) {
      const meId = this.asLocalDB().currentUserId;
      const reel = this.asLocalDB().reels.find((r: Reel) => r?.id === reelId);
      const ownerId = reelUserId(reel);
      if (!meId || !ownerId || ownerId === meId) return;
      const owner = this.asLocalDB().users.find((u: User) => u?.id === ownerId);
      const mention = this.commentMentionsUser(text, owner);
      this.asLocalDB().pushNotificationForUser(ownerId, {
        type: mention ? 'mention' : 'comment',
        actorUserId: meId,
        reelId,
        postImage: reel?.videoUrl,
        text: mention
          ? `mentioned you: "${text.slice(0, 80)}${text.length > 80 ? '…' : ''}"`
          : text,
      });
    }

    get postComments(): CommentThreadStore {
      return this.load<CommentThreadStore>('post_comments', {}) || {};
    }

    addPostComment(postId: string, comment: CommentLike) {
      const pComments = this.asLocalDB().postComments || {};
      const existing = pComments[postId] || [];
      const newComment = {
        id: Math.random().toString(36).substring(2, 9),
        likes: 0,
        replies: [],
        timestamp: Date.now(),
        ...this.asLocalDB().enrichCommentPayload(comment),
      };
      this.save('post_comments', {
        ...pComments,
        [postId]: this.cappedList([newComment, ...existing], 'post_comments'),
      });
      this.asLocalDB().syncPostCommentCount(postId);
      this.notifyCommentOnPost(postId, String(newComment.text ?? comment?.text ?? ''));
    }

    /** Toggle like on a post comment (and nested replies). */
    likePostComment(postId: string, commentId: string, userId: string) {
      const pComments = this.asLocalDB().postComments;
      const existing = pComments[postId] || [];
      let liked = false;
      let authorId: string | null = null;

      const toggleLike = (comments: CommentLike[]): boolean => {
        for (const comment of comments) {
          if (comment.id === commentId) {
            comment.likedBy = comment.likedBy || [];
            const wasLiked = comment.likedBy.includes(userId);
            if (wasLiked) {
              comment.likedBy = comment.likedBy.filter((u: string) => u !== userId);
              comment.likes = Math.max(0, (comment.likes || 0) - 1);
              liked = false;
            } else {
              comment.likedBy.push(userId);
              comment.likes = (comment.likes || 0) + 1;
              liked = true;
            }
            authorId = safeUserId(comment.userId);
            return true;
          }
          if (comment.replies && comment.replies.length > 0) {
            if (toggleLike(comment.replies)) return true;
          }
        }
        return false;
      };

      toggleLike(existing);
      this.save('post_comments', { ...pComments, [postId]: existing });

      if (liked && authorId && userId && authorId !== userId) {
        const post = this.asLocalDB().posts.find((p: Post) => p?.id === postId);
        this.asLocalDB().pushNotificationForUser(authorId, {
          type: 'like',
          actorUserId: userId,
          postId,
          postImage: post?.imageUrl || post?.videoUrl,
          text: 'liked your comment',
        });
      }
    }

    /** Alias for discoverability — same as likePostComment. */
    togglePostCommentLike(postId: string, commentId: string, userId: string) {
      this.asLocalDB().likePostComment(postId, commentId, userId);
    }

    addPostCommentReply(postId: string, commentId: string, reply: CommentLike) {
      const pComments = this.asLocalDB().postComments;
      const existing = pComments[postId] || [];
      const newReply = {
        id: Math.random().toString(36).substring(2, 9),
        likes: 0,
        replies: [],
        timestamp: Date.now(),
        ...this.asLocalDB().enrichCommentPayload(reply),
      };
      
      const addReply = (comments: CommentLike[]): boolean => {
        for (const comment of comments) {
          if (comment.id === commentId) {
            comment.replies = comment.replies || [];
            comment.replies.push(newReply);
            comment.replies = this.cappedList(comment.replies, 'replies');
            return true;
          }
          if (comment.replies && comment.replies.length > 0) {
            if (addReply(comment.replies)) return true;
          }
        }
        return false;
      };
      
      addReply(existing);
      this.save('post_comments', { ...pComments, [postId]: existing });
      this.asLocalDB().syncPostCommentCount(postId);
      this.notifyReplyOnPost(
        postId,
        commentId,
        String(newReply.text ?? reply?.text ?? '')
      );
    }

    getUserStorySegments(userId: string): StoryDraftMedia[] {
      const allStories = this.asLocalDB().stories;
      const list = allStories[userId];
      if (!Array.isArray(list)) return [];
      return list.map((seg) => normalizeEditorColorFields(seg));
    }
  } as unknown as MixinCtor<T, CommentsLayer>;
}
