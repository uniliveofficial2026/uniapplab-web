import React, { useMemo } from 'react';
import { Flame } from 'lucide-react';
import { useDB } from '../../lib/useDB';
import { resolveUser } from '../../lib/safe';
import { LaunchPrimaryButton } from './launchUi';
import { APP_DISPLAY_NAME } from '../../lib/appBrand';
import {
  UniLivesCreatorCard,
  UniLivesDiscoveryHeader,
  UniLivesDiscoveryShell,
  UniLivesPostCardFrame,
} from '../discovery/brand';

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
    <UniLivesDiscoveryShell surface="trending" className="overflow-y-auto">
      <div className="p-6 pb-4">
        <UniLivesDiscoveryHeader
          icon={<Flame className="h-6 w-6" />}
          title="Trending now"
          subtitle="Follow a few accounts and see what is popular before your home feed."
        />
      </div>

      <div className="px-6 pb-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[color:var(--color-unilives-discovery-muted)] mb-3">
          Creators
        </h2>
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
          {trendingUsers.map((user) => {
            const resolved = resolveUser(db.users, user);
            const following = !!resolved.isFollowing;
            return (
              <UniLivesCreatorCard
                key={user.id}
                userId={user.id}
                username={resolved.username}
                avatarUrl={resolved.avatarUrl}
                following={following}
                onFollowClick={() => db.toggleFollow(user.id)}
              />
            );
          })}
        </div>
      </div>

      <div className="px-6 py-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[color:var(--color-unilives-discovery-muted)] mb-3">
          Popular posts
        </h2>
        <div className="grid grid-cols-3 gap-1.5 rounded-2xl overflow-hidden">
          {trendingPosts.map((post) => (
            <UniLivesPostCardFrame
              key={post.id}
              postId={post.id}
              imageUrl={post.imageUrl}
              likesLabel={`${post.likes} ♥`}
            />
          ))}
        </div>
      </div>

      <div className="p-6 pt-2 mt-auto sticky bottom-0 bg-[color:var(--color-unilives-discovery-background)]/90 backdrop-blur border-t border-[color:var(--color-unilives-discovery-border)]">
        <LaunchPrimaryButton tone="onboarding" onClick={finish}>
          Enter {APP_DISPLAY_NAME}
        </LaunchPrimaryButton>
      </div>
    </UniLivesDiscoveryShell>
  );
}
