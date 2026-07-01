import React, { useState, useRef, useEffect } from 'react';
import { Radio } from 'lucide-react';
import { useDB, useDbRevision } from '../../lib/useDB';
import { nativeVideoControlGuardProps } from '../../lib/nativeVideoControls';
import { Avatar } from '../common/Avatar';
import { ProfileNameLines } from '../common/ProfileNameLines';
import { LIVE_KIND_LABELS } from '../../lib/liveRing';
import type { LiveKind, User } from '../../types';
import { openProfilePreview } from '../../lib/utils';
import { resolveUser } from '../../lib/safe';
import { usePlatformStream } from '../../lib/live/platformStream';
import { isPlatformApiAvailable } from '../../lib/platformApi';

const LIVE_KIND_OPTIONS: LiveKind[] = [
  'solo',
  'audio-room',
  'video-multi',
  'pk',
  'commerce',
  'game',
];

export function LiveScreen() {
  const db = useDB();
  useDbRevision();
  const me = resolveUser(db.users, db.currentUser);
  const platformStream = usePlatformStream();
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const [platformBusy, setPlatformBusy] = useState(false);
  const liveUsers = db.users.filter(
    (u: User) => u.status === 'live' && u.id !== me.id
  );
  const isLive = me.status === 'live' || Boolean(platformStream.streamId);

  const startLive = (kind: LiveKind) => {
    if (!me.id) return;
    db.setUserLiveStatus(me.id, true, kind);
    if (isPlatformApiAvailable() && (me.role === 'streamer' || me.role === 'admin')) {
      setPlatformBusy(true);
      void platformStream.goLive(LIVE_KIND_LABELS[kind]).finally(() => setPlatformBusy(false));
    }
  };

  const endLive = () => {
    if (!me?.id) return;
    db.setUserLiveStatus(me.id, false);
    void platformStream.endLive();
  };

  useEffect(() => {
    const el = previewVideoRef.current;
    if (!el) return;
    el.srcObject = platformStream.localStream;
  }, [platformStream.localStream]);

  return (
    <div className="flex flex-col h-full w-full max-w-[600px] mx-auto px-4 py-6 md:py-10 gap-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground mb-1">Live</h2>
        <p className="text-sm text-muted-foreground">
          Go live or watch creators streaming now. Followers get notified when you start.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Your stream
        </p>
        {isLive ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="relative flex h-3 w-3 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
              </span>
              <div className="min-w-0">
                <p className="font-bold text-foreground truncate">
                  You are live
                  {me?.liveKind
                    ? ` · ${LIVE_KIND_LABELS[me.liveKind]}`
                    : ''}
                </p>
                <p className="text-xs text-muted-foreground">
                  {platformStream.streamId ? 'Platform stream active (WebRTC MVP).' : 'Followers were notified. End live when you are done.'}
                </p>
              </div>
            </div>
            {platformStream.localStream ? (
              <video
                autoPlay
                muted
                playsInline
                controls
                ref={previewVideoRef}
                className="w-full sm:w-40 aspect-video rounded-lg border border-border object-cover"
                {...nativeVideoControlGuardProps()}
              />
            ) : null}
            <button
              type="button"
              onClick={endLive}
              disabled={platformBusy}
              className="shrink-0 px-4 py-2 rounded-lg bg-destructive text-destructive-foreground font-bold text-sm hover:bg-destructive/90 transition-colors disabled:opacity-50"
            >
              End live
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Pick a format and start broadcasting.
            </p>
            <div className="flex flex-wrap gap-2">
              {LIVE_KIND_OPTIONS.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => startLive(kind)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1.5 text-xs font-semibold hover:border-primary/40 hover:bg-primary/10 transition-colors"
                >
                  <Radio className="w-3.5 h-3.5 text-red-500" />
                  {LIVE_KIND_LABELS[kind]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
          Live now ({liveUsers.length})
        </p>
        {liveUsers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-12 text-center text-muted-foreground text-sm">
            No one is live right now. Check back from the home story ring.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {liveUsers.map((user: User) => (
              <button
                key={user.id}
                type="button"
                onClick={() => openProfilePreview(user)}
                className="flex items-center gap-3 p-3 rounded-2xl border border-border bg-card hover:bg-secondary/50 transition-colors text-left"
              >
                <Avatar user={user} size="md" />
                <div className="flex flex-col min-w-0 flex-1">
                  <ProfileNameLines
                    user={user}
                    primaryClassName="font-bold truncate w-full text-left"
                    secondaryClassName="text-xs text-muted-foreground truncate w-full text-left"
                  />
                  <span className="text-xs text-muted-foreground">
                    {user.liveKind
                      ? `${LIVE_KIND_LABELS[user.liveKind]} live`
                      : 'Live'}
                  </span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wide text-red-500 shrink-0">
                  LIVE
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
