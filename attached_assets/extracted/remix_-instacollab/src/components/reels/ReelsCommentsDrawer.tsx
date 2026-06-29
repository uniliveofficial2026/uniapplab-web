import React from 'react';
import { Heart, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { Reel, User } from '../../types';
import { handleAvatarError, openProfilePreview } from '../../lib/utils';
import { resolveCommentAuthor, type CommentLike } from '../../lib/entityResolve';
import { db as localDb } from '../../lib/db';

type ReelsCommentsDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  liveReel: Reel;
  localComments: CommentLike[];
  db: typeof localDb;
  USERS: User[];
  commentText: string;
  onCommentTextChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
};

export function ReelsCommentsDrawer({
  isOpen,
  onClose,
  liveReel,
  localComments,
  db,
  USERS,
  commentText,
  onCommentTextChange,
  onSubmit,
}: ReelsCommentsDrawerProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-md z-[90] md:mx-auto md:max-w-[470px]"
          />
          <motion.div
            id="reels-comments-drawer"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-x-0 bottom-0 h-[65vh] md:max-h-[500px] bg-card rounded-t-3xl z-[100] flex flex-col border-t border-border shadow-[0_-10px_40px_rgba(0,0,0,0.5)] pb-safe md:mx-auto md:max-w-[470px] w-full"
          >
            <div className="h-12 border-b border-border flex items-center justify-between px-4 shrink-0">
              <div className="w-8"></div>
              <h3 className="font-bold text-base">{liveReel.comments} Comments</h3>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-secondary transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {localComments.map((comment: CommentLike, i: number) => {
                const commentAuthor = resolveCommentAuthor(db.users, comment, db.currentUser);
                return (
                  <div key={'local-' + i} className="flex gap-3">
                    <img
                      src={commentAuthor.avatarUrl || undefined}
                      onError={handleAvatarError}
                      className="w-9 h-9 rounded-full object-cover shrink-0 border border-border cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => {
                        openProfilePreview(commentAuthor);
                      }}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className="font-bold text-sm cursor-pointer hover:underline"
                          onClick={() => {
                            openProfilePreview(commentAuthor);
                          }}
                        >
                          {commentAuthor.username}
                        </span>
                        <span className="text-xs text-muted-foreground font-medium">just now</span>
                      </div>
                      <p className="text-sm mt-0.5 leading-snug">{comment.text}</p>
                      <div className="mt-1 flex items-center gap-4 text-xs font-bold text-muted-foreground">
                        <button
                          onClick={() => {
                            onCommentTextChange(`@${commentAuthor.username} `);
                            document
                              .querySelector<HTMLInputElement>('input[placeholder="Add a comment..."]')
                              ?.focus();
                          }}
                          className="hover:text-foreground"
                        >
                          Reply
                        </button>
                      </div>
                    </div>
                    <button className="ml-auto flex items-start p-1">
                      <Heart className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </div>
                );
              })}
              {USERS.length > 0 &&
                [1, 2, 3, 4, 5].map((i) => (
                  <div key={'fake-comment-' + i} className="flex gap-3">
                    <img
                      src={USERS[i % USERS.length]?.avatarUrl || undefined}
                      onError={handleAvatarError}
                      className="w-9 h-9 rounded-full object-cover shrink-0 border border-border cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => openProfilePreview(USERS[i % USERS.length])}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className="font-bold text-sm cursor-pointer hover:underline"
                          onClick={() => openProfilePreview(USERS[i % USERS.length])}
                        >
                          {USERS[i % USERS.length]?.username}
                        </span>
                        <span className="text-xs text-muted-foreground font-medium">{i}h</span>
                      </div>
                      <p className="text-sm mt-0.5 leading-snug">
                        This is an amazing reel! Keep up the great work 🔥
                      </p>
                      <div className="mt-1 flex items-center gap-4 text-xs font-bold text-muted-foreground">
                        <button
                          onClick={() => {
                            onCommentTextChange(`@${USERS[i % USERS.length]?.username} `);
                            document
                              .querySelector<HTMLInputElement>('input[placeholder="Add a comment..."]')
                              ?.focus();
                          }}
                          className="hover:text-foreground"
                        >
                          Reply
                        </button>
                      </div>
                    </div>
                    <button className="ml-auto flex items-start p-1">
                      <Heart className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </div>
                ))}
            </div>
            <form
              onSubmit={onSubmit}
              className="p-4 border-t border-border shrink-0 bg-card flex gap-3 items-center"
            >
              <img
                src={db?.currentUser?.avatarUrl || undefined}
                className="w-9 h-9 rounded-full object-cover shrink-0 border border-border"
                onError={handleAvatarError}
              />
              <div className="flex-1 bg-secondary rounded-full flex items-center px-4 py-2 border border-border focus-within:border-primary/50 transition-colors">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => onCommentTextChange(e.target.value)}
                  placeholder="Add a comment..."
                  className="w-full bg-transparent border-none outline-none text-sm font-medium"
                />
              </div>
              <button
                type="submit"
                className="text-primary font-bold text-sm bg-primary/10 px-4 py-2 rounded-full hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50"
                disabled={!commentText.trim()}
              >
                Post
              </button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
