import React, { useState } from "react";
import { Heart } from "lucide-react";
import type { User } from "../../types";
import { db as dbInstance } from "../../lib/db";
import {
  formatTimeAgo,
  handleAvatarError,
  handleMediaError,
} from "../../lib/utils";
import { safeMediaUrl } from "../../lib/safe";
import { resolveCommentAuthor, type CommentLike } from "../../lib/entityResolve";
import { VoiceMessagePlayer } from "../messages/VoiceMessagePlayer";
import { InlineAttachmentVideo } from "../common/InlineAttachmentVideo";

type Db = typeof dbInstance;

export type PostModalFullscreenMedia = {
  items: Array<{
    url: string;
    isVideo?: boolean;
    isAudio?: boolean;
    name?: string;
    isText?: boolean;
    caption?: string;
    bg?: string;
    font?: string;
    alignment?: string;
    size?: string;
    color?: string;
    audioUrl?: string;
  }>;
  mediaIndex: number;
};

export type PostModalCommentItemProps = {
  comment: CommentLike;
  depth?: number;
  db: Db;
  me: User;
  selectedPost: { id: string };
  openProfilePreview: (user: User) => void;
  commentVideoRefs: React.RefObject<Map<string, HTMLVideoElement>>;
  openCommentMediaFullscreen: (
    commentId: string,
    media: Array<{ url: string; isVideo?: boolean; isAudio?: boolean; name?: string }>,
    mediaIndex: number,
  ) => void;
  setReplyingTo: React.Dispatch<
    React.SetStateAction<{ commentId: string; username: string } | null>
  >;
  setCommentText: React.Dispatch<React.SetStateAction<string>>;
  commentInputRef: React.RefObject<HTMLInputElement | null>;
};

export function PostModalCommentItem({
  comment,
  depth = 0,
  db,
  me,
  selectedPost,
  openProfilePreview,
  commentVideoRefs,
  openCommentMediaFullscreen,
  setReplyingTo,
  setCommentText,
  commentInputRef,
}: PostModalCommentItemProps) {
  const isLiked = comment.likedBy?.includes(me.id);
  const [showReplies, setShowReplies] = useState(false);

  const avatarClass =
    depth > 0 ? "w-6 h-6 md:w-8 md:h-8" : "w-8 h-8 md:w-10 md:h-10";

  const sharedProps = {
    db,
    me,
    selectedPost,
    openProfilePreview,
    commentVideoRefs,
    openCommentMediaFullscreen,
    setReplyingTo,
    setCommentText,
    commentInputRef,
  };

  return (
    <div className="flex gap-2 md:gap-3 items-start mt-4">
      <div
        className={`${avatarClass} rounded-full overflow-hidden border border-border shrink-0 mt-1 cursor-pointer hover:opacity-80 transition-opacity`}
        onClick={() => {
          openProfilePreview(resolveCommentAuthor(db.users, comment, db.currentUser));
        }}
      >
        <img
          src={resolveCommentAuthor(db.users, comment, db.currentUser).avatarUrl || undefined}
          alt="user"
          className="w-full h-full object-cover"
          onError={handleAvatarError}
        />
      </div>
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <div className="flex items-start justify-between gap-2 text-left">
          <div className="text-[14px] leading-relaxed break-words flex-1 flex flex-col items-start pr-2 md:pr-4 min-w-0">
            <div
              className="w-full break-words whitespace-pre-wrap"
              style={{ wordBreak: "break-word" }}
            >
              <span
                className="font-bold mr-2 cursor-pointer hover:underline"
                onClick={() => {
                  openProfilePreview(resolveCommentAuthor(db.users, comment, db.currentUser));
                }}
              >
                {resolveCommentAuthor(db.users, comment, db.currentUser).username}
              </span>
              <span>{comment.text}</span>
            </div>
            {comment.media && comment.media.length > 0 ? (
              <div className="mt-2 grid grid-cols-2 gap-2 w-full max-w-full md:max-w-[300px]">
                {comment.media.map((m: { url?: string; isVideo?: boolean; [key: string]: unknown }, idx: number) =>
                  m.isAudio ? (
                    <div key={idx} className="col-span-2 py-1">
                      {m.url ? (
                        <VoiceMessagePlayer url={m.url} color="secondary" />
                      ) : null}
                    </div>
                  ) : (
                    <div
                      key={idx}
                      className="rounded-xl border border-border overflow-hidden bg-secondary/30 relative group aspect-square"
                    >
                      {m.isVideo ? (
                        <InlineAttachmentVideo
                          src={m.url || ""}
                          className="w-full h-full"
                          onRegisterRef={(el) => {
                            const key = `${comment.id}-${idx}`;
                            if (el) commentVideoRefs.current.set(key, el);
                            else commentVideoRefs.current.delete(key);
                          }}
                          onError={handleMediaError}
                        />
                      ) : (
                        <img
                          src={m.url || undefined}
                          className="w-full h-full object-cover cursor-pointer"
                          alt="comment media"
                          onError={handleMediaError}
                          onClick={() => {
                            if (!comment.id || !comment.media) return;
                            openCommentMediaFullscreen(
                              comment.id,
                              comment.media.map((med) => ({
                                url: med.url ?? "",
                                isVideo: !!med.isVideo,
                                isAudio: med.isAudio,
                                name: med.name,
                              })),
                              idx,
                            );
                          }}
                        />
                      )}
                      {m.isVideo && (
                        <button
                          onClick={() => {
                            if (!comment.id || !comment.media) return;
                            openCommentMediaFullscreen(
                              comment.id,
                              comment.media.map((med) => ({
                                url: med.url ?? "",
                                isVideo: !!med.isVideo,
                                isAudio: med.isAudio,
                                name: med.name,
                              })),
                              idx,
                            );
                          }}
                          className="absolute top-2 right-2 bg-background/80 backdrop-blur text-foreground rounded-md p-1.5 opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-sm hover:bg-background shadow-lg"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M8 3H5a2 2 0 0 0-2 2v3" />
                            <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
                            <path d="M3 16v3a2 2 0 0 0 2 2h3" />
                            <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ),
                )}
              </div>
            ) : (
              comment.mediaUrl && (
                <div className="mt-2 rounded-xl border border-border overflow-hidden max-w-full md:max-w-[250px] bg-secondary/30 relative group">
                  {comment.isVideo ? (
                    <InlineAttachmentVideo
                      src={comment.mediaUrl || ""}
                      className="w-full max-h-[250px]"
                      videoClassName="w-full h-full object-cover max-h-[250px]"
                      onError={handleMediaError}
                    />
                  ) : (
                    <img
                      src={comment.mediaUrl || undefined}
                      className="w-full h-full object-cover max-h-[250px] cursor-pointer"
                      alt="comment media"
                      onError={handleMediaError}
                      onClick={() => {
                        const mediaUrl = safeMediaUrl(comment.mediaUrl);
                        if (!mediaUrl || !comment.id) return;
                        openCommentMediaFullscreen(
                          comment.id,
                          [{ url: mediaUrl, isVideo: !!comment.isVideo }],
                          0
                        );
                      }}
                    />
                  )}
                  {comment.isVideo && (
                    <button
                      onClick={() => {
                        const mediaUrl = safeMediaUrl(comment.mediaUrl);
                        if (!mediaUrl || !comment.id) return;
                        openCommentMediaFullscreen(
                          comment.id,
                          [{ url: mediaUrl, isVideo: !!comment.isVideo }],
                          0
                        );
                      }}
                      className="absolute top-2 right-2 bg-background/80 backdrop-blur text-foreground rounded-md p-1.5 opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-sm hover:bg-background shadow-lg"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M8 3H5a2 2 0 0 0-2 2v3" />
                        <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
                        <path d="M3 16v3a2 2 0 0 0 2 2h3" />
                        <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
                      </svg>
                    </button>
                  )}
                </div>
              )
            )}
          </div>
          <div className="flex flex-col items-center gap-1 shrink-0 px-2 mt-1 w-12">
            <button
              onClick={() => {
                if (!comment.id) return;
                db.likePostComment(selectedPost.id, comment.id, me.id);
              }}
              className="p-1 hover:scale-110 transition-transform"
            >
              <Heart
                className={`w-3.5 h-3.5 ${isLiked ? "fill-current text-red-500" : "text-muted-foreground hover:text-red-500"}`}
              />
            </button>
            {(comment.likes ?? 0) > 0 && (
              <span className="text-[10px] font-bold text-muted-foreground">
                {comment.likes}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs font-bold text-muted-foreground mt-1">
          <span>
            {typeof comment.timestamp === "number"
              ? formatTimeAgo(new Date(comment.timestamp).toISOString())
              : "just now"}
          </span>
          <button
            onClick={() => {
              if (!comment.id || !comment.username) return;
              setReplyingTo({
                commentId: comment.id,
                username: comment.username,
              });
              setCommentText(`@${comment.username} `);
              commentInputRef.current?.focus();
            }}
            className="hover:text-foreground transition-colors"
          >
            Reply
          </button>
        </div>
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-1">
            {!showReplies ? (
              <button
                onClick={() => setShowReplies(true)}
                className="text-xs font-bold text-muted-foreground flex items-center gap-2 mt-2 mb-1 hover:text-foreground"
              >
                <span className="w-6 h-[1px] bg-border"></span> View{" "}
                {comment.replies.length} repl
                {comment.replies.length === 1 ? "y" : "ies"}
              </button>
            ) : (
              <>
                <button
                  onClick={() => setShowReplies(false)}
                  className="text-xs font-bold text-muted-foreground flex items-center gap-2 mt-2 mb-2 hover:text-foreground"
                >
                  <span className="w-6 h-[1px] bg-border"></span> Hide replies
                </button>
                {comment.replies.map((reply: CommentLike) => (
                  <PostModalCommentItem
                    key={reply.id}
                    comment={reply}
                    depth={depth + 1}
                    {...sharedProps}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
