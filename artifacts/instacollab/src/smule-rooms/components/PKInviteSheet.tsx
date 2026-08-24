import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronRight,
  Clock3,
  Loader2,
  Search,
  ShoppingBag,
  Shuffle,
  Signal,
  Swords,
  Users,
  Video,
  X,
} from 'lucide-react';
import { safeAvatarUrl } from '../../lib/safe';
import type { TeamPkRosterMember } from '../../lib/live/teamPkRosterRegistry';
import type { PkLiveHost } from '../hooks/usePkLiveHosts';
import { pickRandomPkLiveHost } from '../hooks/usePkLiveHosts';
import type { PKMode } from '../utils/liveRoomTypes';
import {
  filterPkLiveHostsByFollow,
  pkInviteFollowFilterLabel,
  searchPkLiveHosts,
  type PkInviteFollowFilter,
} from '../utils/pkInviteSearch';
import { canPkMatchRoomModes } from '../utils/pkBattleLayout';
import './pk-invite-sheet.css';

export type PKMatchType = 'invite' | 'random';
export type PkSetupType = '1v1' | '2v2' | '3v3' | '4v4' | '6v6' | 'live-sell';
export type PkPanelStage = 'setup' | 'invite' | 'duration' | 'random-filters' | 'confirm';
export type PkDurationSec = 60 | 180 | 300 | 420 | 600 | number;

export type PKConnectOptions = {
  mode: PKMode;
  matchType: PKMatchType;
  opponentUserId: string;
  opponentName: string;
  opponentAvatar?: string;
  opponentRoomId?: string;
  teamSize?: 2 | 3 | 4 | 6;
  /** Host-selected round duration. Must be sent to the canonical challenge API. */
  durationSec: number;
  /** Commerce mode uses the same canonical 1v1 PK session; this flag only selects presentation/integration. */
  liveSell?: boolean;
};

export type PKInviteSheetProps = {
  open: boolean;
  onClose: () => void;
  liveHosts: PkLiveHost[];
  liveHostsLoading?: boolean;
  liveHostsError?: string | null;
  onRefreshHosts?: () => void;
  selfUserId: string;
  selfName?: string;
  selfAvatar?: string;
  currentTeamMembers?: TeamPkRosterMember[];
  connecting?: boolean;
  connectedOpponentName?: string | null;
  isCommerceLive?: boolean;
  commerceProductTitle?: string | null;
  commerceProductPrice?: string | null;
  onConnect: (options: PKConnectOptions) => void;
  onDisconnect?: () => void;
};

const FOLLOW_FILTERS: PkInviteFollowFilter[] = ['all', 'following', 'followers'];
const PRESET_DURATIONS = [60, 180, 300, 420, 600] as const;
const TEAM_SIZE: Record<Exclude<PkSetupType, '1v1' | 'live-sell'>, 2 | 3 | 4 | 6> = {
  '2v2': 2,
  '3v3': 3,
  '4v4': 4,
  '6v6': 6,
};
const DEFAULT_DURATION: Record<PkSetupType, number> = {
  '1v1': 180,
  '2v2': 300,
  '3v3': 300,
  '4v4': 420,
  '6v6': 600,
  'live-sell': 180,
};

function formatDuration(sec: number) {
  const minutes = Math.max(1, Math.round(sec / 60));
  return `${minutes} min`;
}

function SignalBars() {
  return <span className="pkx-signal-bars" aria-hidden="true"><i /><i /><i /><i /></span>;
}

function HostAvatar({ host, className = '' }: { host?: PkLiveHost | null; className?: string }) {
  if (!host) return <span className={`pkx-avatar pkx-avatar-empty ${className}`} aria-hidden="true">+</span>;
  return <img className={`pkx-avatar ${className}`} src={safeAvatarUrl(host.avatar)} alt={`${host.name} avatar`} />;
}

function MemberAvatar({ member, className = '' }: { member?: TeamPkRosterMember | null; className?: string }) {
  if (!member) return <span className={`pkx-avatar pkx-avatar-empty ${className}`} aria-hidden="true">+</span>;
  return member.avatarUrl
    ? <img className={`pkx-avatar ${className}`} src={safeAvatarUrl(member.avatarUrl)} alt={`${member.name} avatar`} />
    : <span className={`pkx-avatar pkx-avatar-letter ${className}`}>{member.name.slice(0, 1).toUpperCase()}</span>;
}

export function PKInviteSheet({
  open,
  onClose,
  liveHosts,
  liveHostsLoading = false,
  liveHostsError = null,
  onRefreshHosts,
  selfUserId,
  selfName = 'You',
  selfAvatar,
  currentTeamMembers = [],
  connecting = false,
  connectedOpponentName = null,
  isCommerceLive = false,
  commerceProductTitle = null,
  commerceProductPrice = null,
  onConnect,
  onDisconnect,
}: PKInviteSheetProps) {
  const [setupType, setSetupType] = useState<PkSetupType>(isCommerceLive ? 'live-sell' : '1v1');
  const [stage, setStage] = useState<PkPanelStage>('setup');
  const [matchType, setMatchType] = useState<PKMatchType>('invite');
  const [durationSec, setDurationSec] = useState(180);
  const [customMinutes, setCustomMinutes] = useState(3);
  const [search, setSearch] = useState('');
  const [followFilter, setFollowFilter] = useState<PkInviteFollowFilter>('all');
  const [selectedOpponentId, setSelectedOpponentId] = useState<string | null>(null);
  const [randomNoMatch, setRandomNoMatch] = useState(false);
  const [randomGender, setRandomGender] = useState('any');
  const [randomRegion, setRandomRegion] = useState('any');
  const [randomLanguage, setRandomLanguage] = useState('any');
  const [randomHostLevel, setRandomHostLevel] = useState('any');
  const [randomStarted, setRandomStarted] = useState(false);
  const actionLockedRef = useRef(false);
  const onRefreshHostsRef = useRef(onRefreshHosts);
  onRefreshHostsRef.current = onRefreshHosts;

  const teamSize = setupType === '2v2' || setupType === '3v3' || setupType === '4v4' || setupType === '6v6'
    ? TEAM_SIZE[setupType]
    : undefined;
  const isTeam = Boolean(teamSize);
  const isLiveSell = setupType === 'live-sell';

  const inviteCandidates = useMemo(
    () =>
      liveHosts.filter((host) => {
        if (host.userId === selfUserId) return false;
        return canPkMatchRoomModes(isCommerceLive ? 'Commerce-Live' : 'Solo-Live', host.roomMode);
      }),
    [isCommerceLive, liveHosts, selfUserId],
  );
  const filteredHosts = useMemo(() => {
    const searched = searchPkLiveHosts(inviteCandidates, search);
    return filterPkLiveHostsByFollow(searched, followFilter);
  }, [followFilter, inviteCandidates, search]);
  const selectedOpponent = inviteCandidates.find((host) => host.userId === selectedOpponentId) ?? null;
  const localRoster = useMemo(() => {
    const self: TeamPkRosterMember = { userId: selfUserId, name: selfName, avatarUrl: selfAvatar };
    const dedup = [self, ...currentTeamMembers].filter((member, index, arr) =>
      member.userId && arr.findIndex((candidate) => candidate.userId === member.userId) === index,
    );
    return dedup.slice(0, teamSize ?? 1);
  }, [currentTeamMembers, selfAvatar, selfName, selfUserId, teamSize]);
  const teamReady = !isTeam || isCommerceLive === false || localRoster.length === teamSize;

  useEffect(() => {
    if (!open) {
      setSetupType(isCommerceLive ? 'live-sell' : '1v1');
      setStage('setup');
      setMatchType('invite');
      setDurationSec(180);
      setCustomMinutes(3);
      setSearch('');
      setFollowFilter('all');
      setRandomGender('any');
      setRandomRegion('any');
      setRandomLanguage('any');
      setRandomHostLevel('any');
      setSelectedOpponentId(null);
      setRandomNoMatch(false);
      setRandomStarted(false);
      actionLockedRef.current = false;
      return;
    }
    onRefreshHostsRef.current?.();
  }, [isCommerceLive, open]);

  useEffect(() => {
    if (!connecting) actionLockedRef.current = false;
  }, [connecting]);

  useEffect(() => {
    setDurationSec(DEFAULT_DURATION[setupType]);
    setCustomMinutes(Math.round(DEFAULT_DURATION[setupType] / 60));
    setSelectedOpponentId(null);
    setRandomNoMatch(false);
    setRandomStarted(false);
    setMatchType('invite');
  }, [setupType]);

  if (!open) return null;

  const sendCanonicalChallenge = (host: PkLiveHost, requestedMatchType = matchType) => {
    if (connecting || actionLockedRef.current) return;
    actionLockedRef.current = true;
    onConnect({
      mode: isTeam ? 'team' : 'single',
      matchType: requestedMatchType,
      opponentUserId: host.userId,
      opponentName: host.name,
      opponentAvatar: host.avatar,
      opponentRoomId: host.roomId,
      teamSize,
      durationSec: Math.max(30, Math.min(3600, Math.floor(durationSec))),
      liveSell: isLiveSell,
    });
  };

  const selectType = (type: PkSetupType) => {
    if (isCommerceLive) return;
    if (type === 'live-sell') return;
    setSetupType(type);
    setStage('setup');
  };

  const startFromSetup = () => {
    if (!teamReady) return;
    setMatchType('invite');
    setStage('invite');
  };

  const chooseHost = (host: PkLiveHost) => {
    setSelectedOpponentId(host.userId);
  };

  const continueFromInvite = () => {
    if (!selectedOpponent) return;
    setStage('confirm');
  };

  const handleRandomStart = () => {
    if (connecting || actionLockedRef.current) return;
    setRandomStarted(true);
    setRandomNoMatch(false);
    setMatchType('random');
    onRefreshHosts?.();
    const pool = filterPkLiveHostsByFollow(inviteCandidates, followFilter);
    const host = pickRandomPkLiveHost(pool.length ? pool : inviteCandidates, selfUserId);
    const filtersNeedMetadata = randomGender !== 'any' || randomRegion !== 'any' || randomLanguage !== 'any' || randomHostLevel !== 'any';
    if (filtersNeedMetadata || !host?.userId || !host.roomId?.trim()) {
      setRandomStarted(false);
      setRandomNoMatch(true);
      return;
    }
    setSelectedOpponentId(host.userId);
    setRandomStarted(false);
    setStage('confirm');
  };

  const renderTypeTabs = () => {
    if (isCommerceLive) return null;
    return (
      <div className="pkx-type-tabs" role="tablist" aria-label="PK setup type">
        {(['1v1', '2v2', '3v3', '4v4', '6v6'] as PkSetupType[]).map((type) => (
          <button key={type} type="button" role="tab" aria-selected={setupType === type} className={setupType === type ? 'is-active' : ''} onClick={() => selectType(type)}>{type}</button>
        ))}
      </div>
    );
  };

  const renderSlots = () => {
    if (!isTeam) return (
      <div className="pkx-versus-single">
        <div className="pkx-single-person">
          <MemberAvatar member={localRoster[0]} className="pkx-setup-avatar" />
          <strong>{selfName}</strong><small>Host</small>
        </div>
        <span className="pkx-vs">VS</span>
        <button type="button" className="pkx-single-person pkx-opponent-slot" onClick={() => setStage('invite')}>
          <HostAvatar host={selectedOpponent} className="pkx-setup-avatar" />
          <strong>{selectedOpponent?.name || 'Select Opponent'}</strong><small>{selectedOpponent ? 'Live host' : 'Tap to invite'}</small>
        </button>
      </div>
    );
    return (
      <div className="pkx-team-setup-grid" aria-label={`${teamSize} versus ${teamSize} team setup`}>
        <div className="pkx-team-column pkx-blue-team">
          <strong>Team Alpha (You)</strong>
          <div className="pkx-roster-slots">
            {Array.from({ length: teamSize! }, (_, index) => <MemberAvatar key={`local-${index}`} member={localRoster[index]} />)}
          </div>
        </div>
        <span className="pkx-vs">VS</span>
        <div className="pkx-team-column pkx-red-team">
          <strong>Team Beta</strong>
          <div className="pkx-roster-slots">
            {Array.from({ length: teamSize! }, (_, index) => index === 0 ? <HostAvatar key="opponent-captain" host={selectedOpponent} /> : <HostAvatar key={`remote-${index}`} />)}
          </div>
        </div>
      </div>
    );
  };

  const renderSetup = () => (
    <section className={`pkx-card pkx-setup-card ${isLiveSell ? 'pkx-card-live-sell' : ''}`} data-ui-id={`live.pk.setup.${setupType}`}>
      {renderTypeTabs()}
      <div className="pkx-title-row"><span />{isLiveSell ? <ShoppingBag aria-hidden="true" /> : isTeam ? <Users aria-hidden="true" /> : <Swords aria-hidden="true" />}<strong>{isLiveSell ? 'Live Sell PK' : isTeam ? `${teamSize}v${teamSize} Team PK` : '1v1 PK Challenge'}</strong><span /></div>
      {renderSlots()}
      <button type="button" className="pkx-duration-trigger" data-ui-id="live.pk.duration.open" onClick={() => setStage('duration')}>
        <Clock3 aria-hidden="true" /><span>PK Duration</span><strong>{formatDuration(durationSec)}</strong><ChevronRight aria-hidden="true" />
      </button>
      <div className="pkx-facts">
        <div><i className="pkx-fact-icon pkx-fact-purple">{isLiveSell ? <ShoppingBag aria-hidden="true" /> : isTeam ? <Users aria-hidden="true" /> : <Video aria-hidden="true" />}</i><span>{isLiveSell ? 'Live Selling PK' : isTeam ? `${teamSize}v${teamSize} Team PK` : '1v1 Video PK'}</span></div>
        <div><i className="pkx-fact-icon pkx-fact-green"><SignalBars /></i><span>Stable connection</span></div>
        <div><i className="pkx-fact-icon pkx-fact-pink"><Signal aria-hidden="true" /></i><span>Real-time score</span></div>
      </div>
      {isTeam && isCommerceLive && !teamReady ? <div className="pkx-notice">Your current live-room Team PK roster has {localRoster.length}/{teamSize} members. Fill/seated team slots before sending this challenge.</div> : null}
      {isTeam && !isCommerceLive ? <div className="pkx-notice">Solo Live {teamSize}v{teamSize} starts with you as captain. Empty teammate slots stay open during PK.</div> : null}
      {isLiveSell ? <div className="pkx-commerce-mini"><ShoppingBag aria-hidden="true" /><div><strong>{commerceProductTitle || 'Live products stay active'}</strong><small>{commerceProductPrice || 'Products continue during PK.'}</small></div></div> : null}
      <div className="pkx-setup-actions">
        <button type="button" className="pkx-primary" disabled={connecting || !teamReady} onClick={startFromSetup}>{connecting ? 'Connecting…' : 'Start PK'}</button>
        <button type="button" className="pkx-secondary pkx-random-entry" onClick={() => setStage('random-filters')}><Shuffle aria-hidden="true" /> Random Match</button>
      </div>
    </section>
  );

  const renderInvite = () => (
    <section className="pkx-card pkx-invite-card" data-ui-id="live.pk.invite.panel">
      <div className="pkx-panel-head"><button type="button" onClick={() => setStage('setup')}>‹</button><strong>{isTeam ? 'Invite Team' : 'Invite to PK'}</strong><button type="button" aria-label="Close" onClick={onClose}><X aria-hidden="true" /></button></div>
      <div className="pkx-filter-row">
        {FOLLOW_FILTERS.map((filter) => <button key={filter} type="button" className={followFilter === filter ? 'is-active' : ''} onClick={() => setFollowFilter(filter)}>{pkInviteFollowFilterLabel(filter)}</button>)}
      </div>
      <div className="pkx-search-wrap"><Search aria-hidden="true" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or ID…" aria-label="Search live hosts" /></div>
      <div className="pkx-host-list">
        {liveHostsLoading && filteredHosts.length === 0 ? <div className="pkx-empty"><Loader2 className="pkx-spin" aria-hidden="true" /> Loading live hosts…</div> : filteredHosts.length ? filteredHosts.map((host) => {
          const active = selectedOpponentId === host.userId;
          return <button key={`${host.userId}-${host.roomId}`} type="button" className={`pkx-host-row ${active ? 'is-selected' : ''}`} data-ui-id="live.pk.invite.host" data-pk-host-user-id={host.userId} data-pk-host-room-id={host.roomId} onClick={() => chooseHost(host)}><HostAvatar host={host} /><span className="pkx-host-copy"><strong>{host.name}</strong><small>@{host.username} · {host.roomTitle}</small></span><span className="pkx-host-status">{active ? <Check aria-hidden="true" /> : 'Invite'}</span></button>;
        }) : <div className="pkx-empty">{liveHostsError || 'No eligible live hosts are available right now.'}</div>}
      </div>
      <button type="button" className="pkx-primary" disabled={!selectedOpponent || connecting} onClick={continueFromInvite}>{isTeam ? 'Continue with Team' : 'Continue'}</button>
      <button type="button" className="pkx-secondary" onClick={() => setStage('setup')}>Cancel</button>
    </section>
  );

  const renderDuration = () => (
    <section className="pkx-card pkx-duration-card" data-ui-id="live.pk.duration.panel">
      <div className="pkx-panel-head"><span /><strong>Choose PK Duration</strong><button type="button" aria-label="Close" onClick={() => setStage('setup')}><X aria-hidden="true" /></button></div>
      <div className="pkx-duration-options">
        {PRESET_DURATIONS.map((sec) => <button key={sec} type="button" className={durationSec === sec ? 'is-active' : ''} onClick={() => { setDurationSec(sec); setCustomMinutes(sec / 60); }}><span>{formatDuration(sec)}</span>{sec === 180 ? <small>Recommended</small> : null}{durationSec === sec ? <Check aria-hidden="true" /> : null}</button>)}
        <div className={`pkx-custom-duration ${!PRESET_DURATIONS.some((sec) => sec === durationSec) ? 'is-active' : ''}`}><span>Custom</span><button type="button" aria-label="Decrease custom PK duration" onClick={() => setCustomMinutes((m) => { const next = Math.max(1, m - 1); setDurationSec(next * 60); return next; })}>−</button><strong>{customMinutes}</strong><button type="button" aria-label="Increase custom PK duration" onClick={() => setCustomMinutes((m) => { const next = Math.min(60, m + 1); setDurationSec(next * 60); return next; })}>+</button><small>min</small></div>
      </div>
      <button type="button" className="pkx-primary" onClick={() => setStage('setup')}>Confirm</button>
      <button type="button" className="pkx-secondary" onClick={() => setStage('setup')}>Cancel</button>
      <p className="pkx-footnote">PK duration cannot be changed after the challenge is accepted.</p>
    </section>
  );

  const renderRandomFilters = () => (
    <section className="pkx-card pkx-random-card" data-ui-id="live.pk.random.filters">
      <div className="pkx-title-row"><span /><Shuffle aria-hidden="true" /><strong>{isLiveSell ? 'Random Live Sell PK' : 'Random PK Match'}</strong><span /></div>
      <h3>Find a live host instantly</h3><p className="pkx-subcopy">{isLiveSell ? 'Match a live host. Products stay active during PK.' : 'Match only against real currently available PK hosts.'}</p>
      <div className="pkx-random-meta">
        <label>Gender Preference<select value={randomGender} onChange={(e) => setRandomGender(e.target.value)}><option value="any">Any</option><option value="female">Female</option><option value="male">Male</option></select></label>
        <label>Region<select value={randomRegion} onChange={(e) => setRandomRegion(e.target.value)}><option value="any">Any</option><option value="na">North America</option><option value="eu">Europe</option><option value="asia">Asia</option></select></label>
        <label>Language<select value={randomLanguage} onChange={(e) => setRandomLanguage(e.target.value)}><option value="any">Any</option><option value="en">English</option><option value="es">Spanish</option><option value="zh">Chinese</option></select></label>
        <label>Host Level<select value={randomHostLevel} onChange={(e) => setRandomHostLevel(e.target.value)}><option value="any">Any</option><option value="new">New</option><option value="rising">Rising</option><option value="pro">Pro</option></select></label>
      </div>
      <button type="button" className="pkx-duration-trigger" onClick={() => setStage('duration')}><Clock3 aria-hidden="true" /><span>PK Duration</span><strong>{formatDuration(durationSec)}</strong><ChevronRight aria-hidden="true" /></button>
      <div className="pkx-filter-row pkx-random-follow">{FOLLOW_FILTERS.map((filter) => <button key={filter} type="button" className={followFilter === filter ? 'is-active' : ''} onClick={() => setFollowFilter(filter)}>{pkInviteFollowFilterLabel(filter)}</button>)}</div>
      <div className="pkx-facts"><div><i className="pkx-fact-icon pkx-fact-purple">{isLiveSell ? <ShoppingBag aria-hidden="true" /> : isTeam ? <Users aria-hidden="true" /> : <Video aria-hidden="true" />}</i><span>{isLiveSell ? 'Live Selling PK' : isTeam ? `${teamSize}v${teamSize} Team PK` : '1v1 Video PK'}</span></div><div><i className="pkx-fact-icon pkx-fact-pink"><Clock3 aria-hidden="true" /></i><span>{formatDuration(durationSec)} round</span></div><div><i className="pkx-fact-icon pkx-fact-green"><SignalBars /></i><span>Stable connection</span></div></div>
      {randomNoMatch ? <div className="pkx-notice">No real live host is available for the selected relationship filter. No simulated rival will be created.</div> : null}
      <button type="button" className="pkx-primary" disabled={connecting || randomStarted} onClick={handleRandomStart}>{randomStarted ? <><Loader2 className="pkx-spin" aria-hidden="true" /> Matching…</> : 'Start Matching'}</button>
      <button type="button" className="pkx-secondary" onClick={() => setStage('setup')}>Cancel</button>
    </section>
  );

  const renderConfirm = () => (
    <section className="pkx-card pkx-confirm-card" data-ui-id="live.pk.confirm.panel">
      <div className="pkx-panel-head"><button type="button" onClick={() => setStage('invite')}>‹</button><strong>Confirm PK</strong><button type="button" aria-label="Close" onClick={onClose}><X aria-hidden="true" /></button></div>
      <div className="pkx-confirm-versus"><MemberAvatar member={localRoster[0]} /><span className="pkx-vs">VS</span><HostAvatar host={selectedOpponent} /></div>
      <div className="pkx-confirm-names"><strong>{selfName}</strong><strong>{selectedOpponent?.name || 'Rival'}</strong></div>
      <dl className="pkx-summary"><div><dt>PK Type</dt><dd>{isLiveSell ? 'Live Sell 1v1' : isTeam ? `${teamSize}v${teamSize} Team PK` : '1v1 Video PK'}</dd></div><div><dt>Duration</dt><dd>{formatDuration(durationSec)}</dd></div><div><dt>Team</dt><dd>{isTeam ? `${teamSize} per side` : 'No'}</dd></div><div><dt>Connection</dt><dd className="pkx-green">Stable</dd></div></dl>
      <button type="button" className="pkx-primary" disabled={!selectedOpponent || connecting || !teamReady} onClick={() => selectedOpponent && sendCanonicalChallenge(selectedOpponent)}>{connecting ? 'Sending…' : 'Send Challenge'}</button>
      <button type="button" className="pkx-secondary" onClick={() => setStage('setup')}>Cancel</button>
    </section>
  );

  return (
    <div className="pkx-overlay" data-ui-id="live.pk.setup.overlay">
      <button type="button" className="pkx-dismiss-layer" aria-label="Close PK panel" onClick={onClose} />
      <div className="pkx-shell" role="dialog" aria-modal="true" aria-label="PK setup">
        <span className="pkx-sheet-handle" aria-hidden="true" />
        {connectedOpponentName ? <section className="pkx-card pkx-connected-card"><div className="pkx-title-row"><span /><Signal aria-hidden="true" /><strong>PK Connected</strong><span /></div><h3>{connectedOpponentName}</h3><p className="pkx-subcopy">The canonical PK session is active.</p>{onDisconnect ? <button type="button" className="pkx-secondary" onClick={onDisconnect}>Disconnect</button> : null}</section> : stage === 'setup' ? renderSetup() : stage === 'invite' ? renderInvite() : stage === 'duration' ? renderDuration() : stage === 'random-filters' ? renderRandomFilters() : renderConfirm()}
      </div>
    </div>
  );
}
