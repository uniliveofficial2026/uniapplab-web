import React, { useMemo } from 'react';
import { Flame, UserPlus } from 'lucide-react';
import { useDB } from '../../lib/useDB';
import { resolveUser } from '../../lib/safe';
import { handleAvatarError } from '../../lib/utils';
import { LaunchPrimaryButton, LaunchShell } from './launchUi';

export function TrendingScreen() {
  const db = useDB();
  const meId = db.currentUserId;

  const trendingPosts = useMemo(
    () => [...db.posts].sort((a, b) => (b.likes || 0) - (a.likes || 0)).slice(0, 6),
    [db.posts]
  );

  const trendingUsers = useMemo(
    () =>
      db.users
        .filter((u) => u.id !== meId)
        .sort((a, b) => (b.followers || 0) - (a.followers || 0))
        .slice(0, 8),
    [db.users, meId]
  );

  const finish = () => db.markTrendingSeen();

  return (
    <LaunchShell className="overflow-y-auto">
      <div className="p-6 pb-4">
        <div className="flex items-center gap-2 text-accent">
          <Flame className="h-6 w-6" />
          <h1 className="text-2xl font-black">Trending now</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Follow a few accounts and see what is popular before your home feed.
        </p>
      </div>

      <div className="px-6 pb-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
          Creators
        </h2>
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
          {trendingUsers.map((user) => {
            const resolved = resolveUser(db.users, user);
            const following = !!resolved.isFollowing;
            return (
              <div
                key={user.id}
                className="shrink-0 w-28 rounded-2xl border border-border bg-card/80 p-3 flex flex-col items-center text-center"
              >
                <div className="h-14 w-14 rounded-full overflow-hidden mb-2">
                  <img
                    src={resolved.avatarUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={handleAvatarError}
                  />
                </div>
                <span className="text-xs font-bold truncate w-full">{resolved.username}</span>
                <button
                  type="button"
                  onClick={() => db.toggleFollow(user.id)}
                  className={`mt-2 w-full py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 ${
                    following
                      ? 'bg-secondary text-foreground'
                      : 'bg-primary text-primary-foreground'
                  }`}
                >
                  <UserPlus className="h-3 w-3" />
                  {following ? 'Following' : 'Follow'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-6 py-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
          Popular posts
        </h2>
        <div className="grid grid-cols-3 gap-1.5 rounded-2xl overflow-hidden">
          {trendingPosts.map((post) => (
            <div key={post.id} className="aspect-square relative bg-secondary">
              <img
                src={post.imageUrl}
                alt=""
                className="h-full w-full object-cover"
                onError={handleAvatarError}
              />
              <span className="absolute bottom-1 left-1 text-[10px] font-bold text-white drop-shadow">
                {post.likes} ♥
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="p-6 pt-2 mt-auto sticky bottom-0 bg-background/90 backdrop-blur border-t border-border">
        <LaunchPrimaryButton onClick={finish}>Enter InstaCollab</LaunchPrimaryButton>
      </div>
    </LaunchShell>
  );
}
