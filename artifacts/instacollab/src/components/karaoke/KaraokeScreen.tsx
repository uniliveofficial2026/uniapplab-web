import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, Mic2, MicVocal, Search, TrendingUp, Music, Users, Play, Star, ChevronRight, Video, Gift, Trophy, Crown, Heart, MessageCircle, Bell, Coins, X, ArrowLeft, Edit, Save, Plus, Trash2, Sparkles, Camera, Info, Bookmark, MoreHorizontal, Clock, ChevronLeft, SkipBack, SkipForward, Upload, Sun, Moon, Menu, ImagePlus, UserRound, UserPen, UserPlus, UserCheck, UserMinus, UserX } from 'lucide-react';
import { ShareIcon } from '../common/ShareIcon';
import { saveRoomSettings } from '../../smule-rooms/utils/storage';
import { RecordingStudio } from './RecordingStudio';
import { PartyRoomIcon } from '../common/KaraokeNavIcons';
import { ChallengeView } from './ChallengeView';
import { LeaderboardView } from './LeaderboardView';
import { SongUpload } from './SongUpload';
import { KaraokeMyUploadsPanel } from './KaraokeMyUploadsPanel';
import { KaraokeProfileBackground } from './KaraokeProfileBackground';
import { KaraokeProfileBackgroundEditor } from './KaraokeProfileBackgroundEditor';
import type { KaraokeDuetPost, KaraokeLibrarySong } from './karaokeTypes';
import { KaraokeSmuleRoomFlow } from './KaraokeSmuleRoomFlow';
import { SavedRoomsList } from '../../smule-rooms/components/SavedRoomsList';
import { ManagedRoomsList } from '../../smule-rooms/components/ManagedRoomsList';
import { activateRoomContext, clearActiveRoomSession, type ManagedRoom } from '../../smule-rooms/utils/managedRooms';
import type { RoomFlowEntry } from '../../smule-rooms/context/RoomFlowContext';
import { ensureRoomSettingsSeeded } from '../../smule-rooms/utils/storage';
import { ensureRoomRoleUserIds } from '../../smule-rooms/utils/roomRoleUsers';
import { formatRoomHostMeta, resolveRoomHostDisplay } from '../../smule-rooms/utils/roomHostDisplay';
import { formatProfileHandle, getProfileDisplayName } from '../../lib/profileDisplay';
import { getFollowButtonHoverLabel } from '../../lib/followPrivacy';
import {
  getOptionsMenuItemClass,
  optionsMenuItemPointerHandlers,
  useOptionsMenuHover,
} from '../../lib/optionsMenu';
import { useProfileStats } from '../../lib/useProfileStats';
import { FollowListModal } from '../profile/FollowListModal';
import { ShareModal } from '../feed/ShareModal';
import { MessagesScreen } from '../messages/MessagesScreen';
import { NotificationsScreen } from '../notifications/NotificationsScreen';
import { buildContextualProfileSharePayload } from '../../lib/profileShare';
import { buildKaraokeTrackSharePayload, type SharePayload } from '../../lib/shareLinks';
import {
  openedKaraokeProfileFromMainApp,
  registerKaraokeTabGetter,
  type KaraokeProfileReturnContext,
} from '../../lib/karaokeReturnContext';
import { openAppProfileSurface } from '../../lib/profileSurface';
import { resolveCanonicalAppUserId } from '../../lib/profileIdentity';
import type { User } from '../../types';
import { useDB, useDbRevision } from '../../lib/useDB';
import { useCurrentUser } from '../../lib/useCurrentUser';
import { useAuth } from '../../lib/AuthContext';
import { useCloudAuth } from '../../contexts/CloudAuthContext';
import { isCloudAuthConfigured } from '../../lib/auth/config';
import { AccountSwitcherModal } from '../profile/AccountSwitcherModal';
import { reconcileWalletAndKstarCoins } from '../../lib/walletKstarSync';
import {
  addKstarCoins,
  ensureKstarUserStateMigrated,
  getKstarCoins,
  isKstarVip,
  spendKstarCoins,
} from '../../lib/kstarUserState';
import { scheduleCloudProfileSync } from '../../lib/auth/cloudProfile';
import { compressAvatarDataUrl } from '../../lib/auth/cloudAvatar';
import { safeAvatarUrl, safeUsername } from '../../lib/safe';
import { fileToBase64, handleAvatarError, resolveAvatarSrc } from '../../lib/utils';
import {
  deleteKaraokeUpload,
  hydrateKaraokeUploadsFromCloud,
  listKaraokeUploads,
  listKaraokeUploadsForUser,
  metaToLibrarySong,
  saveKaraokeUpload,
  type KaraokeUploadInput,
  type KaraokeUploadedSongMeta,
} from '../../lib/karaokeUploads';
import {
  isKaraokeTab,
  karaokeSearchHitBadgeLabel,
  parseKaraokeUrlParams,
  resolveKaraokeTrackRef,
  searchKaraokeAll,
  syncKaraokeUrl,
  buildKaraokeShareUrl,
  KARAOKE_STUDIO_OPEN_EVENT,
  type KaraokeSearchHit,
  type KaraokeProfileTab,
  type KaraokeUrlParams,
} from '../../lib/karaokeSearch';
import { dispatchTapRefresh, TAP_REFRESH_EVENT } from '../../lib/appRefresh';
import { navTapButtonClass, navTapIconButtonClass, navTapRowButtonClass } from '../../lib/navTap';
import {
  activeLyricIndexForTime,
  enrichUploadedKaraokeSong,
  isUploadedVideoTrack,
  lyricsLinesFromUpload,
  studioLyricsFromUpload,
} from '../../lib/karaokeUploadSession';
import {
  formatRecordingAge,
  formatRecordingCount,
  incrementKaraokeCoverRecordingPlays,
  isCoverRecordingVideo,
  listKaraokeCoverRecordings,
  listKaraokeCoverRecordingsForUser,
  listUserCoverCards,
  coverRecordingToUserCard,
  performanceTypeLabel,
  resolveKaraokeCoverRecordingUrl,
  revokeKaraokeCoverRecordingUrl,
  type KaraokeCoverRecordingMeta,
  type KaraokeUserCoverCard,
} from '../../lib/karaokeRecordings';
import {
  getKaraokeProfileBackground,
  readKaraokeProfileBackgroundFile,
  setKaraokeProfileBackground,
  discardUnsavedKaraokeProfileBackgroundDraft,
  KARAOKE_PROFILE_BACKGROUND_ACCEPT,
  type KaraokeProfileBackground as KaraokeProfileBackgroundRecord,
  type KaraokeProfileBackgroundFocus,
  type KaraokeProfileBackgroundMediaKind,
} from '../../lib/karaokeProfileBackground';

type KaraokeSelectedProfile = {
  userId?: string | null;
  name: string;
  handle: string;
  avatar: string;
  description: string;
  backgroundUrl?: string | null;
  backgroundMediaId?: string | null;
  backgroundMimeType?: string;
  backgroundMediaKind?: KaraokeProfileBackgroundMediaKind;
  backgroundFocus?: KaraokeProfileBackgroundFocus | null;
  followers?: string;
  likes?: string;
  gifts?: string;
  vip?: boolean;
};

function karaokeProfileBackgroundForUser(userId: string | null | undefined) {
  if (!userId) return null;
  const background = getKaraokeProfileBackground(userId);
  if (!background) return null;
  return {
    backgroundUrl: background.url,
    backgroundMediaId: background.mediaId ?? null,
    backgroundMimeType: background.mimeType,
    backgroundMediaKind: background.mediaKind,
    backgroundFocus: background.focus ?? null,
  };
}

function resolveUserIdFromKaraokeHandle(handle: string, users: User[]): string | null {
  const clean = handle.replace(/^@/, '').toLowerCase();
  return users.find((u) => u.username?.toLowerCase() === clean)?.id ?? null;
}

function karaokeAvatarSrc(avatar: string | null | undefined, seed: string): string {
  const resolved = resolveAvatarSrc(avatar || '');
  if (resolved && resolved !== '/favicon.svg') return resolved;
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}`;
}

function buildKaraokeProfileFromDbUser(user: User): KaraokeSelectedProfile {
  const background = karaokeProfileBackgroundForUser(user.id);
  return {
    userId: user.id,
    name: getProfileDisplayName(user),
    handle: formatProfileHandle(user) || `@${user.username}`,
    avatar: karaokeAvatarSrc(user.avatarUrl, user.id),
    description: user.bio?.trim() || '',
    ...background,
  };
}

function buildKaraokeProfileFromHandle(
  handle: string,
  users: User[],
): KaraokeSelectedProfile {
  const cleanedHandle = handle.startsWith('@') ? handle : `@${handle}`;
  const userId = resolveUserIdFromKaraokeHandle(cleanedHandle, users);
  if (userId) {
    const row = users.find((u) => u.id === userId);
    if (row) return buildKaraokeProfileFromDbUser(row);
  }
  const namePart = cleanedHandle
    .replace('@', '')
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  return {
    userId: userId ?? null,
    name: namePart || 'Karaoke Star',
    handle: cleanedHandle,
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${cleanedHandle.replace('@', '')}`,
    description: `Passionate vocalist ready to perform! Handle: ${cleanedHandle}`,
  };
}


function coverRecordingToFeedPost(meta: KaraokeCoverRecordingMeta): KaraokeDuetPost {
  const users = meta.performers.map((performer) => performer.handle);
  const feedUsers =
    meta.performanceType === 'solo' || users.length < 2
      ? [users[0] || '@you', users[0] || '@you']
      : users.slice(0, 2);
  return {
    id: meta.id,
    users: feedUsers,
    song: meta.caption ? `${meta.songTitle} — ${meta.caption}` : meta.songTitle,
    likesCount: meta.likes,
    commentCount: 0,
    isLiked: false,
    videoUrl: '',
    img: meta.img || 'https://images.unsplash.com/photo-1516280440502-6c9ab45187fb?w=800&auto=format&fit=crop&q=60',
    songId: meta.songId,
    recordingId: meta.id,
    isPublishedCover: true,
  };
}

const CATEGORIES = ['Pop', 'R&B', 'Rock', 'K-Pop', 'Hip Hop', 'Country', 'Anime', 'Musicals'];
const TRENDING_SONGS = [
  { id: '1', title: 'Blinding Lights', artist: 'The Weeknd', plays: '4.2M', type: 'solo' },
  { id: '2', title: 'Someone Like You', artist: 'Adele', plays: '3.1M', type: 'duet' },
  { id: '3', title: 'Watermelon Sugar', artist: 'Harry Styles', plays: '2.8M', type: 'solo' },
  { id: '4', title: 'Uptown Funk', artist: 'Bruno Mars', plays: '2.5M', type: 'group' },
  { id: '5', title: 'Bohemian Rhapsody', artist: 'Queen', plays: '2.1M', type: 'solo' },
];
const LIBRARY_SONGS = [
  { id: 'l1', title: 'Shape of You', artist: 'Ed Sheeran', plays: '1.9M', category: 'Pop', type: 'solo' },
  { id: 'l2', title: 'Stay', artist: 'The Kid LAROI & Justin Bieber', plays: '1.8M', category: 'Pop', type: 'duet' },
  { id: 'l3', title: 'My Heart Will Go On', artist: 'Celine Dion', plays: '1.7M', category: 'Pop', type: 'solo' },
  { id: 'l4', title: 'Rollin in the Deep', artist: 'Adele', plays: '1.6M', category: 'Pop', type: 'solo' },
  { id: 'l5', title: 'Flowers', artist: 'Miley Cyrus', plays: '1.5M', category: 'Pop', type: 'solo' },
  { id: 'l6', title: 'As It Was', artist: 'Harry Styles', plays: '1.4M', category: 'Pop', type: 'solo' },
  { id: 'l7', title: 'Perfect', artist: 'Ed Sheeran', plays: '1.3M', category: 'Pop', type: 'duet' },
  { id: 'l8', title: 'Despacito', artist: 'Luis Fonsi ft. Daddy Yankee', plays: '1.2M', category: 'Pop', type: 'duet' },
  { id: 'l9', title: 'Bad Guy', artist: 'Billie Eilish', plays: '1.1M', category: 'Pop', type: 'solo' },
  
  { id: 'l10', title: 'Superstition', artist: 'Stevie Wonder', plays: '1.8M', category: 'R&B' },
  { id: 'l11', title: 'No One', artist: 'Alicia Keys', plays: '1.7M', category: 'R&B' },
  { id: 'l12', title: 'Blame It on the Boogie', artist: 'The Jacksons', plays: '1.6M', category: 'R&B' },
  { id: 'l13', title: 'Killing Me Softly', artist: 'Fugees', plays: '1.5M', category: 'R&B' },
  { id: 'l14', title: 'If I Ain\'t Got You', artist: 'Alicia Keys', plays: '1.4M', category: 'R&B' },
  { id: 'l15', title: 'Save Your Tears', artist: 'The Weeknd', plays: '1.3M', category: 'R&B' },

  { id: 'l16', title: 'Livin\' on a Prayer', artist: 'Bon Jovi', plays: '2.0M', category: 'Rock' },
  { id: 'l17', title: 'Sweet Child O\' Mine', artist: 'Guns N\' Roses', plays: '1.9M', category: 'Rock' },
  { id: 'l18', title: 'Don\'t Stop Believin\'', artist: 'Journey', plays: '1.8M', category: 'Rock' },
  { id: 'l19', title: 'Hotel California', artist: 'Eagles', plays: '1.7M', category: 'Rock' },
  { id: 'l20', title: 'Wonderwall', artist: 'Oasis', plays: '1.6M', category: 'Rock' },

  { id: 'l21', title: 'Dynamite', artist: 'BTS', plays: '2.3M', category: 'K-Pop' },
  { id: 'l22', title: 'How You Like That', artist: 'BLACKPINK', plays: '2.2M', category: 'K-Pop' },
  { id: 'l23', title: 'Gangnam Style', artist: 'PSY', plays: '2.1M', category: 'K-Pop' },
  { id: 'l24', title: 'Hype Boy', artist: 'NewJeans', plays: '2.0M', category: 'K-Pop' },
  { id: 'l25', title: 'Love Scenario', artist: 'iKON', plays: '1.9M', category: 'K-Pop' },

  { id: 'l26', title: 'Lose Yourself', artist: 'Eminem', plays: '1.9M', category: 'Hip Hop' },
  { id: 'l27', title: 'Gangsta\'s Paradise', artist: 'Coolio', plays: '1.8M', category: 'Hip Hop' },
  { id: 'l28', title: 'SICKO MODE', artist: 'Travis Scott', plays: '1.7M', category: 'Hip Hop' },
  { id: 'l29', title: 'God\'s Plan', artist: 'Drake', plays: '1.6M', category: 'Hip Hop' },

  { id: 'l30', title: 'Take Me Home, Country Roads', artist: 'John Denver', plays: '1.8M', category: 'Country' },
  { id: 'l31', title: 'Jolene', artist: 'Dolly Parton', plays: '1.7M', category: 'Country' },
  { id: 'l32', title: 'You Belong With Me', artist: 'Taylor Swift', plays: '1.6M', category: 'Country' },
  { id: 'l33', title: 'Tennessee Whiskey', artist: 'Chris Stapleton', plays: '1.5M', category: 'Country' },

  { id: 'l34', title: 'Cruel Angel\'s Thesis', artist: 'Yoko Takahashi', plays: '2.0M', category: 'Anime' },
  { id: 'l35', title: 'Gurenge', artist: 'LiSA', plays: '1.9M', category: 'Anime' },
  { id: 'l36', title: 'Unravel', artist: 'TK from Ling Tosite Sigure', plays: '1.8M', category: 'Anime' },

  { id: 'l37', title: 'Alexander Hamilton', artist: 'Hamilton Cast', plays: '1.7M', category: 'Musicals' },
  { id: 'l38', title: 'Defying Gravity', artist: 'Wicked Cast', plays: '1.6M', category: 'Musicals' },
  { id: 'l39', title: 'Do You Hear the People Sing?', artist: 'Les Misérables Cast', plays: '1.5M', category: 'Musicals' },
  { id: 'epic_underworld', title: 'The Underworld - Epic The Musical', artist: 'Jorge Rivera-herrans', plays: '5.2M', category: 'Musicals', img: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=60' }
];

const LYRICS_DATABASE: Record<string, string[]> = {
  'epic_underworld': [
    '[ODYSSEUS]',
    "Friends, Circe's instructions were clear",
    "No matter what we hear",
    "",
    '[ALL] Full speed ahead',
    "",
    '[ODY] Until we find the prophet',
    'My comrades, this land',
    'confuses your mind',
    'So no matter who we find',
    "",
    '[ALL] Full speed ahead,',
    'until we find the prophet',
    "",
    '[ODY, spoken] Good',
    "",
    '[ODYSSEUS, SOLDIERS]',
    'All I hear are screams, every',
    'time I dare to close my eyes',
    'I no longer dream, only',
    "nightmares of those who've died"
  ],
  '1': [
    '[VERSE 1]',
    "I've been on my own for long enough",
    "Maybe you can show me how to love, maybe",
    "I'm going through withdrawals",
    "You don't even have to do too much",
    "You can turn me on with just a touch, baby",
    "",
    '[CHORUS]',
    "I look around and Sin City's cold and empty",
    "No one's around to judge me",
    "I can't see clearly when you're gone",
    "I said, ooh, I'm blinded by the lights",
    "No, I can't sleep until I feel your touch"
  ],
  '2': [
    '[VERSE 1]',
    "I heard that you're settled down",
    "That you found a girl and you're married now",
    "I heard that your dreams came true",
    "Guess she gave you things I didn't give to you",
    "",
    '[CHORUS]',
    "Never mind, I'll find someone like you",
    "I wish nothing but the best for you, too",
    "Don't forget me, I beg, I remember you said",
    "Sometimes it lasts in love, but sometimes it hurts instead"
  ]
};

const RECORDINGS_DATABASE: Record<string, any[]> = {
  'epic_underworld': [
    { id: 'rec_eu1', title: 'The Underworld - Epic The Musical', users: ['CoCo_rr0_n', 'HevenNgabo'], plays: '1', likes: 0, gifts: 0, duration: '1h' },
    { id: 'rec_eu2', title: 'The Underworld - Epic The Musical', users: ['CoCo_rr0_n', 'hunteruchiha4'], plays: '1', likes: 0, gifts: 0, duration: '1h' },
    { id: 'rec_eu3', title: 'The Underworld - Epic The Musical', users: ['local_xin', 'mariafight'], plays: '1', likes: 0, gifts: 0, duration: '1h' },
    { id: 'rec_eu4', title: 'The Underworld - Epic The Musical', users: ['meowklemii', 'Ankle_Biter247'], plays: '1', likes: 0, gifts: 0, duration: '2h' },
    { id: 'rec_eu5', title: 'The Underworld - Epic The Musical', users: ['local_xin', 'BrandonHarrisEl'], plays: '1', likes: 0, gifts: 0, duration: '2h' }
  ]
};

const getLyricsForSong = (song: any) => {
  if (!song) return [];
  if (song.isUploaded || song.timedLyrics?.length || song.lyrics) {
    const uploaded = lyricsLinesFromUpload(song);
    if (uploaded.length > 0) return uploaded;
  }
  if (LYRICS_DATABASE[song.id]) return LYRICS_DATABASE[song.id];
  
  // Dynamic high-fidelity procedural generation based on song metatags
  return [
    `[VERSE 1]`,
    `Yeah, listening to "${song.title}" by ${song.artist}`,
    `This melody is taking me higher,`,
    `Feel the rhythm, let the music take control.`,
    `Singing every word straight from my soul!`,
    ``,
    `[CHORUS]`,
    `Oh, we're singing along to "${song.title}"`,
    `With every beat, we shine so bright,`,
    `No, we don't care who's watching tonight.`,
    `Yeah, we're singing along, feeling so right!`,
    ``,
  ];
};

type TrackDetailsCreator = {
  followKey: string;
  name: string;
  handle: string;
  avatar: string;
  subtitle: string;
  showVip: boolean;
};

function communityProfileFromUserId(userId: string): Pick<TrackDetailsCreator, 'name' | 'handle' | 'avatar' | 'followKey'> {
  const seed = userId.trim() || 'singer';
  const followKey = seed.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 24) || 'singer';
  const handle = `@${followKey}`;
  const name =
    followKey
      .split('_')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ') || 'Karaoke Star';
  return {
    followKey,
    name,
    handle,
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}`,
  };
}

function resolveTrackDetailsCreator(options: {
  playingTrack: KaraokeLibrarySong | null;
  activeCoverRecording: KaraokeCoverRecordingMeta | null;
  uploadMetas: KaraokeUploadedSongMeta[];
  currentUser: {
    id: string;
    name: string;
    handle: string;
    avatar: string;
  };
  userVip: boolean;
}): TrackDetailsCreator | null {
  const { playingTrack, activeCoverRecording, uploadMetas, currentUser, userVip } = options;
  if (!playingTrack) return null;

  if (activeCoverRecording) {
    const lead = activeCoverRecording.performers[0];
    if (!lead) return null;
    const handle = lead.handle.startsWith('@') ? lead.handle : `@${lead.handle}`;
    const followKey = handle.replace(/^@/, '');
    const isSelf = activeCoverRecording.performerUserId === currentUser.id;
    return {
      followKey,
      name: lead.name,
      handle,
      avatar:
        safeAvatarUrl(lead.avatar) ||
        `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(followKey)}`,
      subtitle: `${performanceTypeLabel(activeCoverRecording.performanceType)} cover artist`,
      showVip: isSelf && userVip,
    };
  }

  if (playingTrack.isUploaded) {
    const meta =
      uploadMetas.find((row) => row.id === playingTrack.id) ||
      listKaraokeUploads().find((row) => row.id === playingTrack.id);
    const ownerId = meta?.ownerUserId?.trim();
    if (ownerId && ownerId === currentUser.id) {
      return {
        followKey: currentUser.handle.replace(/^@/, ''),
        name: currentUser.name,
        handle: currentUser.handle,
        avatar: currentUser.avatar,
        subtitle: 'Backing track uploader',
        showVip: userVip,
      };
    }
    const community = ownerId
      ? communityProfileFromUserId(ownerId)
      : {
          followKey: 'uploader',
          name: 'Community uploader',
          handle: '@uploader',
          avatar:
            safeAvatarUrl(playingTrack.img) ||
            'https://api.dicebear.com/7.x/avataaars/svg?seed=uploader',
        };
    return {
      ...community,
      subtitle: 'Community backing track',
      showVip: false,
    };
  }

  const followKey = (playingTrack.artist || playingTrack.id || 'catalog')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 24) || 'catalog';
  return {
    followKey,
    name: playingTrack.artist || 'Original artist',
    handle: '@catalog',
    avatar:
      safeAvatarUrl(playingTrack.img) ||
      `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(playingTrack.id || 'catalog')}`,
    subtitle: 'Catalog track',
    showVip: false,
  };
}

const getDemoRecordingsForSong = (song: any) => {
  if (!song) return [];
  if (RECORDINGS_DATABASE[song.id]) return RECORDINGS_DATABASE[song.id];
  return [
    { id: `rec_${song.id}_1`, title: song.title, users: ['duet_master', 'karaoke_pro'], plays: '1.2K', likes: 215, gifts: 18, duration: '3h' },
    { id: `rec_${song.id}_2`, title: song.title, users: ['melody_star', 'vocal_queen'], plays: '940', likes: 132, gifts: 10, duration: '5h' },
    { id: `rec_${song.id}_3`, title: song.title, users: ['johnny_b', 'sarah_sings'], plays: '580', likes: 88, gifts: 5, duration: '12h' },
    { id: `rec_${song.id}_4`, title: song.title, users: ['singer_dreamer', 'guitar_hero'], plays: '250', likes: 34, gifts: 1, duration: '1d' }
  ];
};
const COMMUNITY_DUETS = [
  { id: '1', users: ['@sarah_sings', '@johnny_b'], song: 'Shallow (A Star Is Born)', likes: '12K', comments: 452, videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4', img: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&auto=format&fit=crop&q=60' },
  { id: '2', users: ['@vocal_king', '@melody_queen'], song: 'Perfect', likes: '8.5K', comments: 120, videoUrl: 'https://www.w3schools.com/html/movie.mp4', img: 'https://images.unsplash.com/photo-1493225457124-a1a2a5f5f9af?w=800&auto=format&fit=crop&q=60' },
];
const LIVE_STREAMS = [
  { id: '1', user: 'Vocal Star 99', viewers: '1.2K', img: 'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?w=500&auto=format&fit=crop&q=60', tags: ['Live Concert', 'Pop'] },
  { id: '2', user: 'Acoustic Sessions', viewers: '840', img: 'https://images.unsplash.com/photo-1598387993441-a364f854c3e1?w=500&auto=format&fit=crop&q=60', tags: ['Acoustic', 'Chill'] },
];

type ReplyObj = { id: string, user: string, avatar: string, text: string, time: string, likes: number, isLiked: boolean, replies?: ReplyObj[] };
type CommentObj = { id: string, user: string, avatar: string, text: string, time: string, likes: number, isLiked: boolean, replies: ReplyObj[] };

function ReplyItem({ reply, postId, onReply, onLike, replyingToCommentId, setReplyingToCommentId, replyText, setReplyText, handleReplyToComment }: { reply: ReplyObj, postId: string, onReply: (id: string) => void, onLike: (postId: string, replyId: string) => void, replyingToCommentId: string | null, setReplyingToCommentId: React.Dispatch<React.SetStateAction<string | null>>, replyText: string, setReplyText: React.Dispatch<React.SetStateAction<string>>, handleReplyToComment: (postId: string, commentId: string, replyText: string) => void }) {
  return (
    <div className="space-y-2 mt-2">
       <div className="flex gap-2 p-3 bg-zinc-100/50 dark:bg-zinc-800/30 rounded-2xl">
         <img src={reply.avatar} className="w-7 h-7 rounded-full shrink-0" alt="Avatar" />
         <div className="flex-1">
            <div className='flex items-center gap-1.5'>
                <span className="font-bold text-[12px] text-foreground">{reply.user}</span>
                <span className="text-[10px] text-muted-foreground">{reply.time}</span>
            </div>
            <p className="text-[13px] text-foreground mt-0.5">{reply.text}</p>
            <div className="flex items-center gap-3 mt-1.5">
               <button onClick={() => onLike(postId, reply.id)} className="flex items-center gap-1 text-[10px] text-muted-foreground font-bold uppercase hover:text-rose-500">
                  <Heart className={`w-3 h-3 ${reply.isLiked ? 'fill-rose-500 text-rose-500' : ''}`} /> {reply.likes}
               </button>
               <button onClick={() => onReply(reply.id)} className="text-[10px] font-bold text-primary hover:underline">Reply</button>
            </div>
         </div>
       </div>
       {replyingToCommentId === reply.id && (
         <div className="flex gap-2 ml-9">
            <input 
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleReplyToComment(postId, reply.id, replyText);
                  setReplyText('');
                  setReplyingToCommentId(null);
                }
              }}
              placeholder="Write a reply..."
              className="flex-1 bg-secondary rounded-full text-xs px-4 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button onClick={() => {
              handleReplyToComment(postId, reply.id, replyText);
              setReplyText('');
              setReplyingToCommentId(null);
            }} className="text-xs bg-primary text-primary-foreground px-4 py-2 rounded-full font-bold">Post</button>
         </div>
       )}
       {reply.replies && reply.replies.length > 0 && (
          <div className="ml-8 border-l-2 border-zinc-200 dark:border-zinc-700 pl-3">
             {reply.replies.map(r => <ReplyItem key={r.id} reply={r} postId={postId} onReply={onReply} onLike={onLike} replyingToCommentId={replyingToCommentId} setReplyingToCommentId={setReplyingToCommentId} replyText={replyText} setReplyText={setReplyText} handleReplyToComment={handleReplyToComment}/>)}
          </div>
       )}
    </div>
  )
}

function isOtherKaraokeProfile(profile: KaraokeSelectedProfile, selfUserId: string): boolean {
  if (profile.userId) return profile.userId !== selfUserId;
  return true;
}

function karaokeTabNavLabel(tab: string | null | undefined): string {
  switch (tab) {
    case 'feed':
      return 'Explore';
    case 'leaderboard':
      return 'Leaderboard';
    case 'live':
      return 'Live';
    case 'challenge':
      return 'Contests';
    case 'messages':
      return 'Messages';
    case 'notifications':
      return 'Notifications';
    case 'search':
      return 'Search';
    case 'sing':
      return 'Studio';
    case 'party':
      return 'Party';
    case 'genres':
      return 'Genres';
    case 'top100':
      return 'Top 100';
    case 'profile':
      return 'Profile';
    default:
      return 'Previous';
  }
}

function karaokeProfileBackLabel(
  previousTab: string | null,
  returnContext?: KaraokeProfileReturnContext | null,
): string {
  if (returnContext?.surface === 'karaoke-party-room') {
    return 'Party Room';
  }
  if (returnContext?.surface === 'karaoke') {
    return karaokeTabNavLabel(returnContext.tab);
  }
  return karaokeTabNavLabel(previousTab);
}

export function KaraokeScreen() {
  const db = useDB();
  useDbRevision();
  const appUser = useCurrentUser();
  const {
    userAccounts,
    selectAccount,
    removeAccount,
    linkEmailAccount,
    linkGoogleAccount,
    ensureDeviceAccountsSynced,
  } = useAuth();
  const { session: cloudSession } = useCloudAuth();
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);
  const [accountLinking, setAccountLinking] = useState(false);

  const userCoins = getKstarCoins(appUser.id);
  const userVip = isKstarVip(appUser);

  useEffect(() => {
    ensureKstarUserStateMigrated(appUser.id);
    reconcileWalletAndKstarCoins(appUser.id);
  }, [appUser.id]);

  // Dynamic state for duets that makes interactions (likes, comments, gifts) reactive and persistent
  const [duets, setDuets] = useState<KaraokeDuetPost[]>(() => [
    { id: '1', users: ['@sarah_sings', '@johnny_b'], song: 'Shallow (A Star Is Born)', likesCount: 12000, commentCount: 452, isLiked: false, videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4', img: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&auto=format&fit=crop&q=60' },
    { id: '2', users: ['@vocal_king', '@melody_queen'], song: 'Perfect', likesCount: 8500, commentCount: 120, isLiked: false, videoUrl: 'https://www.w3schools.com/html/movie.mp4', img: 'https://images.unsplash.com/photo-1493225457124-a1a2a5f5f9af?w=800&auto=format&fit=crop&q=60' },
  ]);

  const [librarySongs, setLibrarySongs] = useState<KaraokeLibrarySong[]>(LIBRARY_SONGS);
  const [trendingSongs, setTrendingSongs] = useState(TRENDING_SONGS);
  const [uploadedSongs, setUploadedSongs] = useState<KaraokeLibrarySong[]>([]);
  const [uploadedSongMetas, setUploadedSongMetas] = useState<KaraokeUploadedSongMeta[]>([]);

  const mergeUploadedIntoLibrary = useCallback((uploads: KaraokeLibrarySong[]) => {
    setLibrarySongs((prev) => {
      const builtInIds = new Set(LIBRARY_SONGS.map((song) => song.id));
      const base = prev.filter(
        (song) => builtInIds.has(song.id) || uploads.some((upload) => upload.id === song.id),
      );
      const existingIds = new Set(base.map((song) => song.id));
      const fresh = uploads.filter((upload) => !existingIds.has(upload.id));
      return [...fresh, ...base];
    });
  }, []);

  const loadUserUploads = useCallback(() => {
    const metas = listKaraokeUploadsForUser(appUser.id);
    const uploads = metas.map(metaToLibrarySong);
    setUploadedSongMetas(metas);
    setUploadedSongs(uploads);
    mergeUploadedIntoLibrary(uploads);
  }, [appUser.id, mergeUploadedIntoLibrary]);

  useEffect(() => {
    loadUserUploads();
    void hydrateKaraokeUploadsFromCloud().then(loadUserUploads);
    window.addEventListener('karaoke-uploads-updated', loadUserUploads);
    const onTapRefresh = (event: Event) => {
      const scope = (event as CustomEvent<{ scope?: string }>).detail?.scope;
      if (scope !== 'karaoke' && scope !== 'global') return;
      void hydrateKaraokeUploadsFromCloud().then(loadUserUploads);
    };
    window.addEventListener(TAP_REFRESH_EVENT, onTapRefresh);
    return () => {
      window.removeEventListener('karaoke-uploads-updated', loadUserUploads);
      window.removeEventListener(TAP_REFRESH_EVENT, onTapRefresh);
    };
  }, [loadUserUploads]);

  const handleDeleteUpload = useCallback((songId: string) => {
    deleteKaraokeUpload(songId);
    loadUserUploads();
    window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Upload removed' }));
  }, [loadUserUploads]);

  const openUploadedSongListen = useCallback(async (song: KaraokeLibrarySong) => {
    captureTrackDetailsOriginRef.current();
    window.dispatchEvent(new CustomEvent('app-toast', { detail: `Loading "${song.title}"...` }));
    const enriched = await enrichUploadedKaraokeSong(song);
    if (!enriched.audioUrl) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Audio file not found for this upload. Try re-uploading.' }));
      return;
    }
    setPlayingTrack({
      ...enriched,
      plays: enriched.plays || '0',
      likes: '0',
      img: enriched.img,
    });
    setTrackMaxSeconds(Math.max(30, Math.floor(enriched.durationSec ?? 180)));
    setTrackTime(0);
    setTrackProgress(0);
    setIsPlayingTrack(false);
    setActiveCoverRecording(null);
    setActiveCoverMediaUrl(null);
    const recordings = listKaraokeCoverRecordings(song.id);
    setCoverRecordings(recordings);
    setDetailsTab(recordings.length > 0 ? 'recordings' : 'lyrics');
    setShowTrackDetails(true);
  }, []);

  const openUploadedSongSing = useCallback(async (song: KaraokeLibrarySong) => {
    const enriched = await enrichUploadedKaraokeSong(song);
    if (!enriched.audioUrl) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Audio missing — opening studio with lyrics only.' }));
    }
    setSelectedSong(enriched);
  }, []);

  const handleSongUploaded = useCallback(async (payload: KaraokeUploadInput) => {
    const meta = await saveKaraokeUpload(payload);
    loadUserUploads();
    setProfileActiveTab('uploads');
    setActiveTab('profile');
    captureTrackDetailsOriginRef.current({
      tab: 'profile',
      profileTab: 'uploads',
      selectedUserProfile: null,
      force: true,
    });
    await openUploadedSongListen(metaToLibrarySong(meta));
    syncKaraokeUrl({
      tab: 'profile',
      profileTab: 'uploads',
      track: meta.id,
      recording: null,
      user: null,
    });
  }, [loadUserUploads, openUploadedSongListen]);

  // Comment drawers and sheet states
  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [chatText, setChatText] = useState('');
  const [chatMessages, setChatMessages] = useState<{user:string, text:string}[]>([]);
  const [liveLikes, setLiveLikes] = useState(0);
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [commentsByPost, setCommentsByPost] = useState<Record<string, CommentObj[]>>({
    '1': [
      { id: '1', user: 'VocalSensation', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=vocal', text: 'Oh my god, @sarah_sings your high notes are incredible! 🎤✨', time: '1h ago', likes: 23, isLiked: false, replies: [] },
      { id: '2', user: 'GuitarHero', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=guitar', text: '@johnny_b with the perfect rhythm backing. Amazing job guys!', time: '20m ago', likes: 12, isLiked: false, replies: [] },
    ],
    '2': [
      { id: '1', user: 'MusicLover', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=music', text: 'This cover of Perfect is absolutely perfect! Love this collaboration! ❤️', time: '2h ago', likes: 5, isLiked: false, replies: [] }
    ]
  });

  // Gift tracking
  const [selectedGiftId, setSelectedGiftId] = useState<number>(1);
  const [giftingDuetId, setGiftingDuetId] = useState<string | null>(null);
  const [duetGifts, setDuetGifts] = useState<Record<string, number>>({
    '1': 42,
    '2': 18
  });

  const [activeTab, setActiveTab] = useState<'sing' | 'feed' | 'live' | 'party' | 'profile' | 'search' | 'challenge' | 'leaderboard' | 'genres' | 'top100' | 'messages' | 'notifications'>('sing');
  const [karaokeMessagesChatId, setKaraokeMessagesChatId] = useState<string | null>(null);
  const [previousTab, setPreviousTab] = useState<any>(null);
  const [profileReturnContext, setProfileReturnContext] = useState<KaraokeProfileReturnContext | null>(null);
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const lastAppliedSearchRef = useRef('');

  const commitKaraokeNavigation = (patch: KaraokeUrlParams, mode: 'replace' | 'push' = 'replace') => {
    syncKaraokeUrl(patch, mode);
    lastAppliedSearchRef.current = window.location.search;
  };

  useEffect(() => {
    registerKaraokeTabGetter(() => activeTabRef.current);
    return () => registerKaraokeTabGetter(null);
  }, []);
  const [selectedSong, setSelectedSong] = useState<any>(null);
  const [activeLiveStream, setActiveLiveStream] = useState<any>(null);
  const [showSmuleRoomFlow, setShowSmuleRoomFlow] = useState(false);
  const [smuleRoomFlowKey, setSmuleRoomFlowKey] = useState(0);
  const [smuleRoomInitialPath, setSmuleRoomInitialPath] = useState('/room/create');
  const [smuleRoomFlowEntry, setSmuleRoomFlowEntry] = useState<RoomFlowEntry>('default');
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const contentScrollRef = useRef<HTMLDivElement>(null);

  type KaraokeTab = typeof activeTab;

  const goToKaraokeStudio = useCallback(() => {
    setSelectedUserProfile(null);
    setKaraokeProfileStack([]);
    if (profileReturnContext?.surface === 'app') {
      setProfileReturnContext(null);
    }
    setPreviousTab(null);
    setShowSmuleRoomFlow(false);
    clearActiveRoomSession();
    setKaraokeMessagesChatId(null);
    setActiveTab('sing');
    commitKaraokeNavigation({
      tab: 'sing',
      profileTab: null,
      user: null,
      track: null,
      recording: null,
    });
    contentScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [profileReturnContext?.surface]);

  const handleKStarLogoTap = () => {
    if (activeTab === 'sing' && !showSmuleRoomFlow && !selectedUserProfile) {
      dispatchTapRefresh('karaoke');
      contentScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      window.dispatchEvent(new CustomEvent('app-toast', { detail: 'K-Star refreshed' }));
      return;
    }
    goToKaraokeStudio();
  };

  const handleKaraokeTabTap = (tab: KaraokeTab) => {
    if (tab === activeTab) {
      if (tab !== 'messages' && tab !== 'notifications') {
        dispatchTapRefresh('karaoke');
        contentScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        window.dispatchEvent(new CustomEvent('app-toast', { detail: 'K-Star refreshed' }));
      }
      return;
    }
    if (tab === 'messages') {
      db.setUnreadMessagesCount(0);
    }
    if (tab === 'notifications') {
      db.setHasUnreadNotifications(false);
    }
    if (tab === 'search') {
      setPreviousTab(activeTabRef.current);
    }
    setSelectedUserProfile(null);
    setKaraokeProfileStack([]);
    if (tab !== 'profile' && profileReturnContext?.surface === 'app') {
      setProfileReturnContext(null);
    }
    setActiveTab(tab);
    commitKaraokeNavigation({
      tab,
      profileTab: tab === 'profile' ? profileActiveTab : null,
      user: null,
      track: null,
      recording: null,
    });
  };

  const karaokeNavButtonClass = (tab: KaraokeTab, extra = '') =>
    `${navTapButtonClass} w-full flex items-center lg:justify-start justify-center gap-3 lg:px-4 py-3 min-h-[44px] rounded-2xl transition ${extra}`;

  const KARAOKE_MOBILE_NAV = [
    { id: 'sing' as const, icon: MicVocal, label: 'Sing' },
    { id: 'party' as const, icon: PartyRoomIcon, label: 'Party' },
    { id: 'feed' as const, icon: TrendingUp, label: 'Explore' },
    { id: 'messages' as const, icon: MessageCircle, label: 'Messages' },
    { id: 'notifications' as const, icon: Bell, label: 'Notifications' },
    { id: 'live' as const, icon: Video, label: 'Live' },
    { id: 'challenge' as const, icon: Trophy, label: 'Contest' },
    { id: 'leaderboard' as const, icon: Crown, label: 'Top' },
  ];

  const openSmuleRoomFlow = (path: string, entry: RoomFlowEntry = 'default') => {
    setShowMobileMenu(false);
    setSmuleRoomInitialPath(path);
    setSmuleRoomFlowEntry(entry);
    setSmuleRoomFlowKey((k) => k + 1);
    setShowSmuleRoomFlow(true);
  };

  const openManagedRoom = (room: ManagedRoom, path?: string) => {
    activateRoomContext(room);
    openSmuleRoomFlow(path ?? `/room/${room.id}`, 'karaoke-profile-manage');
  };

  const PARTY_LOBBY_ROOMS = [
    { id: 1181033, name: 'Pop Hits 2026 🎵', host: 'VocalKing', participants: 42, max: 50, tags: ['Pop', 'Top 40'], roomMode: 'Karaoke' as const },
    { id: 1167298, name: '90s R&B Throwbacks', host: 'SoulSister', participants: 28, max: 50, tags: ['R&B', '90s'], roomMode: 'Chat' as const },
    { id: 3, name: 'K-Pop Fanatics', host: 'BTS_Army12', participants: 49, max: 50, tags: ['K-Pop', 'Dance'], roomMode: 'Karaoke' as const },
    { id: 4, name: 'Chill Acoustic Vibes', host: 'GuitarHero', participants: 15, max: 50, tags: ['Acoustic', 'Chill'], roomMode: 'Radio' as const },
  ];

  const joinPartyRoom = (room: (typeof PARTY_LOBBY_ROOMS)[number]) => {
    const roomId = String(room.id);
    ensureRoomSettingsSeeded(roomId, {
      roomId,
      roomName: room.name,
      roomMode: room.roomMode,
      owner: room.host,
    });
    ensureRoomRoleUserIds(roomId);
    saveRoomSettings(roomId, {
      roomId,
      roomName: room.name,
      roomMode: room.roomMode,
    });
    localStorage.setItem('currentUserRole', 'user');
    openSmuleRoomFlow(`/room/${roomId}`, 'karaoke-party');
  };
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [showVipModal, setShowVipModal] = useState(false);
  const [desktopLeaderboardTab, setDesktopLeaderboardTab] = useState<'weekly' | 'alltime'>('weekly');
  const [selectedUserProfile, setSelectedUserProfile] = useState<KaraokeSelectedProfile | null>(null);
  const [karaokeProfileStack, setKaraokeProfileStack] = useState<KaraokeSelectedProfile[]>([]);
  const [userCovers, setUserCovers] = useState<KaraokeUserCoverCard[]>([]);

  const selfProfileStats = useProfileStats(appUser, appUser.id);

  const karaokeViewedProfileUserId = useMemo(() => {
    if (!selectedUserProfile) return appUser.id;
    const handle = selectedUserProfile.handle?.replace(/^@/, '');
    const canonical = resolveCanonicalAppUserId(
      selectedUserProfile.userId,
      selectedUserProfile.name,
      handle,
    );
    if (canonical) return canonical;
    if (selectedUserProfile.handle) {
      return resolveUserIdFromKaraokeHandle(selectedUserProfile.handle, db.users);
    }
    return null;
  }, [selectedUserProfile, appUser.id, db.users]);

  const karaokeProfileStats = useProfileStats(
    karaokeViewedProfileUserId ? { id: karaokeViewedProfileUserId } : null,
    karaokeViewedProfileUserId,
  );

  const viewedProfileCovers = useMemo(() => {
    if (!selectedUserProfile) return userCovers;
    if (karaokeViewedProfileUserId) {
      return listKaraokeCoverRecordingsForUser(karaokeViewedProfileUserId).map(
        coverRecordingToUserCard,
      );
    }
    const handle = String(selectedUserProfile.handle).toLowerCase();
    return listKaraokeCoverRecordings()
      .filter((row) =>
        row.performers.some((performer) => performer.handle.toLowerCase() === handle),
      )
      .map(coverRecordingToUserCard);
  }, [selectedUserProfile, karaokeViewedProfileUserId, userCovers]);

  const karaokeViewedCoverCount = viewedProfileCovers.length;

  const karaokeViewedUploadCount = useMemo(() => {
    if (!selectedUserProfile) return uploadedSongs.length;
    if (!karaokeViewedProfileUserId) return 0;
    return listKaraokeUploadsForUser(karaokeViewedProfileUserId).length;
  }, [selectedUserProfile, karaokeViewedProfileUserId, uploadedSongs.length]);

  const [karaokeFollowList, setKaraokeFollowList] = useState<{
    userId: string;
    mode: 'followers' | 'following';
  } | null>(null);

  const [karaokeShareModal, setKaraokeShareModal] = useState<SharePayload | null>(null);
  const [profileBackgroundRevision, setProfileBackgroundRevision] = useState(0);

  useEffect(() => {
    setProfileBackgroundRevision((value) => value + 1);
  }, [appUser.id]);

  useEffect(() => {
    const onBackgroundUpdated = () => setProfileBackgroundRevision((value) => value + 1);
    window.addEventListener('karaoke-profile-background-updated', onBackgroundUpdated);
    return () =>
      window.removeEventListener('karaoke-profile-background-updated', onBackgroundUpdated);
  }, []);

  const openKaraokeShareModal = useCallback((payload: SharePayload) => {
    setKaraokeShareModal(payload);
  }, []);

  const CURRENT_USER = useMemo(
    () => {
      const background = karaokeProfileBackgroundForUser(appUser.id);
      return {
      id: appUser.id,
      name: getProfileDisplayName(appUser),
      handle:
        formatProfileHandle(appUser) ||
        `@${(appUser.username || appUser.displayName || 'you').toLowerCase().replace(/\s+/g, '_')}`,
      avatar: karaokeAvatarSrc(appUser.avatarUrl, appUser.id),
      coins: userCoins,
      vip: userVip,
      followers: selfProfileStats.followerCount.toLocaleString(),
      following: selfProfileStats.followingCount.toLocaleString(),
      likes: '2.1M',
      description:
        appUser.bio || 'Aspiring vocalist & shower singer legend. Mostly Pop and R&B! 🎤✨',
      ...background,
    };
    },
    [appUser, selfProfileStats, userCoins, userVip, profileBackgroundRevision],
  );

  // Profile-specific states
  const [searchQuery, setSearchQuery] = useState('');
  const [profileActiveTab, setProfileActiveTab] = useState<KaraokeProfileTab>('covers');
  const [profileFollowHover, setProfileFollowHover] = useState(false);
  const [showKaraokeProfileActionsMenu, setShowKaraokeProfileActionsMenu] = useState(false);
  const { hoveredMenuItem: karaokeProfileHoveredMenuItem, setHoveredMenuItem: setKaraokeProfileHoveredMenuItem } =
    useOptionsMenuHover(showKaraokeProfileActionsMenu);

  useEffect(() => {
    setShowKaraokeProfileActionsMenu(false);
  }, [karaokeViewedProfileUserId, selectedUserProfile]);
  const profileActiveTabRef = useRef(profileActiveTab);
  profileActiveTabRef.current = profileActiveTab;
  const selectedUserProfileRef = useRef(selectedUserProfile);
  selectedUserProfileRef.current = selectedUserProfile;
  const goToProfileTab = useCallback((tab: KaraokeProfileTab) => {
    setActiveTab('profile');
    setProfileActiveTab(tab);
    commitKaraokeNavigation({ tab: 'profile', profileTab: tab, user: null, track: null, recording: null });
  }, []);

  /** Rose header BACK — always returns to the main app home feed. Never uses history goBack. */
  const exitKaraokeToMainApp = useCallback(() => {
    setSelectedUserProfile(null);
    setProfileReturnContext(null);
    setPreviousTab(null);
    setShowSmuleRoomFlow(false);
    clearActiveRoomSession();
    window.dispatchEvent(new CustomEvent('navigate', { detail: { tab: 'home' } }));
  }, []);

  const closeOtherUserProfileView = useCallback(() => {
    if (karaokeProfileStack.length > 0) {
      const prior = karaokeProfileStack[karaokeProfileStack.length - 1];
      setKaraokeProfileStack((stack) => stack.slice(0, -1));
      setSelectedUserProfile(prior);
      commitKaraokeNavigation({
        tab: 'profile',
        profileTab: profileActiveTab,
        user: prior.handle?.replace(/^@/, '') ?? null,
        track: null,
        recording: null,
      }, 'push');
      return;
    }

    setSelectedUserProfile(null);
    setKaraokeProfileStack([]);

    if (profileReturnContext?.surface === 'karaoke-party-room') {
      const roomPath = profileReturnContext.roomPath;
      setProfileReturnContext(null);
      setPreviousTab(null);
      setActiveTab('party');
      openSmuleRoomFlow(roomPath, 'karaoke-party');
      commitKaraokeNavigation({
        tab: 'party',
        profileTab: null,
        user: null,
        track: null,
        recording: null,
      });
      return;
    }

    const returnTab =
      profileReturnContext?.surface === 'karaoke'
        ? profileReturnContext.tab
        : previousTab && previousTab !== 'profile'
          ? previousTab
          : 'profile';
    const returnProfileTab = returnTab === 'profile' ? profileActiveTab : null;

    setProfileReturnContext(null);
    setPreviousTab(null);
    setActiveTab(returnTab as KaraokeTab);
    commitKaraokeNavigation({
      tab: returnTab,
      profileTab: returnProfileTab,
      user: null,
      track: null,
      recording: null,
    });
  }, [profileReturnContext, previousTab, profileActiveTab, karaokeProfileStack]);

  const navigateToKaraokeOtherProfile = useCallback(
    (profile: KaraokeSelectedProfile) => {
      if (
        selectedUserProfile &&
        isOtherKaraokeProfile(selectedUserProfile, appUser.id)
      ) {
        setKaraokeProfileStack((stack) => [...stack, selectedUserProfile]);
      } else if (activeTabRef.current !== 'profile') {
        setPreviousTab(activeTabRef.current);
      }
      setProfileReturnContext((ctx) => (ctx?.surface === 'app' ? null : ctx));
      setSelectedUserProfile(profile);
      setActiveTab('profile');
      commitKaraokeNavigation({
        tab: 'profile',
        profileTab: profileActiveTab,
        user: profile.handle?.replace(/^@/, '') ?? null,
        track: null,
        recording: null,
      }, 'push');
    },
    [profileActiveTab, selectedUserProfile, appUser.id],
  );

  const pushKaraokeStackTab = useCallback((tab: 'genres' | 'top100' | 'search') => {
    setPreviousTab(activeTabRef.current);
    setActiveTab(tab);
    commitKaraokeNavigation({
      tab,
      profileTab: null,
      user: null,
      track: null,
      recording: null,
    }, 'push');
  }, []);

  const popKaraokeStackBack = useCallback(() => {
    const returnTab = (
      previousTab && isKaraokeTab(previousTab) ? previousTab : 'sing'
    ) as KaraokeTab;
    setPreviousTab(null);
    setActiveTab(returnTab);
    commitKaraokeNavigation({
      tab: returnTab,
      profileTab: null,
      user: null,
      track: null,
      recording: null,
    });
  }, [previousTab]);

  useEffect(() => {
    const onKaraokeProfileOpen = (event: Event) => {
      const detail = (event as CustomEvent<{
        userId?: string | null;
        username?: string | null;
        displayName?: string | null;
        profileTab?: KaraokeProfileTab | null;
        closeRoomFlow?: boolean;
        fromShare?: boolean;
        returnContext?: KaraokeProfileReturnContext;
      }>).detail;
      if (!detail) return;

      if (detail.closeRoomFlow) {
        clearActiveRoomSession();
        setShowSmuleRoomFlow(false);
      }

      const resolveProfileFromDetail = (): KaraokeSelectedProfile | null => {
        const canonicalUserId = detail.userId
          ? resolveCanonicalAppUserId(
              detail.userId,
              detail.displayName,
              detail.username,
            )
          : resolveCanonicalAppUserId(
              null,
              detail.displayName,
              detail.username,
            );

        if (canonicalUserId) {
          const byId = db.users.find((row: User) => row.id === canonicalUserId);
          if (byId) return buildKaraokeProfileFromDbUser(byId);
        }

        if (detail.username) {
          const handle = detail.username.startsWith('@')
            ? detail.username
            : `@${detail.username}`;
          const byUsername = db.users.find(
            (row: User) => safeUsername(row.username) === safeUsername(detail.username!),
          );
          if (byUsername) return buildKaraokeProfileFromDbUser(byUsername);
          return buildKaraokeProfileFromHandle(handle, db.users);
        }
        if (detail.displayName) {
          const fromDisplayName = resolveCanonicalAppUserId(
            null,
            detail.displayName,
            detail.username,
          );
          if (fromDisplayName) {
            const byId = db.users.find((row: User) => row.id === fromDisplayName);
            if (byId) return buildKaraokeProfileFromDbUser(byId);
          }
        }
        return null;
      };

      const profile = resolveProfileFromDetail();
      if (detail.returnContext) {
        setProfileReturnContext(detail.returnContext);
      }
      if (profile && isOtherKaraokeProfile(profile, appUser.id)) {
        if (detail.returnContext?.surface === 'karaoke-party-room') {
          /* Back returns to party room via profileReturnContext. */
        } else if (
          detail.returnContext?.surface === 'karaoke' &&
          detail.returnContext.tab !== 'profile'
        ) {
          setPreviousTab(detail.returnContext.tab);
        } else if (!detail.returnContext && activeTabRef.current !== 'profile') {
          setPreviousTab(activeTabRef.current);
        }
      }
      if (profile) {
        setSelectedUserProfile(
          isOtherKaraokeProfile(profile, appUser.id) ? profile : null,
        );
      } else if (!detail.userId && !detail.username) {
        setSelectedUserProfile(null);
      }

      const nextTab = detail.profileTab ?? 'covers';
      setActiveTab('profile');
      setProfileActiveTab(nextTab);
      commitKaraokeNavigation({
        tab: 'profile',
        profileTab: nextTab,
        user: profile?.handle ?? (detail.username
          ? detail.username.startsWith('@')
            ? detail.username
            : `@${detail.username}`
          : null),
        track: null,
        recording: null,
      }, 'push');
    };

    window.addEventListener('karaoke-profile-open', onKaraokeProfileOpen);
    return () => window.removeEventListener('karaoke-profile-open', onKaraokeProfileOpen);
  }, [db.users, appUser.id]);

  useEffect(() => {
    const onKaraokeMessagesOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ chatId?: string | null }>).detail;
      setActiveTab('messages');
      setKaraokeMessagesChatId(detail?.chatId ?? null);
      db.setUnreadMessagesCount(0);
    };
    window.addEventListener('karaoke-messages-open', onKaraokeMessagesOpen);
    return () => window.removeEventListener('karaoke-messages-open', onKaraokeMessagesOpen);
  }, [db]);

  useEffect(() => {
    const onKaraokeNotificationsOpen = () => {
      setActiveTab('notifications');
      db.setHasUnreadNotifications(false);
    };
    window.addEventListener('karaoke-notifications-open', onKaraokeNotificationsOpen);
    return () => window.removeEventListener('karaoke-notifications-open', onKaraokeNotificationsOpen);
  }, [db]);

  useEffect(() => {
    const onOpenStudio = () => {
      goToKaraokeStudio();
    };
    window.addEventListener(KARAOKE_STUDIO_OPEN_EVENT, onOpenStudio);
    return () => window.removeEventListener(KARAOKE_STUDIO_OPEN_EVENT, onOpenStudio);
  }, [goToKaraokeStudio]);

  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editProfileName, setEditProfileName] = useState('');
  const [editProfileBio, setEditProfileBio] = useState('');
  const [editProfileAvatar, setEditProfileAvatar] = useState('');
  const [editProfileBackgroundUrl, setEditProfileBackgroundUrl] = useState<string | null>(null);
  const [editProfileBackgroundMediaId, setEditProfileBackgroundMediaId] = useState<string | null>(
    null,
  );
  const [editProfileBackgroundMimeType, setEditProfileBackgroundMimeType] = useState<
    string | undefined
  >(undefined);
  const [editProfileBackgroundMediaKind, setEditProfileBackgroundMediaKind] =
    useState<KaraokeProfileBackgroundMediaKind>('image');
  const [editProfileBackgroundFocus, setEditProfileBackgroundFocus] =
    useState<KaraokeProfileBackgroundFocus | null>(null);
  const [backgroundEditorDraft, setBackgroundEditorDraft] =
    useState<KaraokeProfileBackgroundRecord | null>(null);
  const [backgroundEditorPersistImmediately, setBackgroundEditorPersistImmediately] =
    useState(false);

  const applyProfileBackgroundFile = useCallback(async (file: File, persistImmediately = false) => {
    try {
      const background = await readKaraokeProfileBackgroundFile(file);
      setBackgroundEditorDraft(background);
      setBackgroundEditorPersistImmediately(persistImmediately);
    } catch (error) {
      window.dispatchEvent(
        new CustomEvent('app-toast', {
          detail:
            error instanceof Error ? error.message : 'Could not load that background file',
        }),
      );
    }
  }, []);

  const applySelfProfileAvatarFile = useCallback(
    async (file: File) => {
      try {
        const raw = await fileToBase64(file);
        const avatarUrl = await compressAvatarDataUrl(raw);
        db.updateUser(appUser.id, (user) => ({ ...user, avatarUrl }));
        const next = db.users.find((user) => user.id === appUser.id);
        if (next) scheduleCloudProfileSync(next);
        setEditProfileAvatar(avatarUrl);
        window.dispatchEvent(
          new CustomEvent('app-toast', { detail: 'Profile photo updated!' }),
        );
      } catch {
        window.dispatchEvent(
          new CustomEvent('app-toast', { detail: 'Could not update profile photo.' }),
        );
      }
    },
    [appUser.id, db],
  );

  const handleBackgroundEditorSave = useCallback(
    (background: KaraokeProfileBackgroundRecord) => {
      if (backgroundEditorPersistImmediately) {
        setKaraokeProfileBackground(appUser.id, background);
        window.dispatchEvent(
          new CustomEvent('app-toast', { detail: 'K-Star profile background updated' }),
        );
      } else {
        setEditProfileBackgroundUrl(background.url);
        setEditProfileBackgroundMediaId(background.mediaId ?? null);
        setEditProfileBackgroundMimeType(background.mimeType);
        setEditProfileBackgroundMediaKind(background.mediaKind);
        setEditProfileBackgroundFocus(background.focus ?? null);
      }
      setBackgroundEditorDraft(null);
      setBackgroundEditorPersistImmediately(false);
    },
    [appUser.id, backgroundEditorPersistImmediately],
  );

  const handleBackgroundEditorCancel = useCallback(() => {
    if (backgroundEditorDraft) {
      void discardUnsavedKaraokeProfileBackgroundDraft(backgroundEditorDraft);
    }
    setBackgroundEditorDraft(null);
    setBackgroundEditorPersistImmediately(false);
  }, [backgroundEditorDraft]);

  const [userPlaylists, setUserPlaylists] = useState<any[]>([
    { id: 'up1', title: 'Late Night Chill Vibes 🌙', songCount: 8, plays: '1.2K', img: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=60' },
    { id: 'up2', title: 'K-Pop High Energy ⚡', songCount: 15, plays: '4.5K', img: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60' }
  ]);

  const handleCreatePlaylist = () => {
    const title = newPlaylistName.trim();
    if (!title) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Playlist name cannot be empty! ⚠️' }));
      return;
    }
    setUserPlaylists((prev) => [
      ...prev,
      {
        id: 'up_' + Date.now(),
        title,
        songCount: 0,
        plays: '0',
        img: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60',
      },
    ]);
    setNewPlaylistName('');
    setIsPlaylistModalOpen(false);
    window.dispatchEvent(new CustomEvent('app-toast', { detail: `Playlist "${title}" created successfully! 💖` }));
  };

  
  // Dynamic interaction handlers for social posts
  const handleLikeDuet = (id: string) => {
    setDuets(prev => prev.map(post => {
      if (post.id === id) {
        const nextLiked = !post.isLiked;
        return {
          ...post,
          isLiked: nextLiked,
          likesCount: nextLiked ? post.likesCount + 1 : post.likesCount - 1
        };
      }
      return post;
    }));
  };

  const handleAddComment = (postId: string | null) => {
    if (!postId || !commentText.trim()) return;
    const newComm: CommentObj = {
      id: Date.now().toString(),
      user: CURRENT_USER.name,
      avatar: CURRENT_USER.avatar,
      text: commentText.trim(),
      time: 'Just now',
      likes: 0,
      isLiked: false,
      replies: []
    };
    setCommentsByPost(prev => ({
      ...prev,
      [postId]: [...(prev[postId] || []), newComm]
    }));
    setDuets(prev => prev.map(p => p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p));
    setCommentText('');
    window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Comment posted! 💬' }));
  };

  const handleLikeComment = (postId: string, commentId: string) => {
    setCommentsByPost(prev => ({
      ...prev,
      [postId]: prev[postId].map(c => c.id === commentId ? { ...c, likes: c.isLiked ? c.likes - 1 : c.likes + 1, isLiked: !c.isLiked } : c)
    }));
  };

  const handleReplyToComment = (postId: string, commentId: string, replyText: string) => {
    if (!replyText.trim()) return;
    const newReply: ReplyObj = {
      id: Date.now().toString(),
      user: CURRENT_USER.name,
      avatar: CURRENT_USER.avatar,
      text: replyText.trim(),
      time: 'Just now',
      likes: 0,
      isLiked: false,
      replies: []
    };

    const addReplyRecursive = (replies: ReplyObj[]): ReplyObj[] => {
      return replies.map(r => {
        if (r.id === commentId) {
          return { ...r, replies: [...(r.replies || []), newReply] };
        }
        if (r.replies && r.replies.length > 0) {
          return { ...r, replies: addReplyRecursive(r.replies) };
        }
        return r;
      });
    };

    setCommentsByPost(prev => ({
      ...prev,
      [postId]: prev[postId].map(c => 
        c.id === commentId 
          ? { ...c, replies: [...c.replies, newReply] }
          : { ...c, replies: addReplyRecursive(c.replies) }
      )
    }));
  };


  const handleLikeReply = (postId: string, replyId: string) => {
    const likeReplyRecursive = (replies: ReplyObj[]): ReplyObj[] => {
      return replies.map(r => {
        if (r.id === replyId) {
          return { ...r, likes: r.isLiked ? r.likes - 1 : r.likes + 1, isLiked: !r.isLiked };
        }
        if (r.replies && r.replies.length > 0) {
          return { ...r, replies: likeReplyRecursive(r.replies) };
        }
        return r;
      });
    };
    
    setCommentsByPost(prev => ({
      ...prev,
      [postId]: prev[postId].map(c => ({
        ...c,
        replies: likeReplyRecursive(c.replies)
      }))
    }));
  };

  const handleSendGift = () => {
    const giftsList = [
      { id: 1, name: 'Rose', cost: 10, symbol: '🌹' },
      { id: 2, name: 'Mic', cost: 50, symbol: '🎤' },
      { id: 3, name: 'Heart', cost: 100, symbol: '💖' },
      { id: 4, name: 'Trophy', cost: 500, symbol: '🏆' },
      { id: 5, name: 'Rocket', cost: 1000, symbol: '🚀' },
      { id: 6, name: 'Crown', cost: 5000, symbol: '👑' }
    ];
    const selectedGift = giftsList.find(g => g.id === selectedGiftId);
    if (!selectedGift) return;

    if (!spendKstarCoins(appUser.id, selectedGift.cost)) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Insufficient Coins! Please recharge some. 🪙' }));
      return;
    }

    setShowGiftModal(false);

    if (giftingDuetId) {
      setDuetGifts(prev => ({
        ...prev,
        [giftingDuetId]: (prev[giftingDuetId] || 0) + 1
      }));
      window.dispatchEvent(new CustomEvent('app-toast', { detail: `Sent ${selectedGift.name} ${selectedGift.symbol} to performing duet! ✨` }));
    } else {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: `Sent ${selectedGift.name} ${selectedGift.symbol}! Thank you! ❤️` }));
    }
  };

  const handleSharePost = (post: KaraokeDuetPost) => {
    const trackId = post.recordingId ?? post.songId ?? post.id;
    openKaraokeShareModal(
      buildKaraokeTrackSharePayload({
        trackId,
        recordingId: post.recordingId ?? null,
        title: post.song,
      }),
    );
  };

  const [userDrafts, setUserDrafts] = useState<any[]>([
    { id: 'ud1', title: 'Watermelon Sugar (Partial)', artist: 'Harry Styles', date: 'Just now', duration: '1:42' },
    { id: 'ud2', title: 'Uptown Funk (Chorus Take)', artist: 'Bruno Mars', date: '3 hours ago', duration: '0:55' }
  ]);

  // Native music player states
  const [playingTrack, setPlayingTrack] = useState<any | null>(null);
  const uploadPreviewAudioRef = useRef<HTMLAudioElement | null>(null);
  const uploadPreviewVideoRef = useRef<HTMLVideoElement | null>(null);
  const coverPreviewAudioRef = useRef<HTMLAudioElement | null>(null);
  const coverPreviewVideoRef = useRef<HTMLVideoElement | null>(null);
  const trackSeekBarRef = useRef<HTMLDivElement | null>(null);
  const isTrackSeekingRef = useRef(false);
  const trackDetailsOriginRef = useRef<{
    tab: KaraokeTab;
    profileTab: KaraokeProfileTab | null;
    selectedUserProfile: any | null;
  } | null>(null);
  const captureTrackDetailsOriginRef = useRef<
    (override?: {
      tab?: KaraokeTab;
      profileTab?: KaraokeProfileTab | null;
      selectedUserProfile?: any | null;
      force?: boolean;
    }) => void
  >(() => {});
  const [coverRecordings, setCoverRecordings] = useState<KaraokeCoverRecordingMeta[]>([]);
  const [activeCoverRecording, setActiveCoverRecording] = useState<KaraokeCoverRecordingMeta | null>(null);
  const [activeCoverMediaUrl, setActiveCoverMediaUrl] = useState<string | null>(null);
  const [isPlayingTrack, setIsPlayingTrack] = useState(false);
  const [trackProgress, setTrackProgress] = useState(0); // 0 to 100
  const [trackTime, setTrackTime] = useState(0); // in seconds
  const [trackMaxSeconds, setTrackMaxSeconds] = useState(180); // defaulted to 3 min
  const [showTrackPlayerControls, setShowTrackPlayerControls] = useState(true);
  const [isTrackSeeking, setIsTrackSeeking] = useState(false);

  // Tracks details screen state
  const [showTrackDetails, setShowTrackDetails] = useState(false);

  captureTrackDetailsOriginRef.current = (override) => {
    if (trackDetailsOriginRef.current && !override?.force) return;
    if (showTrackDetails && !override?.force) return;
    trackDetailsOriginRef.current = {
      tab: override?.tab ?? activeTab,
      profileTab:
        override?.profileTab !== undefined
          ? override.profileTab
          : activeTab === 'profile'
            ? profileActiveTab
            : null,
      selectedUserProfile:
        override?.selectedUserProfile !== undefined
          ? override.selectedUserProfile
          : selectedUserProfile,
    };
  };
  const [detailsTab, setDetailsTab] = useState<'recordings' | 'lyrics'>('lyrics');
  const [bookmarkedTracks, setBookmarkedTracks] = useState<string[]>(['epic_underworld']);
  const [followedCreators, setFollowedCreators] = useState<string[]>([]);

  // Unified helper queries to keep social follow states fully synchronized
  const isFollowingUser = (handle: string) => {
    const userId = resolveUserIdFromKaraokeHandle(handle, db.users);
    if (userId) return db.isFollowingUser(userId);
    const cleanNoAt = handle.replace('@', '');
    return followedCreators.includes(cleanNoAt) || followedCreators.includes(handle);
  };

  const toggleFollowUser = (handle: string) => {
    const cleanWithAt = handle.startsWith('@') ? handle : '@' + handle;
    const userId = resolveUserIdFromKaraokeHandle(handle, db.users);
    if (userId) {
      db.toggleFollow(userId);
      const nowFollowing = db.isFollowingUser(userId);
      window.dispatchEvent(
        new CustomEvent('app-toast', {
          detail: nowFollowing ? `Following ${cleanWithAt}! 💖` : `Unfollowed ${cleanWithAt} 💔`,
        }),
      );
      return;
    }

    const cleanNoAt = handle.replace('@', '');
    const isFollowing = isFollowingUser(handle);

    if (isFollowing) {
      setFollowedCreators((prev) => prev.filter((c) => c !== cleanNoAt && c !== handle));
      window.dispatchEvent(new CustomEvent('app-toast', { detail: `Unfollowed ${cleanWithAt} 💔` }));
    } else {
      setFollowedCreators((prev) => [...prev, cleanNoAt]);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: `Following ${cleanWithAt}! 💖` }));
    }
  };

  // Reload cover recordings when the active track changes.
  useEffect(() => {
    if (!playingTrack?.id) {
      setCoverRecordings([]);
      return;
    }
    setCoverRecordings(listKaraokeCoverRecordings(playingTrack.id));
  }, [playingTrack?.id]);

  useEffect(() => {
    if (showTrackDetails) {
      setShowTrackPlayerControls(true);
    }
  }, [showTrackDetails, playingTrack?.id, activeCoverRecording?.id]);

  const pauseUploadPreviewMedia = useCallback(() => {
    uploadPreviewAudioRef.current?.pause();
    uploadPreviewVideoRef.current?.pause();
  }, []);

  const pauseCoverPreviewMedia = useCallback(() => {
    coverPreviewAudioRef.current?.pause();
    coverPreviewVideoRef.current?.pause();
  }, []);

  const resolveKaraokeSong = useCallback((songId: string): KaraokeLibrarySong | undefined => {
    const communityUploads = listKaraokeUploads().map(metaToLibrarySong);
    return [...trendingSongs, ...librarySongs, ...communityUploads].find((song) => song.id === songId);
  }, [trendingSongs, librarySongs, uploadedSongs]);

  const playCoverRecording = useCallback(async (recording: KaraokeCoverRecordingMeta) => {
    const url = await resolveKaraokeCoverRecordingUrl(recording.id);
    if (!url) {
      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: recording.hasMedia
          ? 'Could not load this cover recording.'
          : 'No audio/video saved for this cover yet.',
      }));
      return;
    }

    pauseUploadPreviewMedia();

    if (activeCoverRecording?.id && activeCoverRecording.id !== recording.id) {
      revokeKaraokeCoverRecordingUrl(activeCoverRecording.id);
    }

    if (!playingTrack || playingTrack.id !== recording.songId) {
      let song = resolveKaraokeSong(recording.songId);
      if (song?.isUploaded) {
        song = await enrichUploadedKaraokeSong(song);
      }
      const track: KaraokeLibrarySong = song ?? {
        id: recording.songId,
        title: recording.songTitle,
        artist: recording.performers[0]?.name || 'Unknown',
        img: recording.img,
      };
      setPlayingTrack({
        ...track,
        plays: track.plays || formatRecordingCount(recording.plays),
        likes: formatRecordingCount(recording.likes),
        img: track.img || recording.img,
      });
      captureTrackDetailsOriginRef.current();
      setShowTrackDetails(true);
      setDetailsTab('recordings');
    }

    setActiveCoverRecording(recording);
    setActiveCoverMediaUrl(url);
    setTrackMaxSeconds(Math.max(1, Math.floor(recording.durationSec ?? 180)));
    setTrackTime(0);
    setTrackProgress(0);
    setShowTrackPlayerControls(true);
    setIsPlayingTrack(true);
    incrementKaraokeCoverRecordingPlays(recording.id);
    setCoverRecordings(listKaraokeCoverRecordings(recording.songId));
    syncKaraokeUrl({
      tab: activeTab,
      profileTab: activeTab === 'profile' ? profileActiveTab : null,
      track: recording.songId,
      recording: recording.id,
      user: null,
    });
    window.dispatchEvent(new CustomEvent('app-toast', {
      detail: `Playing ${performanceTypeLabel(recording.performanceType)} cover by ${recording.performers.map((p) => p.handle).join(' + ')} 🎧`,
    }));
  }, [
    activeCoverRecording?.id,
    activeTab,
    pauseUploadPreviewMedia,
    playingTrack,
    profileActiveTab,
    resolveKaraokeSong,
  ]);

  const openKaraokeTrackFromShare = useCallback(
    async (trackId: string, recordingId?: string | null) => {
      setActiveTab('feed');
      const song = resolveKaraokeSong(trackId);
      if (!song) {
        window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Track not found on K-Star' }));
        return;
      }
      if (song.isUploaded) {
        await openUploadedSongListen(song);
      } else {
        setPlayingTrack({
          ...song,
          plays: song.plays || '0',
          likes: '0',
        });
        const recordings = listKaraokeCoverRecordings(trackId);
        setCoverRecordings(recordings);
        setDetailsTab(recordings.length > 0 || recordingId ? 'recordings' : 'lyrics');
        captureTrackDetailsOriginRef.current({
          tab: 'feed',
          profileTab: null,
          selectedUserProfile: null,
          force: true,
        });
        setShowTrackDetails(true);
      }
      if (recordingId) {
        const recordings = listKaraokeCoverRecordings(trackId);
        const recording = recordings.find((row) => row.id === recordingId);
        if (recording) await playCoverRecording(recording);
      }
    },
    [resolveKaraokeSong, openUploadedSongListen, playCoverRecording],
  );

  useEffect(() => {
    const onRoomOpen = (event: Event) => {
      const roomId = (event as CustomEvent<{ roomId?: string }>).detail?.roomId;
      if (!roomId) return;
      openSmuleRoomFlow(`/room/${roomId}`);
    };
    const onTrackOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ trackId?: string; recordingId?: string | null }>).detail;
      if (!detail?.trackId) return;
      void openKaraokeTrackFromShare(detail.trackId, detail.recordingId);
    };
    window.addEventListener('karaoke-room-open', onRoomOpen);
    window.addEventListener('karaoke-track-open', onTrackOpen);
    return () => {
      window.removeEventListener('karaoke-room-open', onRoomOpen);
      window.removeEventListener('karaoke-track-open', onTrackOpen);
    };
  }, [openKaraokeTrackFromShare]);

  const toggleCoverRecordingPlayback = useCallback((recording: KaraokeCoverRecordingMeta) => {
    if (activeCoverRecording?.id === recording.id) {
      setIsPlayingTrack((prev) => !prev);
      return;
    }
    void playCoverRecording(recording);
  }, [activeCoverRecording?.id, playCoverRecording]);

  const playUploadBackingTrack = useCallback(async () => {
    if (!playingTrack?.isUploaded) return;
    pauseCoverPreviewMedia();
    if (activeCoverRecording?.id) {
      revokeKaraokeCoverRecordingUrl(activeCoverRecording.id);
    }
    setActiveCoverRecording(null);
    setActiveCoverMediaUrl(null);

    let song = playingTrack;
    if (!song.audioUrl) {
      song = await enrichUploadedKaraokeSong(playingTrack);
      setPlayingTrack(song);
    }
    if (!song.audioUrl) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Audio file not found for this upload.' }));
      return;
    }

    setTrackMaxSeconds(Math.max(30, Math.floor(song.durationSec ?? 180)));
    setTrackTime(0);
    setTrackProgress(0);
    setShowTrackPlayerControls(true);
    setIsPlayingTrack(true);
    syncKaraokeUrl({
      tab: activeTab,
      profileTab: activeTab === 'profile' ? profileActiveTab : null,
      track: song.id,
      recording: null,
      user: null,
    });
  }, [activeCoverRecording?.id, activeTab, pauseCoverPreviewMedia, playingTrack, profileActiveTab]);

  const loadUserCovers = useCallback(() => {
    const cards = listUserCoverCards(appUser.id);
    setUserCovers(cards);
  }, [appUser.id]);

  const prependPublishedCoverToFeed = useCallback(async (meta: KaraokeCoverRecordingMeta) => {
    const post = coverRecordingToFeedPost(meta);
    if (meta.hasMedia) {
      const url = await resolveKaraokeCoverRecordingUrl(meta.id);
      if (url) post.videoUrl = url;
    }
    setDuets((prev) => [post, ...prev.filter((row) => row.id !== post.id)]);
  }, []);

  const openCoverAfterPublish = useCallback(async (
    meta: KaraokeCoverRecordingMeta,
    options?: { navigateToProfile?: boolean },
  ) => {
    let song = resolveKaraokeSong(meta.songId);
    if (song?.isUploaded) {
      song = await enrichUploadedKaraokeSong(song);
    }
    const track: KaraokeLibrarySong = song ?? {
      id: meta.songId,
      title: meta.songTitle,
      artist: meta.performers[0]?.name || 'Unknown',
      img: meta.img,
    };
    setActiveCoverRecording(null);
    setActiveCoverMediaUrl(null);
    setPlayingTrack({
      ...track,
      plays: track.plays || formatRecordingCount(meta.plays),
      likes: formatRecordingCount(meta.likes),
      img: track.img || meta.img,
    });
    setTrackMaxSeconds(Math.max(30, Math.floor(meta.durationSec ?? track.durationSec ?? 180)));
    setTrackTime(0);
    setTrackProgress(0);
    setIsPlayingTrack(false);
    setCoverRecordings(listKaraokeCoverRecordings(meta.songId));
    setDetailsTab('recordings');

    if (options?.navigateToProfile) {
      setProfileActiveTab('covers');
      setActiveTab('profile');
      setSelectedUserProfile(null);
      captureTrackDetailsOriginRef.current({
        tab: 'profile',
        profileTab: 'covers',
        selectedUserProfile: null,
        force: true,
      });
    } else {
      captureTrackDetailsOriginRef.current();
    }

    setShowTrackDetails(true);
    await playCoverRecording(meta);
  }, [resolveKaraokeSong, playCoverRecording]);

  const handlePublishedCover = useCallback(async (meta: KaraokeCoverRecordingMeta) => {
    setSelectedSong(null);
    loadUserCovers();
    await prependPublishedCoverToFeed(meta);
    syncKaraokeUrl({
      tab: 'profile',
      profileTab: 'covers',
      track: meta.songId,
      recording: meta.id,
      user: null,
    });
    await openCoverAfterPublish(meta, { navigateToProfile: true });
  }, [loadUserCovers, prependPublishedCoverToFeed, openCoverAfterPublish]);

  useEffect(() => {
    loadUserCovers();
  }, [loadUserCovers]);

  useEffect(() => {
    let cancelled = false;
    const hydrateFeedFromPublishedCovers = async () => {
      const published = listKaraokeCoverRecordingsForUser(appUser.id);
      if (published.length === 0) return;
      const posts = await Promise.all(
        published.map(async (meta) => {
          const post = coverRecordingToFeedPost(meta);
          if (meta.hasMedia) {
            const url = await resolveKaraokeCoverRecordingUrl(meta.id);
            if (url) post.videoUrl = url;
          }
          return post;
        }),
      );
      if (cancelled) return;
      setDuets((prev) => {
        const publishedIds = new Set(posts.map((post) => post.id));
        return [...posts, ...prev.filter((post) => !publishedIds.has(post.id))];
      });
    };
    void hydrateFeedFromPublishedCovers();
    return () => {
      cancelled = true;
    };
  }, [appUser.id]);

  useEffect(() => {
    const syncRecordings = (e: Event) => {
      loadUserCovers();
      const songId = (e as CustomEvent<{ songId?: string }>).detail?.songId;
      if (playingTrack?.id && (!songId || songId === playingTrack.id)) {
        setCoverRecordings(listKaraokeCoverRecordings(playingTrack.id));
      }
      if (activeCoverRecording?.id) {
        const fresh = listKaraokeCoverRecordings().find((row) => row.id === activeCoverRecording.id);
        if (fresh) setActiveCoverRecording(fresh);
      }
    };
    window.addEventListener('karaoke-recordings-updated', syncRecordings);
    return () => window.removeEventListener('karaoke-recordings-updated', syncRecordings);
  }, [loadUserCovers, playingTrack?.id, activeCoverRecording?.id]);

  const openUserCoverCard = useCallback(async (cover: KaraokeUserCoverCard) => {
    const persisted = listKaraokeCoverRecordings(cover.songId).find(
      (row) => row.id === cover.recordingId || row.id === cover.id,
    );
    if (persisted) {
      syncKaraokeUrl({
        tab: 'profile',
        profileTab: 'covers',
        track: persisted.songId,
        recording: persisted.id,
        user: null,
      });
      await openCoverAfterPublish(persisted, { navigateToProfile: true });
      return;
    }
    setPlayingTrack({
      id: cover.songId,
      title: cover.title,
      artist: cover.artist,
      plays: cover.plays,
      likes: typeof cover.likes === 'number' ? String(cover.likes) : cover.likes,
      img: cover.img,
    });
    setTrackTime(0);
    setTrackMaxSeconds(cover.title.toLowerCase().includes('bohemian') ? 162 : cover.title.toLowerCase().includes('blinding') ? 112 : 98);
    setIsPlayingTrack(true);
    window.dispatchEvent(new CustomEvent('app-toast', { detail: `Playing "${cover.title}" in Native Player 🎧` }));
  }, [openCoverAfterPublish]);

  const clearActiveCoverPlayback = useCallback(() => {
    if (activeCoverRecording?.id) {
      revokeKaraokeCoverRecordingUrl(activeCoverRecording.id);
    }
    setActiveCoverRecording(null);
    setActiveCoverMediaUrl(null);
  }, [activeCoverRecording?.id]);

  const buildPlayingTrackFromLibrary = useCallback((song: KaraokeLibrarySong) => ({
    ...song,
    plays: song.plays || '1.1M',
    img:
      song.img ||
      `https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&auto=format&fit=crop&q=60&seed=${song.id}`,
  }), []);

  const getPlayerQueueSongs = useCallback((): KaraokeLibrarySong[] => {
    return [...trendingSongs, ...librarySongs, ...uploadedSongs];
  }, [trendingSongs, librarySongs, uploadedSongs]);

  const switchPlayingTrack = useCallback((song: KaraokeLibrarySong) => {
    pauseUploadPreviewMedia();
    pauseCoverPreviewMedia();
    if (activeCoverRecording?.id) {
      revokeKaraokeCoverRecordingUrl(activeCoverRecording.id);
    }
    clearActiveCoverPlayback();
    const nextTrack = buildPlayingTrackFromLibrary(song);
    setPlayingTrack(nextTrack);
    setCoverRecordings(listKaraokeCoverRecordings(nextTrack.id));
    setTrackTime(0);
    setTrackMaxSeconds(Math.max(30, Math.floor(nextTrack.durationSec ?? 120)));
    setIsPlayingTrack(Boolean(nextTrack.audioUrl));
    syncKaraokeUrl({
      tab: activeTabRef.current,
      profileTab: activeTabRef.current === 'profile' ? profileActiveTab : null,
      user:
        activeTabRef.current === 'profile' && selectedUserProfile?.handle
          ? selectedUserProfile.handle.replace(/^@/, '')
          : null,
      track: nextTrack.id,
      recording: null,
    }, 'push');
    lastAppliedSearchRef.current = window.location.search;
  }, [
    activeCoverRecording?.id,
    buildPlayingTrackFromLibrary,
    clearActiveCoverPlayback,
    pauseCoverPreviewMedia,
    pauseUploadPreviewMedia,
    profileActiveTab,
    selectedUserProfile?.handle,
  ]);

  const handleNextTrack = () => {
    const allSongs = getPlayerQueueSongs();
    if (allSongs.length === 0) return;
    const currentIndex = playingTrack ? allSongs.findIndex((s) => s.id === playingTrack.id) : -1;
    const nextSong =
      currentIndex !== -1 && currentIndex < allSongs.length - 1
        ? allSongs[currentIndex + 1]
        : allSongs[0];
    switchPlayingTrack(nextSong);
    window.dispatchEvent(new CustomEvent('app-toast', { detail: `Next up: "${nextSong.title}" 🎧` }));
  };

  const handlePrevTrack = () => {
    const allSongs = getPlayerQueueSongs();
    if (allSongs.length === 0) return;
    const currentIndex = playingTrack ? allSongs.findIndex((s) => s.id === playingTrack.id) : -1;
    if (currentIndex <= 0) return;
    const prevSong = allSongs[currentIndex - 1];
    switchPlayingTrack(prevSong);
    window.dispatchEvent(new CustomEvent('app-toast', { detail: `Previous track: "${prevSong.title}" 🎧` }));
  };

  const openSearchHitListen = useCallback(async (hit: KaraokeSearchHit) => {
    captureTrackDetailsOriginRef.current();
    if (hit.kind === 'upload' && hit.catalogSong) {
      if (hit.isMine) {
        syncKaraokeUrl({
          tab: 'profile',
          profileTab: 'uploads',
          track: hit.songId,
          recording: null,
          user: null,
        });
        setActiveTab('profile');
        setProfileActiveTab('uploads');
      } else {
        syncKaraokeUrl({
          tab: 'search',
          track: hit.songId,
          recording: null,
          profileTab: null,
          user: null,
        });
      }
      await openUploadedSongListen(hit.catalogSong);
      return;
    }
    if (hit.kind === 'cover' && hit.coverMeta) {
      if (hit.isMine) {
        syncKaraokeUrl({
          tab: 'profile',
          profileTab: 'covers',
          track: hit.songId,
          recording: hit.recordingId ?? hit.id,
          user: null,
        });
        setActiveTab('profile');
        setProfileActiveTab('covers');
      } else {
        syncKaraokeUrl({
          tab: 'search',
          track: hit.songId,
          recording: hit.recordingId ?? hit.id,
          profileTab: null,
          user: null,
        });
      }
      await openCoverAfterPublish(hit.coverMeta);
      return;
    }
    const song = hit.catalogSong;
    if (!song) return;
    syncKaraokeUrl({ tab: 'search', track: song.id, recording: null, profileTab: null, user: null });
    const recordings = listKaraokeCoverRecordings(song.id);
    setPlayingTrack({
      ...song,
      plays: song.plays || '1.1M',
      likes: '8K',
      img: song.img || hit.img,
    });
    setCoverRecordings(recordings);
    setDetailsTab(recordings.length > 0 ? 'recordings' : 'lyrics');
    captureTrackDetailsOriginRef.current({
      tab: 'search',
      profileTab: null,
      selectedUserProfile: null,
      force: true,
    });
    setShowTrackDetails(true);
    setTrackTime(0);
    setTrackMaxSeconds(Math.max(30, Math.floor(song.durationSec ?? 125)));
    setTrackProgress(0);
    setIsPlayingTrack(false);
    clearActiveCoverPlayback();
  }, [openCoverAfterPublish, openUploadedSongListen, clearActiveCoverPlayback]);

  const openSearchHitSing = useCallback(async (hit: KaraokeSearchHit) => {
    if (hit.kind === 'upload' && hit.catalogSong) {
      if (hit.isMine) {
        syncKaraokeUrl({
          tab: 'profile',
          profileTab: 'uploads',
          track: hit.songId,
          recording: null,
          user: null,
        });
        setActiveTab('profile');
        setProfileActiveTab('uploads');
      } else {
        syncKaraokeUrl({ tab: 'search', track: hit.songId, recording: null, profileTab: null, user: null });
      }
      await openUploadedSongSing(hit.catalogSong);
      return;
    }
    let song =
      hit.kind === 'cover' && hit.coverMeta
        ? resolveKaraokeSong(hit.coverMeta.songId)
        : hit.catalogSong;
    if (song?.isUploaded) {
      song = await enrichUploadedKaraokeSong(song);
    }
    if (!song) return;
    syncKaraokeUrl({ tab: 'sing', track: song.id, recording: null, profileTab: null, user: null });
    setPreviousTab(activeTab);
    setSelectedSong(song);
  }, [activeTab, openUploadedSongSing, resolveKaraokeSong]);

  const applyKaraokeUrlState = useCallback(async () => {
    const params = parseKaraokeUrlParams(window.location.search);

    if (params.tab && isKaraokeTab(params.tab)) {
      setActiveTab(params.tab as typeof activeTab);
    }
    if (params.profileTab) {
      setProfileActiveTab(params.profileTab);
    }

    if (params.user && (!params.tab || params.tab === 'profile')) {
      setActiveTab('profile');
      const fromUrl = buildKaraokeProfileFromHandle(params.user, db.users);
      setSelectedUserProfile(
        isOtherKaraokeProfile(fromUrl, appUser.id) ? fromUrl : null,
      );
    }

    const allUploadMetas = listKaraokeUploads();
    const allUploadSongs = allUploadMetas.map(metaToLibrarySong);
    const allCoverMetas = listKaraokeCoverRecordings();

    if (params.recording) {
      const meta = allCoverMetas.find((row) => row.id === params.recording);
      if (meta) {
        captureTrackDetailsOriginRef.current({
          tab: (params.tab as typeof activeTab) || activeTabRef.current,
          profileTab:
            params.profileTab ??
            (params.tab === 'profile' ? profileActiveTabRef.current : null),
          selectedUserProfile: params.user ? selectedUserProfileRef.current : null,
          force: true,
        });
        await openCoverAfterPublish(meta, {
          navigateToProfile: params.tab === 'profile' && params.profileTab === 'covers',
        });
        return;
      }
    }

    if (!params.track) return;

    const ref = resolveKaraokeTrackRef(params.track, {
      catalog: [...TRENDING_SONGS, ...LIBRARY_SONGS],
      uploads: allUploadSongs,
      coverMetas: allCoverMetas,
    });

    if (ref?.kind === 'upload') {
      const song = allUploadSongs.find((row) => row.id === ref.songId);
      if (song) {
        captureTrackDetailsOriginRef.current({
          tab: (params.tab as typeof activeTab) || activeTabRef.current,
          profileTab:
            params.profileTab ??
            (params.tab === 'profile' ? profileActiveTabRef.current : null),
          selectedUserProfile: params.user ? selectedUserProfileRef.current : null,
          force: true,
        });
        await openUploadedSongListen(song);
      }
      return;
    }

    if (ref?.kind === 'cover' && ref.recordingId) {
      const meta = allCoverMetas.find((row) => row.id === ref.recordingId);
      if (meta) {
        captureTrackDetailsOriginRef.current({
          tab: (params.tab as typeof activeTab) || activeTabRef.current,
          profileTab:
            params.profileTab ??
            (params.tab === 'profile' ? profileActiveTabRef.current : null),
          selectedUserProfile: params.user ? selectedUserProfileRef.current : null,
          force: true,
        });
        await openCoverAfterPublish(meta, {
          navigateToProfile: params.tab === 'profile' && params.profileTab === 'covers',
        });
      }
      return;
    }

    if (ref?.kind === 'catalog') {
      const song = [...TRENDING_SONGS, ...LIBRARY_SONGS].find((row) => row.id === ref.songId);
      if (!song) return;
      const recordings = listKaraokeCoverRecordings(song.id);
      const catalogSong: KaraokeLibrarySong = {
        id: song.id,
        title: song.title,
        artist: song.artist,
        plays: song.plays,
        category: 'category' in song ? song.category : undefined,
        type: song.type,
        img: 'img' in song ? song.img : undefined,
        durationSec:
          'durationSec' in song && typeof song.durationSec === 'number'
            ? song.durationSec
            : undefined,
      };
      setPlayingTrack({
        ...catalogSong,
        plays: catalogSong.plays || '1.0M',
        likes: '450',
        img: catalogSong.img,
      });
      setCoverRecordings(recordings);
      setDetailsTab(recordings.length > 0 ? 'recordings' : 'lyrics');
      captureTrackDetailsOriginRef.current({
        tab: (params.tab as typeof activeTab) || activeTabRef.current,
        profileTab:
          params.profileTab ??
          (params.tab === 'profile' ? profileActiveTabRef.current : null),
        selectedUserProfile: params.user ? selectedUserProfileRef.current : null,
        force: true,
      });
      setShowTrackDetails(true);
      setTrackTime(0);
      setTrackMaxSeconds(Math.max(30, Math.floor(catalogSong.durationSec ?? 120)));
      setIsPlayingTrack(false);
    }
  }, [appUser.id, openCoverAfterPublish, openUploadedSongListen]);

  const isPlayingTrackRef = useRef(isPlayingTrack);
  isPlayingTrackRef.current = isPlayingTrack;

  useEffect(() => {
    const search = window.location.search;
    if (!search || search === lastAppliedSearchRef.current) return;
    void applyKaraokeUrlState().finally(() => {
      lastAppliedSearchRef.current = search;
    });
  }, [applyKaraokeUrlState]);

  useEffect(() => {
    const onPopState = () => {
      lastAppliedSearchRef.current = '';
      void applyKaraokeUrlState().finally(() => {
        lastAppliedSearchRef.current = window.location.search;
      });
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [applyKaraokeUrlState]);

  const closeTrackDetails = useCallback(() => {
    pauseUploadPreviewMedia();
    pauseCoverPreviewMedia();
    clearActiveCoverPlayback();
    setIsPlayingTrack(false);
    setTrackTime(0);
    setTrackProgress(0);
    setShowTrackDetails(false);

    const origin = trackDetailsOriginRef.current;
    trackDetailsOriginRef.current = null;

    const returnTab = origin?.tab ?? activeTab;
    const returnProfileTab =
      returnTab === 'profile' ? origin?.profileTab ?? profileActiveTab : null;
    const returnUserProfile = origin?.selectedUserProfile ?? null;

    if (origin) {
      setActiveTab(returnTab);
      if (returnTab === 'profile' && returnProfileTab) {
        setProfileActiveTab(returnProfileTab);
      }
      setSelectedUserProfile(returnUserProfile);
    }

    syncKaraokeUrl({
      tab: returnTab,
      profileTab: returnProfileTab,
      track: null,
      recording: null,
      user:
        returnTab === 'profile' && returnUserProfile?.handle
          ? returnUserProfile.handle.replace(/^@/, '')
          : null,
    });
    lastAppliedSearchRef.current = window.location.search;
  }, [
    activeTab,
    profileActiveTab,
    pauseUploadPreviewMedia,
    pauseCoverPreviewMedia,
    clearActiveCoverPlayback,
  ]);

  const getTrackPreviewMedia = useCallback((): HTMLMediaElement | null => {
    const coverActive = Boolean(activeCoverRecording && activeCoverMediaUrl);
    const uploadActive = Boolean(playingTrack?.audioUrl && !coverActive);
    if (!coverActive && !uploadActive) return null;

    const isVideo = coverActive
      ? isCoverRecordingVideo(activeCoverRecording!)
      : isUploadedVideoTrack(playingTrack);

    if (coverActive) {
      return isVideo ? coverPreviewVideoRef.current : coverPreviewAudioRef.current;
    }
    return isVideo ? uploadPreviewVideoRef.current : uploadPreviewAudioRef.current;
  }, [activeCoverRecording, activeCoverMediaUrl, playingTrack]);

  const seekTrackPreviewToRatio = useCallback((ratio: number) => {
    const clamped = Math.min(1, Math.max(0, ratio));
    const duration = Math.max(1, trackMaxSeconds);
    const nextTime = clamped * duration;

    setTrackProgress(clamped * 100);
    setTrackTime(Math.floor(nextTime));

    const media = getTrackPreviewMedia();
    if (media) {
      const mediaDuration = Number.isFinite(media.duration) && media.duration > 0 ? media.duration : duration;
      media.currentTime = clamped * mediaDuration;
    }
  }, [getTrackPreviewMedia, trackMaxSeconds]);

  const seekTrackPreviewFromClientX = useCallback((clientX: number) => {
    const bar = trackSeekBarRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    if (rect.width <= 0) return;
    seekTrackPreviewToRatio((clientX - rect.left) / rect.width);
  }, [seekTrackPreviewToRatio]);

  const handleTrackSeekPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    setIsTrackSeeking(true);
    isTrackSeekingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    seekTrackPreviewFromClientX(e.clientX);
  }, [seekTrackPreviewFromClientX]);

  const handleTrackSeekPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isTrackSeekingRef.current) return;
    e.stopPropagation();
    seekTrackPreviewFromClientX(e.clientX);
  }, [seekTrackPreviewFromClientX]);

  const handleTrackSeekPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isTrackSeekingRef.current) return;
    e.stopPropagation();
    isTrackSeekingRef.current = false;
    setIsTrackSeeking(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  const trackMaxSecondsRef = useRef(trackMaxSeconds);
  trackMaxSecondsRef.current = trackMaxSeconds;

  // Bind cover recording media (layout effect so video refs exist before play).
  useLayoutEffect(() => {
    if (!activeCoverRecording || !activeCoverMediaUrl) return;

    const isVideo = isCoverRecordingVideo(activeCoverRecording);
    const media = isVideo ? coverPreviewVideoRef.current : coverPreviewAudioRef.current;
    if (!media) return;

    let disposed = false;

    const applyProgress = () => {
      if (disposed || isTrackSeekingRef.current) return;
      const duration =
        Number.isFinite(media.duration) && media.duration > 0
          ? media.duration
          : trackMaxSecondsRef.current;
      const safeDuration = Math.max(1, duration);
      setTrackTime(Math.floor(media.currentTime));
      setTrackMaxSeconds(Math.max(1, Math.floor(safeDuration)));
      setTrackProgress(Math.min(100, (media.currentTime / safeDuration) * 100));
    };

    const onEnded = () => {
      if (disposed) return;
      setIsPlayingTrack(false);
      setTrackTime(0);
      setTrackProgress(0);
    };

    if (media.getAttribute('data-preview-src') !== activeCoverMediaUrl) {
      media.setAttribute('data-preview-src', activeCoverMediaUrl);
      media.src = activeCoverMediaUrl;
      media.load();
    }

    media.addEventListener('loadedmetadata', applyProgress);
    media.addEventListener('timeupdate', applyProgress);
    media.addEventListener('ended', onEnded);

    return () => {
      disposed = true;
      media.removeEventListener('loadedmetadata', applyProgress);
      media.removeEventListener('timeupdate', applyProgress);
      media.removeEventListener('ended', onEnded);
      media.pause();
    };
  }, [
    activeCoverRecording?.id,
    activeCoverMediaUrl,
    activeCoverRecording?.mediaKind,
    activeCoverRecording?.mimeType,
  ]);

  // Bind upload backing media when no cover is active.
  useLayoutEffect(() => {
    if (activeCoverRecording && activeCoverMediaUrl) return;
    if (!playingTrack?.audioUrl) return;

    const isVideo = isUploadedVideoTrack(playingTrack);
    const media = isVideo ? uploadPreviewVideoRef.current : uploadPreviewAudioRef.current;
    const src = playingTrack.audioUrl;
    if (!media || !src) return;

    let disposed = false;

    const applyProgress = () => {
      if (disposed || isTrackSeekingRef.current) return;
      const duration =
        Number.isFinite(media.duration) && media.duration > 0
          ? media.duration
          : trackMaxSecondsRef.current;
      const safeDuration = Math.max(1, duration);
      setTrackTime(Math.floor(media.currentTime));
      setTrackMaxSeconds(Math.max(1, Math.floor(safeDuration)));
      setTrackProgress(Math.min(100, (media.currentTime / safeDuration) * 100));
    };

    const onEnded = () => {
      if (disposed) return;
      setIsPlayingTrack(false);
      setTrackTime(0);
      setTrackProgress(0);
    };

    if (media.getAttribute('data-preview-src') !== src) {
      media.setAttribute('data-preview-src', src);
      media.src = src;
      media.load();
    }

    media.addEventListener('loadedmetadata', applyProgress);
    media.addEventListener('timeupdate', applyProgress);
    media.addEventListener('ended', onEnded);

    return () => {
      disposed = true;
      media.removeEventListener('loadedmetadata', applyProgress);
      media.removeEventListener('timeupdate', applyProgress);
      media.removeEventListener('ended', onEnded);
      media.pause();
    };
  }, [
    activeCoverRecording?.id,
    activeCoverMediaUrl,
    playingTrack?.id,
    playingTrack?.audioUrl,
    playingTrack?.isVideo,
    playingTrack?.mediaKind,
  ]);

  // Play / pause after media is ready (fixes play() before canplay race).
  useEffect(() => {
    const coverActive = Boolean(activeCoverRecording && activeCoverMediaUrl);
    const uploadActive = Boolean(playingTrack?.audioUrl && !coverActive);
    if (!coverActive && !uploadActive) return;

    const media = getTrackPreviewMedia();
    if (!media) return;

    if (!isPlayingTrack) {
      media.pause();
      return;
    }

    const boundSrc = media.getAttribute('data-preview-src');
    if (!boundSrc && !media.src) return;

    const startPlayback = () => {
      if (!isPlayingTrackRef.current) return;
      void media.play().catch(() => {
        window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Could not play this track.' }));
        setIsPlayingTrack(false);
      });
    };

    if (media.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      startPlayback();
      return;
    }

    media.addEventListener('canplay', startPlayback, { once: true });
    return () => media.removeEventListener('canplay', startPlayback);
  }, [
    isPlayingTrack,
    activeCoverRecording?.id,
    activeCoverMediaUrl,
    activeCoverRecording?.mediaKind,
    activeCoverRecording?.mimeType,
    playingTrack?.id,
    playingTrack?.audioUrl,
    playingTrack?.isVideo,
    playingTrack?.mediaKind,
    getTrackPreviewMedia,
  ]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const hasRealMedia = Boolean(playingTrack?.audioUrl || activeCoverMediaUrl);
    if (isPlayingTrack && playingTrack && !hasRealMedia) {
      timer = setInterval(() => {
        if (isTrackSeekingRef.current) return;
        setTrackTime(prev => {
          if (prev >= trackMaxSeconds) {
            setIsPlayingTrack(false);
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlayingTrack, playingTrack, trackMaxSeconds, activeCoverMediaUrl]);

  useEffect(() => {
    const hasRealMedia = Boolean(playingTrack?.audioUrl || activeCoverMediaUrl);
    if (hasRealMedia || isTrackSeekingRef.current) return;
    if (trackMaxSeconds > 0) {
      setTrackProgress((trackTime / trackMaxSeconds) * 100);
    }
  }, [trackTime, trackMaxSeconds, activeCoverMediaUrl, playingTrack?.audioUrl]);
  
  const copyToClipboard = (text: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
          window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Link copied to clipboard! 📋' }));
        }).catch(() => {
          fallbackCopy(text);
        });
      } else {
        fallbackCopy(text);
      }
    } catch (err) {
      fallbackCopy(text);
    }
  };

  const fallbackCopy = (text: string) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.width = "2em";
    textArea.style.height = "2em";
    textArea.style.padding = "0";
    textArea.style.border = "none";
    textArea.style.outline = "none";
    textArea.style.boxShadow = "none";
    textArea.style.background = "transparent";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Link copied to clipboard! 📋' }));
      } else {
        prompt("Copy this link:", text);
      }
    } catch (err) {
      prompt("Copy this link:", text);
    }
    document.body.removeChild(textArea);
  };

  const [viewingPlaylist, setViewingPlaylist] = useState<any | null>(null);

  const getDesktopSidebarLeaders = () => {
    return [...Array(10)].map((_, idx) => ({
      rank: idx + 1,
      seed: desktopLeaderboardTab === 'weekly' ? `week${idx}` : `alltime${idx}`,
      name: desktopLeaderboardTab === 'weekly' ? `@vocal_master_${idx+1}` : `@alltime_legend_${idx+1}`,
      followers: desktopLeaderboardTab === 'weekly' ? `${100 - idx * 8}k` : `${950 - idx * 50}k`,
      gifts: desktopLeaderboardTab === 'weekly' ? `${(50 - idx * 2).toFixed(1)}M` : `${(900 - idx * 20).toFixed(1)}M`,
      isPro: idx < 3
    }));
  };
  const desktopSidebarLeaders = getDesktopSidebarLeaders();
  
  const burmeseMessages = [
    "တံခါးဖွင့်ကပါ",
    "မသုံးတာကြာကလို",
    "ပုံ",
    "ေလျမြတံက္ခးမိဈေရးခြားသူတစု",
    "ဉီး"
  ];

  const trackDetailsCreator = useMemo(
    () =>
      resolveTrackDetailsCreator({
        playingTrack,
        activeCoverRecording,
        uploadMetas: uploadedSongMetas,
        currentUser: {
          id: CURRENT_USER.id,
          name: CURRENT_USER.name,
          handle: CURRENT_USER.handle,
          avatar: CURRENT_USER.avatar,
        },
        userVip,
      }),
    [playingTrack, activeCoverRecording, uploadedSongMetas, CURRENT_USER, userVip],
  );

  if (selectedSong) {
    return (
      <div data-karaoke-surface="true" className="flex h-full w-full min-h-0">
        <RecordingStudio
          song={selectedSong}
          onClose={() => setSelectedSong(null)}
          onPublished={(meta) => { void handlePublishedCover(meta); }}
        />
      </div>
    );
  }

  return (
    <div
      data-karaoke-surface="true"
      className="flex w-full h-full bg-background overflow-hidden relative transition-colors duration-300"
    >
      
      {/* Left Navigation Rail (tablet/desktop — mobile uses header menu drawer) */}
      <div className="karaoke-side-nav hidden md:flex flex-col w-16 sm:w-20 lg:w-64 border-r border-border bg-card z-20 shrink-0">
        <div className="p-4 flex items-center justify-center lg:justify-start gap-2 mb-4 mt-2">
           <button
             type="button"
             onClick={handleKStarLogoTap}
             className={`${navTapButtonClass} flex items-center justify-center lg:justify-start gap-2 min-h-[44px]`}
             aria-label={activeTab === 'sing' ? 'Refresh K-Star' : 'Go to Studio'}
           >
             <Mic className="w-8 h-8 text-primary shrink-0" />
             <span className="hidden lg:block font-black text-2xl tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-primary to-indigo-500">K-Star</span>
           </button>
        </div>
        
        <div className="flex-1 lg:px-3 space-y-2 px-2 overflow-y-auto overscroll-contain">
           <button type="button" onClick={() => handleKaraokeTabTap('sing')} className={karaokeNavButtonClass('sing', activeTab === 'sing' ? 'bg-primary text-primary-foreground font-bold shadow-md shadow-primary/20' : 'text-muted-foreground hover:bg-secondary hover:text-foreground font-semibold')}>
             <span className="relative">
               <MicVocal className="w-6 h-6 shrink-0" />
               {activeTab === 'sing' && <div className="lg:hidden absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />}
             </span>
             <span className="hidden lg:block text-[15px]">Studio</span>
           </button>
           <button type="button" onClick={() => handleKaraokeTabTap('party')} className={karaokeNavButtonClass('party', activeTab === 'party' ? 'bg-primary text-primary-foreground font-bold shadow-md shadow-primary/20' : 'text-muted-foreground hover:bg-secondary hover:text-foreground font-semibold')}>
             <span className="relative">
               <PartyRoomIcon className="w-6 h-6 shrink-0" />
               {activeTab === 'party' && <div className="lg:hidden absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />}
             </span>
             <span className="hidden lg:block text-[15px]">Party Rooms</span>
           </button>
           <button type="button" onClick={() => handleKaraokeTabTap('feed')} className={karaokeNavButtonClass('feed', activeTab === 'feed' ? 'bg-primary text-primary-foreground font-bold shadow-md shadow-primary/20' : 'text-muted-foreground hover:bg-secondary hover:text-foreground font-semibold')}>
             <span className="relative">
               <TrendingUp className="w-6 h-6 shrink-0" />
               {activeTab === 'feed' && <div className="lg:hidden absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />}
             </span>
             <span className="hidden lg:block text-[15px]">Explore</span>
           </button>
           <button type="button" onClick={() => handleKaraokeTabTap('messages')} className={karaokeNavButtonClass('messages', activeTab === 'messages' ? 'bg-primary text-primary-foreground font-bold shadow-md shadow-primary/20' : 'text-muted-foreground hover:bg-secondary hover:text-foreground font-semibold')}>
             <span className="relative">
               <MessageCircle className="w-6 h-6 shrink-0" />
               {db.unreadMessagesCount > 0 ? (
                 <div className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[9px] font-bold rounded-full border border-background flex items-center justify-center">
                   {db.unreadMessagesCount > 9 ? '9+' : db.unreadMessagesCount}
                 </div>
               ) : null}
               {activeTab === 'messages' && <div className="lg:hidden absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />}
             </span>
             <span className="hidden lg:block text-[15px]">Messages</span>
           </button>
           <button type="button" onClick={() => handleKaraokeTabTap('notifications')} className={karaokeNavButtonClass('notifications', activeTab === 'notifications' ? 'bg-primary text-primary-foreground font-bold shadow-md shadow-primary/20' : 'text-muted-foreground hover:bg-secondary hover:text-foreground font-semibold')}>
             <span className="relative">
               <Bell className="w-6 h-6 shrink-0" />
               {db.hasUnreadNotifications ? (
                 <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-background" />
               ) : null}
               {activeTab === 'notifications' && <div className="lg:hidden absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />}
             </span>
             <span className="hidden lg:block text-[15px]">Notifications</span>
           </button>
           <button type="button" onClick={() => handleKaraokeTabTap('live')} className={karaokeNavButtonClass('live', activeTab === 'live' ? 'bg-red-500 text-white font-bold shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'text-muted-foreground hover:bg-secondary hover:text-red-500 font-semibold')}>
             <div className="relative flex items-center justify-center">
               <Video className="w-6 h-6 shrink-0" />
               <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-background animate-pulse" />
             </div>
             <span className="hidden lg:block text-[15px]">Live Concerts</span>
           </button>
           <button type="button" onClick={() => handleKaraokeTabTap('challenge')} className={karaokeNavButtonClass('challenge', activeTab === 'challenge' ? 'bg-primary text-primary-foreground font-bold shadow-md shadow-primary/20' : 'text-muted-foreground hover:bg-secondary hover:text-foreground font-semibold')}>
             <span className="relative">
               <Trophy className="w-6 h-6 shrink-0" />
               {activeTab === 'challenge' && <div className="lg:hidden absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />}
             </span>
             <span className="hidden lg:block text-[15px]">Challenges</span>
           </button>
           <button type="button" onClick={() => handleKaraokeTabTap('leaderboard')} className={karaokeNavButtonClass('leaderboard', activeTab === 'leaderboard' ? 'bg-primary text-primary-foreground font-bold shadow-md shadow-primary/20' : 'text-muted-foreground hover:bg-secondary hover:text-foreground font-semibold')}>
             <span className="relative">
               <Crown className="w-6 h-6 shrink-0" />
               {activeTab === 'leaderboard' && <div className="lg:hidden absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />}
             </span>
             <span className="hidden lg:block text-[15px]">Leaderboard</span>
           </button>
           <button 
             type="button"
             onClick={() => setIsUploadModalOpen(true)} 
             className={`${karaokeNavButtonClass('sing')} text-primary font-bold hover:bg-primary/10`}
           >
             <span className="relative">
               <Upload className="w-6 h-6 shrink-0" />
             </span>
             <span className="hidden lg:block text-[15px]">Upload Song</span>
           </button>
           <button
             type="button"
             onClick={() => { setGiftingDuetId(null); setShowGiftModal(true); }}
             className={`${karaokeNavButtonClass('sing')} bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 font-bold text-sm ring-1 ring-amber-500/20`}
           >
             <Coins className="w-5 h-5 shrink-0" />
             <span className="hidden lg:inline">{userCoins.toLocaleString()}</span>
           </button>
           <button
             type="button"
             onClick={() => setShowVipModal(true)}
             className={`${karaokeNavButtonClass('sing')} ${userVip ? 'bg-amber-500/20 text-amber-500 ring-1 ring-amber-500/20' : 'text-muted-foreground hover:text-foreground hover:bg-secondary bg-secondary/50'}`}
             title="VIP Star Status Badge"
           >
             <Crown className={`w-5 h-5 shrink-0 ${userVip ? 'fill-current' : ''}`} />
             <span className="hidden lg:inline text-[15px] font-semibold">VIP Status</span>
           </button>
           <button 
             type="button"
             onClick={() => {
               db.updateSettings({
                 theme: db.settings.theme === 'dark' ? 'light' : 'dark'
               });
             }} 
             className={`${karaokeNavButtonClass('sing')} text-muted-foreground hover:bg-secondary hover:text-foreground font-semibold`}
           >
             <span className="relative">
               {db.settings.theme === 'dark' ? <Sun className="w-6 h-6 shrink-0" /> : <Moon className="w-6 h-6 shrink-0" />}
             </span>
             <span className="hidden lg:block text-[15px]">Toggle Theme</span>
           </button>
        </div>

        <div className="p-4 mb-4 shrink-0">
           <button type="button" onClick={() => handleKaraokeTabTap('profile')} className={`${navTapButtonClass} w-full flex items-center justify-center lg:justify-start gap-3 p-2 min-h-[44px] rounded-2xl transition border border-transparent ${activeTab === 'profile' ? 'bg-secondary border-border shadow-sm' : 'hover:bg-secondary/50'}`}>
             <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-orange-400 to-pink-500 p-0.5 shrink-0 shadow-sm">
               <img src={CURRENT_USER.avatar} alt="Profile" className="w-full h-full rounded-full object-cover" />
             </div>
             <div className="hidden lg:block text-left min-w-0">
                <div className="font-bold text-sm truncate">{CURRENT_USER.name}</div>
                <div className="text-xs text-muted-foreground truncate">{CURRENT_USER.handle}</div>
             </div>
           </button>
         </div>

      </div>

      {/* Main Content Layout */}
      <div className={`flex-1 flex flex-col h-full min-h-0 bg-background md:bg-card/30 shadow-sm relative w-full overflow-hidden transition-colors duration-300 ${
        showSmuleRoomFlow && activeTab === 'profile' ? 'z-[80]' : 'z-10'
      }`}>
        {/* Top Header — hidden while smule room flow is open, except when profile is on top */}
        {(!showSmuleRoomFlow || activeTab === 'profile') && (
        <div className="px-4 py-3 bg-card border-b border-border flex items-center justify-between sticky top-0 z-20 shadow-sm min-h-[64px] shrink-0">
           <div className="flex items-center gap-3">
             {/* Back Button */}
             <button
               type="button"
               onClick={exitKaraokeToMainApp}
               className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-rose-600 dark:bg-rose-500 text-white hover:bg-rose-700 dark:hover:bg-rose-600 font-extrabold text-xs md:text-sm transition-all shadow-md hover:shadow-rose-600/35 hover:-translate-y-0.5 active:translate-y-0 shrink-0 select-none mr-1 cursor-pointer"
               title="Back to Feed"
               aria-label="Back to Feed"
             >
               <ArrowLeft className="w-4 h-4 stroke-[3px]" />
               <span className="tracking-widest uppercase font-black text-white">Back</span>
             </button>

             {/* Logo for mobile only */}
             <button
               type="button"
               onClick={handleKStarLogoTap}
               className={`${navTapButtonClass} md:hidden flex items-center gap-1.5 min-h-[44px]`}
               aria-label={activeTab === 'sing' ? 'Refresh K-Star' : 'Go to Studio'}
             >
               <Mic className="w-5 h-5 text-primary" />
               <span className="font-extrabold text-lg tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-primary to-indigo-500">K-Star</span>
             </button>

             {/* Dynamic Page Title */}
             <div className="flex items-center gap-2 min-w-0">
               {activeTab === 'sing' && <h1 className="font-extrabold text-xl truncate">Studio</h1>}
               {activeTab === 'feed' && <h1 className="font-extrabold text-xl truncate">Explore</h1>}
               {activeTab === 'messages' && <h1 className="font-extrabold text-xl truncate">Messages</h1>}
               {activeTab === 'notifications' && <h1 className="font-extrabold text-xl truncate">Notifications</h1>}
               {activeTab === 'party' && <h1 className="font-extrabold text-xl truncate">Party Rooms</h1>}
               {activeTab === 'live' && <h1 className="font-extrabold text-xl truncate">Live Concerts</h1>}
               {activeTab === 'profile' && (
                 <h1 className="font-extrabold text-xl truncate">
                   {selectedUserProfile?.name ?? 'My Profile'}
                 </h1>
               )}
               {activeTab === 'challenge' && <h1 className="font-extrabold text-xl truncate">Contests</h1>}
               {activeTab === 'leaderboard' && <h1 className="font-extrabold text-xl truncate">Leaderboard</h1>}
               {activeTab === 'search' && <h1 className="font-extrabold text-xl truncate">Search</h1>}
               {activeTab === 'genres' && <h1 className="font-extrabold text-xl truncate">Genres</h1>}
               {activeTab === 'top100' && <h1 className="font-extrabold text-xl truncate">Top 100 Global</h1>}
             </div>
           </div>

           <div className="flex items-center gap-3">
             <button type="button" onClick={() => handleKaraokeTabTap('search')} className={`${navTapIconButtonClass} text-muted-foreground hover:text-foreground hover:bg-secondary rounded-full bg-secondary/50 transition`} aria-label="Search">
               <Search className="w-5 h-5" />
             </button>
              <button
                type="button"
                onClick={() => setShowMobileMenu(true)}
                className={`${navTapIconButtonClass} md:hidden text-muted-foreground hover:text-foreground hover:bg-secondary rounded-full bg-secondary/50 transition`}
                aria-label="Open K-Star menu"
              >
                <Menu className="w-5 h-5 stroke-[1.5px]" />
              </button>
           </div>
        </div>
        )}

        {/* Content Area */}
        <div ref={contentScrollRef} className={`flex-1 min-h-0 scroll-smooth relative ${showSmuleRoomFlow || activeTab === 'messages' || activeTab === 'notifications' ? 'overflow-hidden flex flex-col' : 'overflow-y-auto md:pb-0'}`}>
          {activeTab === 'messages' && (
            <div className="flex-1 min-h-0 flex flex-col">
              <MessagesScreen
                embedded
                initialChatId={karaokeMessagesChatId}
                onClearInitialChatId={() => setKaraokeMessagesChatId(null)}
              />
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="flex-1 min-h-0 flex flex-col">
              <NotificationsScreen embedded />
            </div>
          )}

          {activeTab === 'leaderboard' && (
            <LeaderboardView onSelectProfile={navigateToKaraokeOtherProfile} />
          )}

          {activeTab === 'challenge' && (
             <ChallengeView onSing={() => setActiveTab('sing')} onSelectProfile={navigateToKaraokeOtherProfile} />
          )}

          {activeTab === 'sing' && (
            <div className="p-4 sm:p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Promo Banner / Challenges */}
              <div className="w-full bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden cursor-pointer hover:shadow-indigo-500/20 transition-all group">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20 mix-blend-overlay"></div>
                <div className="relative z-10 flex justify-between items-center">
                  <div>
                    <div className="inline-flex items-center gap-1.5 bg-black/20 backdrop-blur px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3 border border-white/10">
                      <Trophy className="w-3.5 h-3.5" /> Global Challenge
                    </div>
                    <h2 className="text-3xl sm:text-4xl font-extrabold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">Karaoke Idol 2026</h2>
                    <p className="opacity-90 max-w-[250px] sm:max-w-md text-sm sm:text-base leading-relaxed">Sing your heart out, gather votes, and win a professional studio recording session + 50,000 Coins!</p>
                    <button 
                      onClick={() => setActiveTab('challenge')}
                      className="mt-5 px-6 py-2.5 bg-white text-indigo-600 font-bold rounded-full text-sm hover:scale-105 transition-transform shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                    >
                      Join Competition
                    </button>
                  </div>
                  <Mic className="absolute right-[-20px] bottom-[-20px] w-48 h-48 sm:w-64 sm:h-64 opacity-20 rotate-12 group-hover:scale-110 group-hover:rotate-6 transition-all duration-700" />
                </div>
              </div>

              {/* VIP / Monetization upsell */}
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-2xl">
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-full bg-gradient-to-bl from-amber-400 to-orange-500 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/20">
                     <Crown className="w-5 h-5 text-white" />
                   </div>
                   <div>
                     <h4 className="font-bold text-sm text-amber-500 dark:text-amber-400">Unlock VIP Premium</h4>
                     <p className="text-xs text-muted-foreground">High-res audio, exclusive filters & no ads.</p>
                   </div>
                 </div>
                 <button onClick={() => setShowVipModal(true)} className="text-xs font-bold bg-amber-500 text-white px-4 py-2 rounded-full hover:bg-amber-600 transition shadow-md shadow-amber-500/20">Upgrade</button>
              </div>

              {uploadedSongs.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      <Upload className="w-5 h-5 text-primary" /> My Uploads
                    </h3>
                    <button
                      type="button"
                      onClick={() => goToProfileTab('uploads')}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      View all
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Backing tracks only — your sung covers appear on Profile → Covers.
                  </p>
                  <KaraokeMyUploadsPanel
                    songs={uploadedSongs.slice(0, 4)}
                    metas={uploadedSongMetas}
                    onListen={openUploadedSongListen}
                    onSing={openUploadedSongSing}
                  />
                </div>
              )}

              {/* Categories */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg flex items-center gap-2"><Music className="w-5 h-5 text-primary" /> Browse Genres</h3>
                  <button onClick={() => pushKaraokeStackTab('genres')} className="text-sm font-medium text-primary hover:underline">View All</button>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
                  {CATEGORIES.map((cat, i) => (
                    <button key={cat} className="px-6 py-3 bg-secondary/80 hover:bg-secondary rounded-2xl font-semibold whitespace-nowrap shrink-0 transition-all border border-border/50 hover:border-primary/30 shadow-sm relative overflow-hidden group">
                      <div className="relative z-10">{cat}</div>
                      <div className={`absolute -right-4 -bottom-4 w-12 h-12 rounded-full bg-gradient-to-br from-primary/10 to-transparent blur-md opacity-0 group-hover:opacity-100 transition-opacity`} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Trending Library */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg flex items-center gap-2"><TrendingUp className="w-5 h-5 text-orange-500" /> Trending Tracks</h3>
                  <button onClick={() => pushKaraokeStackTab('top100')} className="text-sm font-medium text-primary hover:underline">Top 100</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {trendingSongs.map((song, i) => (
                    <div key={song.id} className="flex items-start gap-3 p-3 bg-card border border-border/50 hover:border-primary/50 hover:shadow-md rounded-2xl transition-all group">
                      <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 group-hover:scale-105 transition-transform">
                        <img src={`https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&auto=format&fit=crop&q=60&${i}`} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                        {i === 0 && <div className="absolute top-0 left-0 bg-orange-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-br-lg">#1</div>}
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col gap-2">
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm truncate group-hover:text-primary transition-colors">{song.title}</h4>
                          <p className="text-xs text-muted-foreground truncate mb-1">{song.artist}</p>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium">
                             <span className="flex items-center gap-0.5"><Play className="w-3 h-3" /> {song.plays}</span>
                             <span className="w-1 h-1 rounded-full bg-border" />
                             <span className="text-primary/80 uppercase font-black">{song.type || 'solo'}</span>
                             <span className="w-1 h-1 rounded-full bg-border" />
                             <span className="text-blue-500 font-bold">HQ</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                           {song.type && song.type !== 'solo' && (
                             <button 
                               onClick={() => setSelectedSong({ ...song, mode: 'join' })}
                               className="w-9 h-9 rounded-full bg-orange-500 text-white hover:bg-orange-600 flex items-center justify-center transition-all shadow-md shadow-orange-500/20"
                               title={`Join ${song.type}`}
                             >
                               <Users className="w-4 h-4" />
                             </button>
                           )}
                          <button 
                             onClick={() => {
                               setPlayingTrack({
                                 id: song.id,
                                 title: song.title,
                                 artist: song.artist,
                                 plays: song.plays || '2.0M',
                                 likes: '150K',
                                 img: `https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&auto=format&fit=crop&q=60&seed=${song.id}`
                               });
                               setTrackTime(0);
                               setTrackMaxSeconds(110);
                               setIsPlayingTrack(true);
                               window.dispatchEvent(new CustomEvent('app-toast', { detail: `Playing "${song.title}" in Native Player 🎧` }));
                             }}
                             className="w-9 h-9 rounded-full bg-secondary hover:bg-primary hover:text-primary-foreground text-foreground flex items-center justify-center transition-all shadow-sm"
                             title="Listen Now"
                           >
                             <Play className="w-4 h-4 fill-current ml-0.5" />
                           </button>
                           <button 
                             onClick={() => setSelectedSong(song)}
                             className="w-9 h-9 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground flex items-center justify-center transition-all shadow-sm"
                             title="Sing & Record"
                           >
                             <Mic className="w-4 h-4" />
                           </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'feed' && (
            <div className="space-y-4 bg-secondary/10 p-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {duets.map(post => (
                 <div key={post.id} className="bg-card rounded-3xl overflow-hidden border border-border shadow-sm hover:shadow-md transition-shadow">
                      {/* Post Header */}
                   <div className="p-4 flex items-center justify-between col-span-12">
                     <div className="flex items-center gap-3">
                        <div className="flex -space-x-3">
                          <button 
                            onClick={() => navigateToKaraokeOtherProfile({
                                name: post.users[0].replace('@', ''),
                                handle: post.users[0],
                                avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.users[0]}`,
                                followers: '12.4k',
                                likes: '2.1M',
                                gifts: '4.5M',
                                description: 'Singer and performer! Let\'s sing together! 🎤'
                              })}
                            className="w-10 h-10 rounded-full border-2 border-card bg-zinc-800 z-10 overflow-hidden shadow-sm cursor-pointer hover:scale-110 transition-transform"
                          >
                            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${post.users[0]}`} className="w-full h-full bg-amber-100" />
                          </button>
                          <button 
                            onClick={() => navigateToKaraokeOtherProfile({
                                name: post.users[1].replace('@', ''),
                                handle: post.users[1],
                                avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.users[1]}`,
                                followers: '8.4k',
                                likes: '1.2M',
                                gifts: '2.1M',
                                description: 'Music lover and Karaoke master! 🎧'
                              })}
                            className="w-10 h-10 rounded-full border-2 border-card bg-zinc-700 z-0 overflow-hidden shadow-sm cursor-pointer hover:scale-110 transition-transform"
                          >
                            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${post.users[1]}`} className="w-full h-full bg-blue-100" />
                          </button>
                        </div>
                        <div>
                          <span className="text-sm font-bold block flex items-center gap-1">
                            <span 
                              onClick={() => navigateToKaraokeOtherProfile({
                                  name: post.users[0].replace('@', ''),
                                  handle: post.users[0],
                                  avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.users[0]}`,
                                  followers: '12.4k',
                                  likes: '2.1M',
                                  gifts: '4.5M',
                                  description: 'Singer and performer! Let\'s sing together! 🎤'
                                })}
                              className="cursor-pointer hover:underline hover:text-primary transition-colors"
                            >
                              {post.users[0]}
                            </span>
                            <span className="text-muted-foreground text-xs font-normal">&</span>
                            <span 
                              onClick={() => navigateToKaraokeOtherProfile({
                                  name: post.users[1].replace('@', ''),
                                  handle: post.users[1],
                                  avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.users[1]}`,
                                  followers: '8.4k',
                                  likes: '1.2M',
                                  gifts: '2.1M',
                                  description: 'Music lover and Karaoke master! 🎧'
                                })}
                              className="cursor-pointer hover:underline hover:text-primary transition-colors"
                            >
                              {post.users[1]}
                            </span>
                          </span>
                          <span className="text-xs text-muted-foreground">Collab • 2h ago</span>
                        </div>
                     </div>
                     <button 
                       onClick={() => toggleFollowUser(post.users[0])}
                       className={`text-sm font-bold px-4 py-1.5 rounded-full transition-all ${
                         isFollowingUser(post.users[0]) 
                         ? 'bg-secondary text-muted-foreground border border-border' 
                         : 'bg-primary text-primary-foreground hover:bg-primary/95 hover:scale-105'
                       }`}
                     >
                       {isFollowingUser(post.users[0]) ? 'Following' : 'Follow'}
                     </button>
                   </div>
                   
                   {/* Video/Image Area */}
                   <div className="relative aspect-[4/5] sm:aspect-video bg-black group">
                     <video 
                       src={post.videoUrl} 
                       poster={post.img} 
                       controls 
                       controlsList="nodownload" 
                       className="w-full h-full object-contain bg-black" 
                       preload="metadata"
                       playsInline
                     />
                                          {/* Song Info Overlay has clickable info button to open Track details (lyrics and recordings) */}
                     <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/95 via-black/40 to-transparent flex items-center justify-between pointer-events-auto">
                       <div className="flex flex-col">
                         <div className="font-extrabold text-white text-sm sm:text-base drop-shadow-md flex items-center gap-2">
                            <Music className="w-4 h-4 text-primary shrink-0" /> {post.song}
                         </div>
                         <div className="flex items-center gap-2 mt-1">
                            <button 
                              onClick={() => {
                                const matchedSong = [...trendingSongs, ...librarySongs].find(s => 
                                  s.title.toLowerCase().includes(post.song.toLowerCase()) || 
                                  post.song.toLowerCase().includes(s.title.toLowerCase())
                                ) || { id: 'temp', title: post.song, artist: post.users.join(' & '), mode: 'join', type: 'duet' };
                                setSelectedSong({ ...matchedSong, mode: 'join' });
                              }}
                              className="px-3 py-1 bg-primary text-primary-foreground text-[10px] font-black rounded-full uppercase tracking-widest hover:scale-105 transition-transform"
                            >
                              Join Duet
                            </button>
                         </div>
                       </div>
                       <button
                          onClick={() => {
                            const allCatalogSongs = [...trendingSongs, ...librarySongs, ...uploadedSongs];
                            const matchedSong = post.songId
                              ? allCatalogSongs.find((song) => song.id === post.songId)
                              : allCatalogSongs.find((song) =>
                                  song.title.toLowerCase().includes(post.song.split(' — ')[0].toLowerCase()) ||
                                  post.song.toLowerCase().includes(song.title.toLowerCase()),
                                );
                            const track = matchedSong || {
                              id: post.songId || 'epic_underworld',
                              title: post.song.split(' — ')[0],
                              artist: post.users.join(' & '),
                              img: post.img,
                            };
                            setPlayingTrack(track);
                            const recordings = listKaraokeCoverRecordings(track.id);
                            setCoverRecordings(recordings);
                            setDetailsTab(recordings.length > 0 || post.recordingId ? 'recordings' : 'lyrics');
                            captureTrackDetailsOriginRef.current({
                              tab: 'feed',
                              profileTab: null,
                              selectedUserProfile: null,
                              force: true,
                            });
                            setShowTrackDetails(true);
                            if (post.recordingId) {
                              const recording = recordings.find((row) => row.id === post.recordingId);
                              if (recording) void playCoverRecording(recording);
                            }
                            window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Lyrics & recordings details loaded! 🎧' }));
                          }}
                          className="p-2.5 bg-white/15 hover:bg-white/30 backdrop-blur-md rounded-full text-white border border-white/15 active:scale-90 transition shadow-md pointer-events-auto shrink-0"
                          title="Song Lyrics & Recordings"
                        >
                          <Info className="w-4 h-4 text-white" />
                        </button>
                      </div>
                   </div>

                   {/* Actions / Engagement */}
                   <div className="p-4 flex items-center justify-between border-t border-border/40">
                     <div className="flex gap-4 sm:gap-6">
                       <button 
                         onClick={() => handleLikeDuet(post.id)}
                         className={`flex items-center gap-2 transition-colors group ${post.isLiked ? 'text-rose-500' : 'text-muted-foreground hover:text-rose-500'}`}
                       >
                         <Heart className={`w-6 h-6 transition ${post.isLiked ? 'fill-rose-500 text-rose-500 scale-110' : 'group-hover:fill-rose-500/10'}`} /> 
                         <span className="font-extrabold text-xs sm:text-sm">
                           {post.likesCount >= 1000 ? `${(post.likesCount / 1000).toFixed(1)}K` : post.likesCount}
                         </span>
                       </button>
                       <button 
                         onClick={() => setActiveCommentPostId(post.id)}
                         className="flex items-center gap-2 text-muted-foreground hover:text-blue-500 transition-colors"
                       >
                         <MessageCircle className="w-6 h-6" /> 
                         <span className="font-bold text-xs sm:text-sm">{post.commentCount}</span>
                       </button>
                       <button 
                         onClick={() => handleSharePost(post)}
                         className="group flex items-center gap-2 text-muted-foreground hover:text-green-500 transition-colors"
                         title="Share Track"
                       >
                         <ShareIcon size="md" />
                       </button>
                     </div>
                     
                     {/* Gifting Button with real balance deductions */}
                     <div className="flex items-center gap-2 shrink-0">
                       {duetGifts[post.id] > 0 && (
                         <span className="text-[10px] bg-amber-500/15 text-amber-500 px-2 py-1 rounded-md font-extrabold border border-amber-500/20 shadow-sm animate-pulse">
                           🎁 {duetGifts[post.id]}
                         </span>
                       )}
                       <button 
                          onClick={() => {
                            setGiftingDuetId(post.id);
                            setShowGiftModal(true);
                          }} 
                          className={`flex items-center gap-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white px-4 py-2 rounded-xl font-black text-xs sm:text-sm shadow-md shadow-rose-500/20 hover:scale-105 active:scale-95 transition`}
                        >
                          <Gift className="w-4 h-4 shrink-0" /> Send Gift
                        </button>
                      </div>
                    </div>
                  </div>
               ))}
            </div>
          )}

          {activeTab === 'live' && (
             <div className="p-4 sm:p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
               {/* Go Live CTA */}
               <div className="bg-gradient-to-br from-red-600 to-rose-700 rounded-3xl p-8 text-white shadow-xl shadow-red-900/20 mb-10 flex flex-col sm:flex-row items-center sm:justify-between text-center sm:text-left gap-6 relative overflow-hidden ring-1 ring-white/10">
                 <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 mix-blend-overlay"></div>
                 <div className="relative z-10">
                   <h3 className="font-extrabold text-2xl mb-2 flex items-center justify-center sm:justify-start gap-2">
                     <Video className="w-6 h-6" /> Host a Live Concert
                   </h3>
                   <p className="text-white/80 max-w-sm text-sm">Sing live, accept song requests, interact with fans, and earn Coins from virtual gifts!</p>
                 </div>
                 <button className="relative z-10 px-8 py-4 bg-white text-red-700 font-bold rounded-full transition-all hover:scale-105 shadow-2xl whitespace-nowrap text-lg">
                   Start Concert
                 </button>
               </div>

               <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> Popular Live Streams</h3>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {LIVE_STREAMS.map(stream => (
                    <div key={stream.id} onClick={() => setActiveLiveStream(stream)} className="relative aspect-video rounded-2xl overflow-hidden group cursor-pointer border border-border">
                       <img src={stream.img} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                       <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
                       
                       <div className="absolute top-3 left-3 flex items-center gap-2">
                         <div className="bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider animate-pulse flex items-center gap-1">
                           LIVE
                         </div>
                         <div className="bg-black/50 backdrop-blur text-white text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1 border border-white/10">
                           <Users className="w-3 h-3" /> {stream.viewers}
                         </div>
                       </div>
                       
                       <div className="absolute top-3 right-3">
                         <div className="w-auto px-2 py-1 bg-gradient-to-r from-amber-500 to-orange-500 rounded-md flex items-center gap-1 text-white text-[10px] font-bold shadow-lg">
                            <Star className="w-3 h-3 fill-current" /> Top Host
                         </div>
                       </div>

                       <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full border-2 border-white overflow-hidden shadow-md">
                              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${stream.user}`} className="bg-indigo-100" />
                            </div>
                            <div>
                               <div className="font-bold text-white text-sm drop-shadow-md">{stream.user}</div>
                               <div className="flex gap-1 mt-0.5">
                                 {stream.tags.map(t => <span key={t} className="text-[9px] bg-white/20 text-white px-1.5 py-0.5 rounded backdrop-blur">{t}</span>)}
                               </div>
                            </div>
                          </div>
                       </div>
                    </div>
                  ))}
               </div>
             </div>
          )}

          {activeTab === 'search' && (
             <div className="p-4 sm:p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-2 mb-6 sm:hidden">
                  <button onClick={popKaraokeStackBack} className="p-2 hover:bg-secondary rounded-full -ml-2">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <h2 className="font-bold text-lg">Search</h2>
                </div>
                <div className="relative mb-8">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search catalog, community uploads, and cover recordings..." 
                    className="w-full bg-secondary/80 focus:bg-secondary border-transparent focus:border-primary/50 focus:ring-2 focus:ring-primary/20 rounded-2xl py-4 pl-12 pr-4 transition-all outline-none" 
                    autoFocus 
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-1 bg-secondary/80 hover:bg-secondary rounded-full"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                
                {searchQuery.trim() === "" ? (
                  <>
                    <h3 className="font-bold text-lg mb-4 text-muted-foreground">Recent Searches</h3>
                    <div className="flex flex-wrap gap-2 mb-8">
                       {['Adele', 'Bruno Mars', 'Billie Eilish', 'Pop', 'K-Pop'].map(s => (
                          <button key={s} onClick={() => setSearchQuery(s)} className="px-4 py-2 bg-secondary/50 hover:bg-secondary rounded-full text-sm font-medium transition">{s}</button>
                       ))}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                       <div onClick={() => pushKaraokeStackTab('top100')} className="aspect-square bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-4 flex flex-col justify-end text-white relative overflow-hidden group cursor-pointer shadow-sm hover:shadow-md transition">
                          <div className="absolute top-4 right-4"><Music className="w-8 h-8 opacity-20 group-hover:scale-110 transition-transform" /></div>
                          <h4 className="font-bold text-lg">Top 100 Global</h4>
                       </div>
                       <div onClick={() => pushKaraokeStackTab('genres')} className="aspect-square bg-gradient-to-br from-pink-500 to-rose-600 rounded-2xl p-4 flex flex-col justify-end text-white relative overflow-hidden group cursor-pointer shadow-sm hover:shadow-md transition">
                          <div className="absolute top-4 right-4"><Mic className="w-8 h-8 opacity-20 group-hover:scale-110 transition-transform" /></div>
                          <h4 className="font-bold text-lg">Browse Genres</h4>
                       </div>
                    </div>
                  </>
                ) : (() => {
                  const results = searchKaraokeAll(searchQuery, {
                    trending: TRENDING_SONGS,
                    library: LIBRARY_SONGS,
                    uploadMetas: listKaraokeUploads(),
                    coverMetas: listKaraokeCoverRecordings(),
                    currentUserId: appUser.id,
                  });
                  const total = results.catalog.length + results.uploads.length + results.covers.length;

                  const renderSearchHitRow = (hit: KaraokeSearchHit, index: number) => {
                    const badgeClass = hit.isMine
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                      : hit.kind === 'upload'
                        ? 'bg-primary/10 text-primary'
                        : hit.kind === 'cover'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-secondary text-muted-foreground';
                    const badgeLabel = karaokeSearchHitBadgeLabel(hit);
                    const imageSrc =
                      hit.img ||
                      `https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&auto=format&fit=crop&q=60&seed=${hit.id}`;

                    return (
                      <div
                        key={`${hit.kind}_${hit.id}_${index}`}
                        className="flex items-start gap-3 p-3 bg-card border border-border/50 hover:border-primary/50 hover:shadow-sm rounded-2xl transition-all group"
                      >
                        <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0">
                          <img src={imageSrc} className="w-full h-full object-cover" alt={hit.title} />
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <h4 className="font-bold text-sm truncate group-hover:text-primary transition-colors">{hit.title}</h4>
                              <span className={`shrink-0 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase ${badgeClass}`}>
                                {badgeLabel}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{hit.artist}</p>
                            {hit.subtitle ? (
                              <p className="text-[10px] text-muted-foreground/80 truncate mt-0.5">{hit.subtitle}</p>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => { void openSearchHitListen(hit); }}
                              className="w-9 h-9 rounded-full bg-secondary text-foreground hover:bg-primary hover:text-primary-foreground flex items-center justify-center transition-all shadow-sm"
                              title={hit.kind === 'cover' ? 'Play cover' : 'Listen'}
                            >
                              <Play className="w-4 h-4 fill-current ml-0.5" />
                            </button>
                            {hit.kind !== 'cover' ? (
                              <button
                                type="button"
                                onClick={() => { void openSearchHitSing(hit); }}
                                className="w-9 h-9 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground flex items-center justify-center transition-all shadow-sm"
                                title="Sing"
                              >
                                <Mic className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => { void openSearchHitSing(hit); }}
                                className="w-9 h-9 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground flex items-center justify-center transition-all shadow-sm"
                                title="Sing this song again"
                              >
                                <Mic className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  };

                  return (
                    <div className="space-y-6">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-bold text-base text-muted-foreground">Search Results ({total})</h3>
                      </div>
                      {total === 0 ? (
                        <div className="text-center py-12 text-muted-foreground font-semibold">
                          No matches in catalog, uploads, or cover recordings. Try a song title, artist, handle, or caption.
                        </div>
                      ) : (
                        <>
                          {results.catalog.length > 0 && (
                            <div className="space-y-2.5">
                              <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground px-1">Catalog Songs</h4>
                              {results.catalog.map(renderSearchHitRow)}
                            </div>
                          )}
                          {results.uploads.length > 0 && (
                            <div className="space-y-2.5">
                              <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground px-1">Uploads</h4>
                              {results.uploads.map(renderSearchHitRow)}
                            </div>
                          )}
                          {results.covers.length > 0 && (
                            <div className="space-y-2.5">
                              <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground px-1">Cover Recordings</h4>
                              {results.covers.map(renderSearchHitRow)}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })()}
             </div>
          )}

                    {activeTab === 'genres' && (
             <div className="p-4 sm:p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-2 mb-6">
                  <button onClick={popKaraokeStackBack} className="p-2 hover:bg-secondary rounded-full -ml-2">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <h2 className="font-bold text-lg text-primary">All Genres</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {CATEGORIES.map((cat, i) => (
                    <button key={cat} className="px-6 py-6 bg-secondary/80 hover:bg-secondary rounded-2xl font-bold text-center transition-all border border-border/50 hover:border-primary/30 shadow-sm relative overflow-hidden group">
                      <div className="relative z-10">{cat}</div>
                      <div className={`absolute -right-4 -bottom-4 w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-transparent blur-xl opacity-0 group-hover:opacity-100 transition-opacity`} />
                    </button>
                  ))}
                </div>
             </div>
          )}

          {activeTab === 'top100' && (
             <div className="p-4 sm:p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-2 mb-6">
                  <button onClick={popKaraokeStackBack} className="p-2 hover:bg-secondary rounded-full -ml-2">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div>
                    <h2 className="font-black text-xl text-primary mb-0.5">Top 100 Global</h2>
                    <p className="text-sm text-muted-foreground">The most requested tracks worldwide</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {[...TRENDING_SONGS, ...LIBRARY_SONGS].sort((a,b) => parseInt(b.plays || "0") - parseInt(a.plays || "0")).map((song, i) => (
                    <div key={song.id + "_" + i} className="flex items-center p-3 bg-card border border-border/50 hover:border-primary/50 hover:shadow-md rounded-2xl transition-all group">
                      <div className="w-8 font-black text-center text-muted-foreground group-hover:text-foreground">{i + 1}</div>
                      <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 group-hover:scale-105 transition-transform ml-2">
                        <img src={`https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&auto=format&fit=crop&q=60&${i}`} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                      </div>
                      <div className="ml-4 flex-1 min-w-0">
                        <h4 className="font-bold text-base truncate group-hover:text-primary transition-colors">{song.title}</h4>
                        <p className="text-sm text-muted-foreground truncate">{song.artist}</p>
                      </div>
                      <div className="px-4 text-right hidden sm:block w-24">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Plays</span>
                        <span className="font-semibold">{song.plays || (2.5 - i * 0.1).toFixed(1) + 'M'}</span>
                      </div>
                      <button 
                         onClick={() => {
                           setPlayingTrack({
                             id: song.id,
                             title: song.title,
                             artist: song.artist,
                             plays: song.plays || '1.5M',
                             likes: '12K',
                             img: `https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&auto=format&fit=crop&q=60&seed=${song.id}`
                           });
                           setTrackTime(0);
                           setTrackMaxSeconds(135);
                           setIsPlayingTrack(true);
                           window.dispatchEvent(new CustomEvent('app-toast', { detail: `Playing "${song.title}" in Native Player 🎧` }));
                         }}
                         className="w-10 h-10 rounded-full bg-secondary text-foreground hover:bg-primary hover:text-primary-foreground flex items-center justify-center shrink-0 transition-colors ml-2"
                         title="Listen Now"
                       >
                          <Play className="w-5 h-5 flex-shrink-0 fill-current ml-0.5" />
                       </button>
                       <button 
                         onClick={() => { setSelectedSong(song); setPreviousTab(activeTab); }}
                         className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 hover:bg-primary hover:text-white transition-colors ml-2"
                         title="Sing & Record"
                       >
                          <Mic className="w-5 h-5 flex-shrink-0" />
                       </button>
                    </div>
                  ))}
                </div>
             </div>
          )}

          {activeTab === 'party' && (
             <div className="p-4 sm:p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4 mb-6">
                  <div className="relative overflow-hidden rounded-3xl border p-5 shadow-xl shadow-purple-900/15 bg-gradient-to-br from-violet-600 via-purple-700 to-indigo-800 border-violet-300/40 text-white dark:from-purple-900 dark:via-purple-950 dark:to-indigo-950 dark:border-purple-500/30 dark:shadow-2xl">
                    <div className="pointer-events-none absolute top-0 right-0 p-4 text-white/25 dark:text-white/40">
                      <MicVocal size={64} strokeWidth={1.75} />
                    </div>
                    <h3 className="relative z-10 mb-1 flex items-center space-x-2 text-xl font-bold text-white">
                      <span>Create a Room</span>
                    </h3>
                    <p className="relative z-10 mb-4 max-w-[220px] text-xs text-white/85 sm:max-w-xs dark:text-purple-200">
                      Host a private or public karaoke session with friends and fans.
                    </p>
                    <button
                      type="button"
                      onClick={() => openSmuleRoomFlow('/room/create', 'karaoke-party')}
                      className="relative z-10 flex items-center space-x-2 rounded-full bg-white px-5 py-2 text-xs font-bold text-purple-900 shadow-lg transition hover:bg-purple-50 dark:hover:bg-gray-100"
                    >
                      <Plus size={16} /> <span>Start Room</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {PARTY_LOBBY_ROOMS.map((room) => {
                    const hostLabel = formatRoomHostMeta(
                      resolveRoomHostDisplay(String(room.id), room.host),
                    );
                    return (
                     <div key={room.id} className="bg-card border border-border rounded-2xl p-4 hover:shadow-md hover:border-primary/40 transition group">
                        <div className="flex justify-between items-start mb-3">
                           <div>
                              <h3 className="font-bold text-lg group-hover:text-primary transition">{room.name}</h3>
                              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">Host: <span className="font-semibold text-foreground">{hostLabel}</span></p>
                           </div>
                           <div className="flex items-center gap-1 bg-black/5 dark:bg-white/10 px-2 py-1 rounded-md text-xs font-bold">
                              <Users className="w-3 h-3" /> {room.participants}/{room.max}
                           </div>
                        </div>
                        <div className="flex items-center justify-between mt-4">
                           <div className="flex gap-2">
                             <div className="flex -space-x-2">
                               {[1, 2, 3].map((j) => (
                                 <img key={j} src={`https://api.dicebear.com/7.x/avataaars/svg?seed=party${room.id}${j}`} className="w-6 h-6 rounded-full border-2 border-card bg-zinc-200 shadow-sm" alt="" />
                               ))}
                             </div>
                             <span className="text-xs text-muted-foreground flex items-center">+{room.participants - 3} more</span>
                           </div>
                           <button
                             type="button"
                             onClick={() => joinPartyRoom(room)}
                             className="bg-secondary text-foreground text-xs font-bold px-4 py-1.5 rounded-full group-hover:bg-primary group-hover:text-white transition"
                           >
                             Join
                           </button>
                        </div>
                     </div>
                    );
                  })}
                </div>

             </div>
          )}

          {activeTab === 'profile' && (() => {
             const profileUser = selectedUserProfile || CURRENT_USER;
             const followAction =
               selectedUserProfile && karaokeViewedProfileUserId
                 ? db.getFollowActionState(karaokeViewedProfileUserId)
                 : null;
             const profileLabel =
               selectedUserProfile?.handle?.replace(/^@/, '') ||
               selectedUserProfile?.name ||
               'user';
             const isKaraokeProfileBlocked = Boolean(
               selectedUserProfile &&
               karaokeViewedProfileUserId &&
               karaokeViewedProfileUserId !== appUser.id &&
               db.isUserBlocked(karaokeViewedProfileUserId),
             );

             const handleKaraokeBlockUser = () => {
               if (!karaokeViewedProfileUserId) return;
               if (
                 !window.confirm(
                   `Block @${profileLabel}? Their posts will be hidden and they will be unfollowed.`,
                 )
               ) {
                 return;
               }
               if (!db.blockUser(karaokeViewedProfileUserId)) return;
               window.dispatchEvent(
                 new CustomEvent('app-toast', { detail: `Blocked @${profileLabel}` }),
               );
               setShowKaraokeProfileActionsMenu(false);
             };

             const handleKaraokeUnblockUser = () => {
               if (!karaokeViewedProfileUserId) return;
               if (!db.unblockUser(karaokeViewedProfileUserId)) return;
               window.dispatchEvent(
                 new CustomEvent('app-toast', { detail: `Unblocked @${profileLabel}` }),
               );
               setShowKaraokeProfileActionsMenu(false);
             };

             const handleKaraokeReportUser = () => {
               window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Reported' }));
               setShowKaraokeProfileActionsMenu(false);
             };

             const renderKaraokeProfileActionsMenu = () => (
               <>
                 <button
                   type="button"
                   aria-label="Close menu"
                   className="fixed inset-0 z-[120] cursor-default"
                   data-app-overlay-root
                   onClick={() => setShowKaraokeProfileActionsMenu(false)}
                 />
                 <div
                   role="menu"
                   className="absolute right-0 top-full z-[121] mt-1 min-w-[11rem] rounded-xl border border-border bg-background p-1.5 shadow-xl"
                 >
                   {isKaraokeProfileBlocked ? (
                     <button
                       type="button"
                       role="menuitem"
                       className={getOptionsMenuItemClass(
                         'unblock-user',
                         'default',
                         karaokeProfileHoveredMenuItem,
                         'surface',
                       )}
                       {...optionsMenuItemPointerHandlers(
                         'unblock-user',
                         setKaraokeProfileHoveredMenuItem,
                       )}
                       onClick={handleKaraokeUnblockUser}
                     >
                       Unblock @{profileLabel}
                     </button>
                   ) : (
                     <button
                       type="button"
                       role="menuitem"
                       className={getOptionsMenuItemClass(
                         'block-user',
                         'danger',
                         karaokeProfileHoveredMenuItem,
                         'surface',
                       )}
                       {...optionsMenuItemPointerHandlers(
                         'block-user',
                         setKaraokeProfileHoveredMenuItem,
                       )}
                       onClick={handleKaraokeBlockUser}
                     >
                       Block @{profileLabel}
                     </button>
                   )}
                   <button
                     type="button"
                     role="menuitem"
                     className={getOptionsMenuItemClass(
                       'report-user',
                       'danger',
                       karaokeProfileHoveredMenuItem,
                       'surface',
                     )}
                     {...optionsMenuItemPointerHandlers(
                       'report-user',
                       setKaraokeProfileHoveredMenuItem,
                     )}
                     onClick={handleKaraokeReportUser}
                   >
                     Report...
                   </button>
                 </div>
               </>
             );

             const handleEditProfileClick = () => {
               setEditProfileName(appUser.username || appUser.displayName || '');
               setEditProfileBio(appUser.bio || '');
               setEditProfileAvatar(karaokeAvatarSrc(appUser.avatarUrl, appUser.id));
               const background = getKaraokeProfileBackground(appUser.id);
               setEditProfileBackgroundUrl(background?.url ?? null);
               setEditProfileBackgroundMediaId(background?.mediaId ?? null);
               setEditProfileBackgroundMimeType(background?.mimeType);
               setEditProfileBackgroundMediaKind(background?.mediaKind ?? 'image');
               setEditProfileBackgroundFocus(background?.focus ?? null);
               setShowEditProfileModal(true);
             };

             const handleFollowToggle = () => {
               if (!karaokeViewedProfileUserId || karaokeViewedProfileUserId === appUser.id) return;
               db.toggleFollow(karaokeViewedProfileUserId);
               const nowFollowing = db.isFollowingUser(karaokeViewedProfileUserId);
               window.dispatchEvent(
                 new CustomEvent('app-toast', {
                   detail: nowFollowing
                     ? `Following ${selectedUserProfile?.name ?? 'user'}!`
                     : `Unfollowed ${selectedUserProfile?.name ?? 'user'}`,
                 }),
               );
             };

             const openKaraokeFollowList = (mode: 'followers' | 'following') => {
               if (!karaokeViewedProfileUserId) return;
               setKaraokeFollowList({ userId: karaokeViewedProfileUserId, mode });
             };

             const showProfileBackButton = Boolean(
               !openedKaraokeProfileFromMainApp(profileReturnContext) &&
               (karaokeProfileStack.length > 0 ||
                 selectedUserProfile ||
                 profileReturnContext?.surface === 'karaoke-party-room'),
             );

             return (
             <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Profile Header */}
                <KaraokeProfileBackground
                  url={profileUser.backgroundUrl}
                  mediaId={profileUser.backgroundMediaId}
                  mimeType={profileUser.backgroundMimeType}
                  mediaKind={profileUser.backgroundMediaKind}
                  focus={profileUser.backgroundFocus}
                  className="relative h-56 sm:h-64 md:h-72 lg:h-80 overflow-hidden"
                  overlayClassName="absolute inset-0 bg-gradient-to-t from-background/90 via-background/25 to-black/20"
                >
                  {showProfileBackButton && (
                    <button 
                      onClick={closeOtherUserProfileView}
                      className="absolute top-4 left-4 p-2 bg-black/40 text-white rounded-full hover:bg-black/60 transition shadow-sm z-10 flex items-center gap-1 text-sm font-bold pl-3 pr-4"
                    >
                      <ArrowLeft className="w-5 h-5" /> Back to {karaokeProfileBackLabel(previousTab, profileReturnContext)}
                    </button>
                  )}
                  {!selectedUserProfile && (
                    <label
                      className="absolute top-4 right-4 z-10 p-2 rounded-full border border-white/20 bg-black/55 text-white shadow-lg backdrop-blur-sm hover:bg-black/70 transition cursor-pointer"
                      aria-label="Change background"
                      title="Change background"
                    >
                      <ImagePlus className="w-[18px] h-[18px]" />
                      <input
                        type="file"
                        className="sr-only"
                        accept={KARAOKE_PROFILE_BACKGROUND_ACCEPT}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = '';
                          if (file) void applyProfileBackgroundFile(file, true);
                        }}
                      />
                    </label>
                  )}
                </KaraokeProfileBackground>
                
                <div className="px-6 relative -mt-20 sm:-mt-24 md:-mt-28 lg:-mt-32 flex flex-col gap-4 pb-6 border-b border-border sm:grid sm:grid-cols-[8rem_minmax(0,1fr)_auto] sm:items-end sm:gap-x-4">
                   <div className="w-32 h-32 rounded-full border-4 border-background bg-muted overflow-hidden shadow-xl shrink-0 relative sm:col-start-1 sm:row-start-1">
                     {!selectedUserProfile ? (
                       <label
                         className="group relative block h-full w-full cursor-pointer"
                         aria-label="Change profile photo"
                         title="Change profile photo"
                       >
                         <img
                           src={karaokeAvatarSrc(profileUser.avatar, appUser.id)}
                           alt="Profile"
                           className="block h-full w-full object-cover relative z-10"
                           onError={handleAvatarError}
                         />
                         <span className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-full bg-black/45 text-[10px] font-bold uppercase tracking-wide text-white opacity-0 transition-opacity group-hover:opacity-100">
                           Photo
                         </span>
                         <input
                           type="file"
                           className="sr-only"
                           accept="image/*,image/svg+xml,.svg,.webp"
                           onChange={(event) => {
                             const file = event.target.files?.[0];
                             event.target.value = '';
                             if (file) void applySelfProfileAvatarFile(file);
                           }}
                         />
                       </label>
                     ) : (
                       <img
                         src={karaokeAvatarSrc(
                           profileUser.avatar,
                           karaokeViewedProfileUserId || profileUser.handle.replace(/^@/, ''),
                         )}
                         alt="Profile"
                         className="block h-full w-full object-cover relative z-10"
                         onError={handleAvatarError}
                       />
                     )}
                   </div>
                   <div className="flex-1 pb-2 sm:col-start-2 sm:row-start-1 min-w-0">
                     <h2 className="text-2xl font-extrabold flex items-center gap-2">{profileUser.name} {profileUser.vip || profileUser.name.toLowerCase().includes('master') ? <Crown className="w-5 h-5 text-amber-500" /> : null}</h2>
                     <p className="text-muted-foreground">{profileUser.handle}</p>
                     <p className="text-sm mt-2 max-w-md">{profileUser.description}</p>
                   </div>
                   <div className="flex gap-3 sm:col-start-3 sm:row-start-1 sm:justify-end sm:self-end sm:pb-2 shrink-0">
                     {selectedUserProfile ? (
                       <>
                       {!isKaraokeProfileBlocked ? (
                       <button
                         type="button"
                         onClick={handleFollowToggle}
                         onMouseEnter={() => setProfileFollowHover(true)}
                         onMouseLeave={() => setProfileFollowHover(false)}
                         aria-pressed={!!followAction?.isFollowing}
                         aria-label={
                           followAction
                             ? getFollowButtonHoverLabel(followAction, profileFollowHover)
                             : 'Follow'
                         }
                         title={
                           followAction
                             ? getFollowButtonHoverLabel(followAction, profileFollowHover)
                             : 'Follow'
                         }
                         className={`p-2 rounded-full border transition ${
                           followAction?.isFollowing
                             ? profileFollowHover
                               ? 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/40'
                               : 'bg-card hover:bg-secondary border-border'
                             : followAction?.isRequested
                               ? 'bg-card hover:bg-secondary border-border'
                               : 'bg-primary text-primary-foreground border-transparent hover:bg-primary/95'
                         }`}
                       >
                         {followAction?.isFollowing ? (
                           profileFollowHover ? (
                             <UserMinus className="w-[18px] h-[18px]" />
                           ) : (
                             <UserCheck className="w-[18px] h-[18px]" />
                           )
                         ) : followAction?.isRequested ? (
                           profileFollowHover ? (
                             <X className="w-[18px] h-[18px]" />
                           ) : (
                             <Clock className="w-[18px] h-[18px]" />
                           )
                         ) : (
                           <UserPlus className="w-[18px] h-[18px]" />
                         )}
                       </button>
                       ) : (
                       <button
                         type="button"
                         onClick={handleKaraokeUnblockUser}
                         className="p-2 border border-border rounded-full hover:bg-secondary transition bg-card"
                         aria-label={`Unblock ${profileLabel}`}
                         title={`Unblock @${profileLabel}`}
                       >
                         <UserCheck className="w-[18px] h-[18px]" />
                       </button>
                       )}
                       <button
                         type="button"
                         onClick={() => {
                           const handle = selectedUserProfile.handle?.replace(/^@/, '');
                           const targetUserId = resolveCanonicalAppUserId(
                             selectedUserProfile.userId ?? karaokeViewedProfileUserId,
                             selectedUserProfile.name,
                             handle,
                           );
                           if (!targetUserId || targetUserId === appUser.id) return;
                           openAppProfileSurface({
                             userId: targetUserId,
                             displayName: selectedUserProfile.name,
                             username: handle,
                           });
                         }}
                         className="p-2 border border-border rounded-full hover:bg-secondary transition bg-card"
                         aria-label="Open InstaCollab profile"
                         title="InstaCollab"
                       >
                         <UserRound className="w-[18px] h-[18px]" />
                       </button>
                       <div className="relative">
                         <button
                           type="button"
                           aria-label={`Block or report ${profileLabel}`}
                           title="Block or report"
                           aria-expanded={showKaraokeProfileActionsMenu}
                           onClick={() => setShowKaraokeProfileActionsMenu((open) => !open)}
                           className="p-2 border border-border rounded-full hover:bg-secondary transition bg-card"
                         >
                           <UserX className="w-[18px] h-[18px]" />
                         </button>
                         {showKaraokeProfileActionsMenu ? renderKaraokeProfileActionsMenu() : null}
                       </div>
                       </>
                     ) : (
                       <>
                       <button
                         type="button"
                         onClick={() => setShowAccountSwitcher(true)}
                         className="p-2 border border-border rounded-full hover:bg-secondary transition bg-card"
                         aria-label="Switch account"
                         title="Switch account"
                       >
                         <Users className="w-[18px] h-[18px]" />
                       </button>
                       <button
                         type="button"
                         onClick={handleEditProfileClick}
                         className="p-2 border border-border rounded-full hover:bg-secondary transition bg-card"
                         aria-label="Edit profile"
                         title="Edit profile"
                       >
                         <UserPen className="w-[18px] h-[18px]" />
                       </button>
                       <button
                         type="button"
                         onClick={() => openAppProfileSurface({ userId: null, isSelf: true })}
                         className="p-2 border border-border rounded-full hover:bg-secondary transition bg-card"
                         aria-label="Open InstaCollab profile"
                         title="InstaCollab"
                       >
                         <UserRound className="w-[18px] h-[18px]" />
                       </button>
                       </>
                     )}
                     <button 
                       type="button"
                       onClick={() => {
                         const shareUser = selectedUserProfile
                           ? {
                               id:
                                 selectedUserProfile.userId ??
                                 karaokeViewedProfileUserId ??
                                 '',
                               username: profileUser.handle.replace(/^@/, ''),
                               displayName: profileUser.name,
                               handle: profileUser.handle,
                             }
                           : appUser;
                         openKaraokeShareModal(
                           buildContextualProfileSharePayload({
                             user: shareUser,
                             isSelf: !selectedUserProfile,
                             profileTab: profileActiveTab,
                             surface: 'karaoke',
                           }),
                         );
                       }}
                       className="group p-2 border border-border rounded-full hover:bg-secondary transition bg-card"
                       title="Share profile"
                       aria-label="Share profile"
                     >
                       <ShareIcon size="sm" />
                     </button>
                   </div>
                </div>

                {isKaraokeProfileBlocked ? (
                  <div className="mx-6 mb-4 w-[calc(100%-3rem)] rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-center text-sm font-semibold text-red-600 dark:text-red-400">
                    You blocked @{profileLabel}
                  </div>
                ) : null}

                {/* Stats */}
                <div className="grid grid-cols-4 divide-x divide-border border-b border-border bg-card/50">
                   <div className="p-4 text-center">
                     <div className="text-xl font-bold">{karaokeViewedCoverCount}</div>
                     <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Covers</div>
                   </div>
                   <div className="p-4 text-center">
                     <div className="text-xl font-bold">{karaokeViewedUploadCount}</div>
                     <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Uploads</div>
                   </div>
                   <button
                     type="button"
                     onClick={() => openKaraokeFollowList('followers')}
                     className="p-4 text-center hover:bg-secondary/40 transition active:scale-[0.98]"
                   >
                     <div className="text-xl font-bold">
                       {karaokeProfileStats.followerCount.toLocaleString()}
                     </div>
                     <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Followers</div>
                   </button>
                   <button
                     type="button"
                     onClick={() => openKaraokeFollowList('following')}
                     className="p-4 text-center hover:bg-secondary/40 transition active:scale-[0.98]"
                   >
                     <div className="text-xl font-bold">
                       {karaokeProfileStats.followingCount.toLocaleString()}
                     </div>
                     <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Following</div>
                   </button>
                </div>

                {/* Content Tabs */}
                {isKaraokeProfileBlocked ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    Unblock @{profileLabel} to view their covers and uploads.
                  </div>
                ) : (
                <div className="p-4 sm:p-6">
                   <div className="flex gap-4 border-b border-border mb-6 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
                     <button 
                       onClick={() => goToProfileTab('covers')}
                       className={`pb-3 border-b-2 font-bold text-sm sm:text-base transition-all shrink-0 ${profileActiveTab === 'covers' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                     >
                       Covers
                     </button>
                     <button 
                       onClick={() => goToProfileTab('duets')}
                       className={`pb-3 border-b-2 font-bold text-sm sm:text-base transition-all shrink-0 ${profileActiveTab === 'duets' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                     >
                       Duets
                     </button>
                     <button 
                       onClick={() => goToProfileTab('playlists')}
                       className={`pb-3 border-b-2 font-bold text-sm sm:text-base transition-all shrink-0 ${profileActiveTab === 'playlists' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                     >
                       Playlists
                     </button>
                     {!selectedUserProfile && (
                       <button 
                         onClick={() => goToProfileTab('rooms')}
                         className={`pb-3 border-b-2 font-bold text-sm sm:text-base transition-all shrink-0 ${profileActiveTab === 'rooms' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                       >
                         Saved
                       </button>
                     )}
                     {!selectedUserProfile && (
                       <button 
                         onClick={() => goToProfileTab('manage')}
                         className={`pb-3 border-b-2 font-bold text-sm sm:text-base transition-all shrink-0 ${profileActiveTab === 'manage' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                       >
                         Manage
                       </button>
                     )}
                     {!selectedUserProfile && (
                       <button 
                         onClick={() => goToProfileTab('uploads')}
                         className={`pb-3 border-b-2 font-bold text-sm sm:text-base transition-all shrink-0 ${profileActiveTab === 'uploads' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                       >
                         My Uploads
                       </button>
                     )}
                     {!selectedUserProfile && (
                       <button 
                         onClick={() => goToProfileTab('drafts')}
                         className={`pb-3 border-b-2 font-bold text-sm sm:text-base transition-all shrink-0 ${profileActiveTab === 'drafts' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                       >
                         Drafts
                       </button>
                     )}
                   </div>

                   {/* Tabs Content */}
                   {profileActiveTab === 'covers' && (
                     <div className="space-y-4">
                       {!selectedUserProfile && (
                         <p className="text-sm text-muted-foreground">
                           Vocal cover recordings you published. Backing tracks you upload live under My Uploads.
                         </p>
                       )}
                     <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                       {viewedProfileCovers.length === 0 ? (
                         <p className="col-span-full text-center py-8 text-sm text-muted-foreground">
                           {selectedUserProfile ? 'No published covers yet.' : 'Record a cover in the studio to see it here.'}
                         </p>
                       ) : viewedProfileCovers.map((cover, idx) => (
                         <div 
                           key={cover.id}
                           onClick={() => { void openUserCoverCard(cover); }}
                           className="aspect-[3/4] bg-secondary rounded-xl overflow-hidden relative group cursor-pointer border border-border hover:border-primary/50 transition-all shadow-sm flex flex-col justify-end"
                         >
                           <span className="absolute top-2 left-2 z-20 px-2 py-0.5 rounded-md bg-primary/90 text-primary-foreground text-[9px] font-black uppercase tracking-wide">
                             Cover
                           </span>
                           <img src={cover.img || `https://images.unsplash.com/photo-1516280440502-6c9ab45187fb?w=500&auto=format&fit=crop&q=60&${idx}`} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-80" />
                           <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end p-3 z-10">
                             <div className="text-white font-extrabold text-sm truncate">{cover.title}</div>
                             <p className="text-white/70 text-xs truncate mb-1">{cover.artist}</p>
                             {cover.caption ? (
                               <p className="text-white/60 text-[10px] truncate mb-1">{cover.caption}</p>
                             ) : null}
                             <div className="flex items-center gap-3 text-white/90 text-[10px] mt-1 font-bold">
                                <span className="flex items-center gap-1"><Play className="w-3.5 h-3.5 text-primary fill-primary" /> {cover.plays}</span>
                                <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" /> {cover.likes}</span>
                                {typeof cover.score === 'number' ? (
                                  <span className="text-amber-300">{cover.score}%</span>
                                ) : null}
                             </div>
                           </div>
                         </div>
                       ))}
                     </div>
                     </div>
                   )}

                   {profileActiveTab === 'duets' && (
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                       {[
                         { id: 'd1', partners: `@sing_star & ${profileUser.handle}`, title: 'Shallow (Duet)', plays: '15.4K', likes: '1.2K', img: 'https://images.unsplash.com/photo-1493225457124-a1a2a5f5f9af?w=500&auto=format&fit=crop&q=60' },
                         { id: 'd2', partners: `@duet_king & ${profileUser.handle}`, title: 'Stay (Acoustic Duet)', plays: '9.8K', likes: '840', img: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60' }
                       ].map((duet) => (
                         <div 
                           key={duet.id}
                           onClick={() => {
                             setPlayingTrack({ id: duet.id, title: duet.title, artist: duet.partners, plays: duet.plays, likes: duet.likes, img: duet.img }); setTrackTime(0); setTrackMaxSeconds(135); setIsPlayingTrack(true); window.dispatchEvent(new CustomEvent('app-toast', { detail: `Playing Duet: "${duet.title}" 🎶` }));
                           }}
                           className="bg-card rounded-2xl p-4 border border-border hover:border-primary/40 transition-all flex items-center gap-4 cursor-pointer group"
                         >
                           <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 relative bg-zinc-800">
                             <img src={duet.img} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                             <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                               <Play className="w-5 h-5 text-white fill-white" />
                             </div>
                           </div>
                           <div className="flex-1 min-w-0">
                             <h4 className="font-bold text-sm truncate group-hover:text-primary transition-colors">{duet.title}</h4>
                             <p className="text-xs text-muted-foreground truncate font-medium mt-0.5">{duet.partners}</p>
                             <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-semibold mt-1.5">
                               <span className="flex items-center gap-0.5"><Play className="w-3 h-3" /> {duet.plays}</span>
                               <span className="flex items-center gap-0.5 text-rose-500"><Heart className="w-3 h-3 fill-rose-500" /> {duet.likes}</span>
                             </div>
                           </div>
                         </div>
                       ))}
                     </div>
                   )}

                   {profileActiveTab === 'playlists' && (
                     <div className="space-y-4">
                       {!selectedUserProfile && (
                         <>
                           <button 
                             onClick={() => {
                               setNewPlaylistName('');
                               setIsPlaylistModalOpen(true);
                             }}
                             className="w-full py-3.5 border-2 border-dashed border-border hover:border-primary/45 rounded-2xl flex items-center justify-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary transition-all mb-4 bg-transparent cursor-pointer"
                           >
                             <span>+ Create New Playlist</span>
                           </button>
                         </>
                       )}
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                         {(selectedUserProfile ? [
                           { id: 'sp1', title: 'Top Performances 🌟', songCount: 5, plays: '12K', img: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=60' }
                         ] : userPlaylists).map((playlist) => (
                           <div 
                             key={playlist.id}
                             onClick={() => {
                               setViewingPlaylist(playlist); window.dispatchEvent(new CustomEvent('app-toast', { detail: `Opening Playlist: ${playlist.title}` }));
                             }}
                             className="bg-card border border-border rounded-xl p-3 flex gap-4 hover:border-primary/40 transition-all cursor-pointer group"
                           >
                             <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-zinc-800">
                               <img src={playlist.img} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                             </div>
                             <div className="flex-1 flex flex-col justify-center min-w-0">
                               <h4 className="font-extrabold text-sm sm:text-base truncate group-hover:text-primary transition-colors">{playlist.title}</h4>
                               <p className="text-xs text-muted-foreground font-semibold mt-1">{playlist.songCount} songs • {playlist.plays} plays</p>
                             </div>
                           </div>
                         ))}
                       </div>
                     </div>
                   )}

                   {profileActiveTab === 'manage' && !selectedUserProfile && (
                     <div className="space-y-4">
                       <p className="text-muted-foreground font-medium text-sm">
                         Rooms you own, co-own, or admin — open to enter with the correct role and room type.
                       </p>
                       <ManagedRoomsList
                         variant="profile"
                         onOpenRoom={(room) => openManagedRoom(room)}
                         onEditRoom={(room) => openManagedRoom(room, `/room/edit/${room.id}`)}
                       />
                       <button
                         type="button"
                         onClick={() => openSmuleRoomFlow('/room/create', 'karaoke-profile-manage')}
                         className="w-full py-3.5 border-2 border-dashed border-border hover:border-primary/45 rounded-2xl flex items-center justify-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary transition-all bg-transparent"
                       >
                         <Plus className="w-4 h-4" />
                         Create New Room
                       </button>
                     </div>
                   )}

                   {profileActiveTab === 'rooms' && !selectedUserProfile && (
                     <div className="space-y-4">
                       <p className="text-muted-foreground font-medium text-sm">
                         Your saved party rooms — tap + on a room header to save one here.
                       </p>
                       <SavedRoomsList
                         variant="profile"
                         onOpenRoom={(roomId) => openSmuleRoomFlow(`/room/${roomId}`, 'karaoke-profile-saved')}
                       />
                       <button
                         type="button"
                         onClick={() => {
                           setActiveTab('party');
                         }}
                         className="w-full py-3.5 border-2 border-dashed border-border hover:border-primary/45 rounded-2xl flex items-center justify-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary transition-all bg-transparent"
                       >
                         <Music className="w-4 h-4" />
                         Browse Active Party Rooms
                       </button>
                     </div>
                   )}

                   {profileActiveTab === 'uploads' && !selectedUserProfile && (
                     <div className="space-y-4">
                       <div className="flex items-center justify-between gap-3">
                         <p className="text-sm text-muted-foreground">
                           Backing tracks you upload for karaoke. Vocal performances you record are saved separately under Covers.
                         </p>
                         <button
                           type="button"
                           onClick={() => setIsUploadModalOpen(true)}
                           className="shrink-0 px-4 py-2 bg-primary text-primary-foreground font-bold rounded-full text-sm hover:bg-primary/90 transition"
                         >
                           Upload Song
                         </button>
                       </div>
                       <KaraokeMyUploadsPanel
                         songs={uploadedSongs}
                         metas={uploadedSongMetas}
                         onListen={openUploadedSongListen}
                         onSing={openUploadedSongSing}
                         onDelete={handleDeleteUpload}
                         onUploadClick={() => setIsUploadModalOpen(true)}
                       />
                     </div>
                   )}

                   {profileActiveTab === 'drafts' && !selectedUserProfile && (
                     <div className="space-y-3">
                       {userDrafts.map((draft) => (
                         <div 
                           key={draft.id}
                           className="bg-card border border-border rounded-xl p-4 flex items-center justify-between hover:border-primary/30 transition-all"
                         >
                           <div className="min-w-0">
                             <h4 className="font-extrabold text-sm truncate">{draft.title}</h4>
                             <p className="text-xs text-muted-foreground font-medium mt-0.5">{draft.artist} • Saved {draft.date}</p>
                           </div>
                           <div className="flex items-center gap-3 shrink-0">
                             <span className="text-xs text-muted-foreground font-mono">{draft.duration}</span>
                             <button 
                               onClick={() => {
                                 setSelectedSong({ title: draft.title, artist: draft.artist });
                                 window.dispatchEvent(new CustomEvent('app-toast', { detail: `Resuming draft: ${draft.title} 🎤` }));
                               }}
                               className="px-4 py-2 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-full font-bold text-xs transition"
                             >
                               Resume
                             </button>
                             <button 
                               onClick={() => {
                                 setUserDrafts(prev => prev.filter(d => d.id !== draft.id));
                                 window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Draft deleted' }));
                               }}
                               className="p-2 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 rounded-full transition"
                             >
                               <X className="w-4 h-4" />
                             </button>
                           </div>
                         </div>
                       ))}
                       {userDrafts.length === 0 && (
                         <div className="text-center py-8 text-muted-foreground font-medium text-sm">
                           No draft recordings found. Live record songs to save drafts!
                         </div>
                       )}
                     </div>
                   )}
                </div>
                )}
             </div>
             );
          })()}
        </div>

        {/* Mobile drawer menu (matches main app Shell style) */}
        <AnimatePresence>
          {showMobileMenu && (
            <>
              <button
                type="button"
                className="karaoke-mobile-menu md:hidden fixed inset-0 z-[99] bg-black/40 pointer-events-auto"
                data-app-overlay-root
                aria-label="Close menu"
                onClick={() => setShowMobileMenu(false)}
              />
              <div className="md:hidden fixed inset-0 z-[100] flex justify-end pointer-events-none">
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="karaoke-mobile-menu pointer-events-auto relative w-[300px] h-full bg-card/90 backdrop-blur-xl shadow-2xl border-l border-border pt-safe pb-safe flex flex-col"
              >
                <div className="px-6 pb-6 border-b border-border mb-4 flex items-center justify-between">
                  <h3 className="font-bold text-xl">K-Star Menu</h3>
                  <button
                    type="button"
                    onClick={() => setShowMobileMenu(false)}
                    className={`${navTapIconButtonClass} text-muted-foreground hover:text-foreground font-bold`}
                    aria-label="Close menu"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-4 space-y-2">
                  {KARAOKE_MOBILE_NAV.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          handleKaraokeTabTap(item.id);
                          setShowMobileMenu(false);
                        }}
                        className={`${navTapRowButtonClass} p-4 rounded-xl hover:bg-secondary font-bold transition-colors ${isActive ? 'text-primary' : 'text-foreground'} relative`}
                      >
                        <Icon className="w-6 h-6" />
                        {item.label}
                        {item.id === 'messages' && db.unreadMessagesCount > 0 ? (
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                            {db.unreadMessagesCount > 9 ? '9+' : db.unreadMessagesCount}
                          </span>
                        ) : null}
                        {item.id === 'notifications' && db.hasUnreadNotifications ? (
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-red-500 rounded-full border border-background" />
                        ) : null}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => {
                      setShowMobileMenu(false);
                      setIsUploadModalOpen(true);
                    }}
                    className="flex items-center gap-4 w-full p-4 rounded-xl hover:bg-secondary font-bold transition-colors text-foreground"
                  >
                    <Upload className="w-6 h-6" />
                    Upload Song
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      db.updateSettings({
                        theme: db.settings.theme === 'dark' ? 'light' : 'dark',
                      });
                      setShowMobileMenu(false);
                    }}
                    className="flex items-center gap-4 w-full p-4 rounded-xl hover:bg-secondary font-bold transition-colors text-foreground"
                  >
                    {db.settings.theme === 'dark' ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
                    Toggle Theme
                  </button>
                </div>

                <div className="px-4 pt-3 pb-4 border-t border-border shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedUserProfile(null);
                      setActiveTab('profile');
                      commitKaraokeNavigation({
                        tab: 'profile',
                        profileTab: profileActiveTab,
                        user: null,
                        track: null,
                        recording: null,
                      });
                      setShowMobileMenu(false);
                    }}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl transition border ${
                      activeTab === 'profile' && !selectedUserProfile
                        ? 'bg-secondary border-border shadow-sm'
                        : 'border-transparent hover:bg-secondary/50'
                    }`}
                  >
                    <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-orange-400 to-pink-500 p-0.5 shrink-0 shadow-sm">
                      <img
                        src={CURRENT_USER.avatar}
                        alt="Profile"
                        className="w-full h-full bg-card rounded-full object-cover"
                      />
                    </div>
                    <div className="text-left min-w-0 flex-1">
                      <div className="font-bold text-sm truncate">{CURRENT_USER.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{CURRENT_USER.handle}</div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                  </button>
                </div>
              </motion.div>
            </div>
            </>
          )}
        </AnimatePresence>

        {showSmuleRoomFlow && (
          <KaraokeSmuleRoomFlow
            flowKey={smuleRoomFlowKey}
            initialPath={smuleRoomInitialPath}
            flowEntry={smuleRoomFlowEntry}
            onClose={() => {
              clearActiveRoomSession();
              setShowSmuleRoomFlow(false);
            }}
          />
        )}
      </div>
      
      {/* Right Side / Sidebar (Desktop specific: Top Singers & Leaderboards) */}
      <div className="hidden xl:flex w-80 2xl:w-96 bg-card/50 flex-col z-10 shrink-0 border-l border-border">
         <div className="p-5 border-b border-border bg-card sticky top-0 shadow-sm">
           <h3 className="font-extrabold text-xl flex items-center gap-2">
             <Trophy className="w-5 h-5 text-amber-500" /> Global Leaderboard
           </h3>
           <div className="flex gap-2 mt-4 text-sm bg-secondary/50 p-1 rounded-lg">
             <button 
               onClick={() => setDesktopLeaderboardTab('weekly')}
               className={`flex-1 py-1.5 rounded-md font-bold transition-colors ${desktopLeaderboardTab === 'weekly' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground font-medium hover:text-foreground'}`}
             >
               Weekly
             </button>
             <button 
               onClick={() => setDesktopLeaderboardTab('alltime')}
               className={`flex-1 py-1.5 rounded-md font-bold transition-colors ${desktopLeaderboardTab === 'alltime' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground font-medium hover:text-foreground'}`}
             >
               All-Time
             </button>
           </div>
         </div>

         <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {desktopSidebarLeaders.map((leader) => (
              <div 
                key={leader.seed} 
                className={`flex items-center gap-3 p-3 rounded-2xl transition-colors hover:bg-secondary/80 cursor-pointer ${leader.isPro ? 'bg-secondary/40 border border-border/50' : ''}`}
                onClick={() => {
                  navigateToKaraokeOtherProfile({
                    name: leader.name.replace('@', ''),
                    handle: leader.name,
                    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${leader.seed}`,
                    followers: leader.followers,
                    gifts: leader.gifts,
                    likes: leader.isPro ? '5M+' : '1M+',
                    description: 'Singer and performer! Let\'s sing together! 🎤'
                  });
                  window.dispatchEvent(new CustomEvent('app-toast', { detail: `Viewing ${leader.name}'s profile` }));
                }}
              >
                <div className={`font-black text-center w-6 text-sm ${leader.rank === 1 ? 'text-amber-500 text-lg' : leader.rank === 2 ? 'text-zinc-400 text-lg' : leader.rank === 3 ? 'text-orange-400 text-lg' : 'text-muted-foreground'}`}>
                  {leader.rank}
                </div>
                <div className="relative">
                  <div className={`w-12 h-12 rounded-full shrink-0 border-2 overflow-hidden bg-background ${leader.rank === 1 ? 'border-amber-500' : leader.rank === 2 ? 'border-zinc-400' : leader.rank === 3 ? 'border-orange-400' : 'border-transparent'}`}>
                     <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${leader.seed}`} className="w-full h-full" />
                  </div>
                  {leader.isPro && (
                     <div className="absolute -bottom-1 -right-1 bg-primary text-[8px] font-bold text-white px-1.5 py-0.5 rounded-full border border-background">PRO</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate group-hover:text-primary transition-colors">{leader.name}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                     <span className="flex items-center gap-0.5"><Users className="w-3 h-3" /> {leader.followers}</span>
                     <span className="flex items-center gap-0.5 text-amber-500"><Gift className="w-3 h-3" /> {leader.gifts}</span>
                  </div>
                </div>
                <button className="w-8 h-8 rounded-full bg-secondary text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-colors shrink-0">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ))}
         </div>
         
         {/* Sticky Footer: Current User Rank */}
         <div className="p-4 border-t border-border bg-card/80 backdrop-blur-md sticky bottom-0">
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-primary/10 border border-primary/20 shadow-sm relative overflow-hidden">
               <div className="absolute inset-0 bg-primary/5 opacity-50 z-0 pointer-events-none"></div>
               <div className="font-black text-center w-6 text-sm text-primary z-10">42</div>
               <div className="relative z-10 shrink-0">
                 <div className="w-12 h-12 rounded-full border-2 overflow-hidden bg-background border-primary">
                    <img src={CURRENT_USER.avatar} alt="Profile" className="w-full h-full rounded-full object-cover" />
                 </div>
               </div>
               <div className="flex-1 min-w-0 z-10">
                 <div className="font-bold text-primary truncate text-sm">{CURRENT_USER.handle}</div>
                 <div className="text-xs text-primary/80 flex items-center gap-2 mt-0.5">
                    <span className="flex items-center gap-0.5"><Users className="w-3 h-3" /> {CURRENT_USER.followers}</span>
                 </div>
               </div>
               <div className="flex items-center gap-1 text-xs font-bold text-green-500 z-10 shrink-0">
                 <TrendingUp className="w-4 h-4" /> 3
               </div>
            </div>
         </div>
      </div>
      
      {showGiftModal && (
         <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
            <div className="bg-card w-full max-w-sm rounded-[24px] pt-6 pb-8 px-6 shadow-2xl relative animate-in zoom-in-95 border border-border">
               <div className="flex justify-between items-center mb-6">
                  <h3 className="font-extrabold text-xl flex items-center gap-2">Send Gift <Gift className="w-5 h-5 text-pink-500" /></h3>
                  <button onClick={() => setShowGiftModal(false)} className="p-2 hover:bg-secondary rounded-full bg-secondary/50"><X className="w-5 h-5" /></button>
               </div>
               
               <div className="flex items-center justify-between bg-amber-500/10 px-4 py-3 rounded-xl mb-6 border border-amber-500/20">
                  <div className="flex items-center gap-2">
                     <Coins className="w-5 h-5 text-amber-500" />
                     <span className="font-black text-amber-500">{userCoins.toLocaleString()} Coins</span>
                  </div>
                  <button 
                    onClick={() => {
                      addKstarCoins(appUser.id, 500);
                      window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Added +500 free test Coins! 🪙' }));
                    }}
                    className="text-xs font-black bg-amber-500 text-white px-3 py-1.5 rounded-full hover:bg-amber-600 active:scale-95 transition"
                  >
                    Recharge
                  </button>
               </div>

               <div className="grid grid-cols-3 gap-3 mb-6">
                  {[
                    { id: 1, name: 'Rose', cost: 10, icon: '🌹', color: 'border-rose-500/10 hover:border-rose-500 text-rose-500' },
                    { id: 2, name: 'Mic', cost: 50, icon: '🎤', color: 'border-indigo-500/10 hover:border-indigo-500 text-indigo-500' },
                    { id: 3, name: 'Heart', cost: 100, icon: '💖', color: 'border-pink-500/10 hover:border-pink-500 text-pink-500' },
                    { id: 4, name: 'Trophy', cost: 500, icon: '🏆', color: 'border-amber-500/10 hover:border-amber-500 text-amber-500' },
                    { id: 5, name: 'Rocket', cost: 1000, icon: '🚀', color: 'border-orange-500/10 hover:border-orange-500 text-orange-500' },
                    { id: 6, name: 'Crown', cost: 5000, icon: '👑', color: 'border-yellow-500/30 hover:border-yellow-500 text-yellow-500' },
                  ].map((gift) => (
                     <button 
                       key={gift.id} 
                       onClick={() => setSelectedGiftId(gift.id)}
                       className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all active:scale-95 ${
                         selectedGiftId === gift.id 
                         ? 'border-primary ring-2 ring-primary/45 bg-primary/5 font-bold' 
                         : 'bg-secondary/40 hover:bg-secondary border-border/80'
                       } ${gift.color}`}
                     >
                        <div className="text-2xl mb-1">{gift.icon}</div>
                        <div className="text-[10px] font-bold uppercase tracking-wider">{gift.name}</div>
                        <div className="text-[10px] font-black flex items-center gap-0.5 mt-1 opacity-90"><Coins className="w-3 h-3 text-amber-500" /> {gift.cost}</div>
                     </button>
                  ))}
               </div>

               <button 
                 onClick={handleSendGift}
                 className="w-full py-4 bg-gradient-to-r from-pink-500 via-rose-500 to-amber-500 text-white font-black rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-95 transition-all uppercase tracking-wider text-sm flex items-center justify-center gap-2"
               >
                  <Gift className="w-4 h-4 text-white" /> Direct Gift To Host
               </button>
             </div>
          </div>
       )}

       {showVipModal && (
         <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card w-full max-w-md rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden animate-in zoom-in-95">
               <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl" />
               <div className="absolute bottom-0 left-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl" />
               
               <div className="relative z-10">
                  <div className="flex justify-between items-start mb-6">
                     <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                        <Crown className="w-8 h-8 text-white" />
                     </div>
                     <button onClick={() => setShowVipModal(false)} className="p-2 hover:bg-secondary rounded-full transition"><X className="w-5 h-5" /></button>
                  </div>

                  <h2 className="text-3xl font-extrabold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-500">K-Star VIP</h2>
                  <p className="text-muted-foreground font-medium mb-8">Elevate your vocal journey with premium studio features.</p>

                  <div className="space-y-4 mb-8">
                     {[
                        { icon: <Mic className="w-5 h-5 text-amber-500"/>, text: "Studio-Grade Pitch Correction" },
                        { icon: <Music className="w-5 h-5 text-amber-500"/>, text: "Unlimited High-Res Song Backtracks" },
                        { icon: <Star className="w-5 h-5 text-amber-500"/>, text: "VIP Badge & Custom Profile Themes" },
                        { icon: <Video className="w-5 h-5 text-amber-500"/>, text: "Exclusive AR Video Enhancements" },
                     ].map((f, i) => (
                        <div key={i} className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">{f.icon}</div>
                           <span className="font-semibold text-sm">{f.text}</span>
                        </div>
                     ))}
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                     <div className="border-2 border-border hover:border-amber-500 rounded-2xl p-4 cursor-pointer transition relative group">
                        <div className="text-muted-foreground font-bold text-xs uppercase tracking-wider mb-1">Monthly</div>
                        <div className="text-2xl font-black">$7.99</div>
                        <div className="text-[10px] text-muted-foreground mt-1">Billed monthly</div>
                     </div>
                     <div className="border-2 border-amber-500 bg-amber-500/5 rounded-2xl p-4 cursor-pointer transition relative shadow-[0_0_15px_rgba(245,158,11,0.1)]">
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full whitespace-nowrap">Save 40%</div>
                        <div className="text-amber-600 font-bold text-xs uppercase tracking-wider mb-1">Annually</div>
                        <div className="text-2xl font-black">$4.99<span className="text-xs text-muted-foreground font-medium">/mo</span></div>
                        <div className="text-[10px] text-muted-foreground mt-1">$59.88 billed yearly</div>
                     </div>
                  </div>

                  <button 
                    onClick={() => {
                      const result = db.purchasePremiumPackage('profile_premium_1m');
                      setShowVipModal(false);
                      if (result.ok) {
                        window.dispatchEvent(
                          new CustomEvent('app-toast', {
                            detail: 'VIP Premium unlocked — synced across main app and K-Star!',
                          }),
                        );
                      } else {
                        window.dispatchEvent(
                          new CustomEvent('app-toast', {
                            detail: result.reason ?? 'Could not unlock VIP. Check your wallet balance.',
                          }),
                        );
                      }
                    }}
                    className="w-full py-4 bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-transform text-lg"
                  >
                     Start 7-Day Free Trial
                  </button>
                  <p className="text-center text-[10px] text-muted-foreground mt-4">Cancel anytime in your app store settings.</p>
               </div>
            </div>
         </div>
      )}

      
      {/* Comments Drawer / Sheet flyout */}
      {activeCommentPostId !== null && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-card w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl relative overflow-hidden animate-in slide-in-from-bottom duration-300 border border-border flex flex-col max-h-[85vh] sm:max-h-[600px]">
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
              <div>
                <h3 className="font-extrabold text-lg flex items-center gap-2">Comments <MessageCircle className="w-5 h-5 text-primary" /></h3>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase mt-0.5">Collab Cover Session Feedback</p>
              </div>
              <button 
                type="button"
                onClick={() => {
                  setActiveCommentPostId(null);
                  setReplyingToCommentId(null);
                  setReplyText('');
                }} 
                className="p-2 hover:bg-secondary rounded-full bg-secondary/50 text-muted-foreground hover:text-foreground transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {(commentsByPost[activeCommentPostId] || []).length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <MessageCircle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm font-semibold">No comments yet</p>
                  <p className="text-xs opacity-60">Be the first to share your appreciation!</p>
                </div>
              ) : (
                (commentsByPost[activeCommentPostId] || []).map((comm) => (
                  <div key={comm.id} className="flex gap-3 bg-secondary/25 p-3 rounded-2xl border border-secondary text-sm animate-in fade-in duration-150">
                    <img src={comm.avatar} className="w-8 h-8 rounded-full bg-zinc-100 border shrink-0" alt="Avatar" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-foreground">{comm.user}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">{comm.time}</span>
                      </div>
                      <p className="text-muted-foreground font-medium mt-1 leading-relaxed">{comm.text}</p>
                      
                      <div className="flex items-center gap-4 mt-2">
                         <button onClick={() => handleLikeComment(activeCommentPostId!, comm.id)} className="flex items-center gap-1 text-[10px] text-muted-foreground font-bold uppercase hover:text-rose-500">
                           <Heart className={`w-3 h-3 ${comm.isLiked ? 'fill-rose-500 text-rose-500' : ''}`} /> {comm.likes}
                         </button>
                         <button onClick={() => setReplyingToCommentId(comm.id === replyingToCommentId ? null : comm.id)} className="text-[10px] text-muted-foreground font-bold uppercase hover:text-primary">
                           Reply
                         </button>
                      </div>

                      {/* Replies */}
                      <div className="mt-2 space-y-2">
                         {comm.replies.map(rep => (
                             <ReplyItem key={rep.id} reply={rep} postId={activeCommentPostId!} onReply={setReplyingToCommentId} onLike={handleLikeReply} replyingToCommentId={replyingToCommentId} setReplyingToCommentId={setReplyingToCommentId} replyText={replyText} setReplyText={setReplyText} handleReplyToComment={handleReplyToComment} />
                         ))}
                      </div>

                      {replyingToCommentId === comm.id && (
                         <div className="flex gap-2 mt-2">
                            <input 
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                               onKeyDown={(e) => {
                                 if (e.key === 'Enter') {
                                   handleReplyToComment(activeCommentPostId!, comm.id, replyText);
                                   setReplyText('');
                                   setReplyingToCommentId(null);
                                 }
                               }}
                              placeholder="Write a reply..."
                              className="flex-1 bg-secondary rounded-xl text-xs px-3 py-1.5 focus:outline-none"
                            />
                            <button onClick={() => {
                              handleReplyToComment(activeCommentPostId!, comm.id, replyText);
                              setReplyText('');
                              setReplyingToCommentId(null);
                            }} className="text-xs bg-primary text-primary-foreground px-3 py-1 rounded-xl font-bold">Post</button>
                         </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Input Footer */}
            <div className="p-4 border-t border-border/60 bg-background/95 backdrop-blur-sm sticky bottom-0 flex gap-3">
              <input 
                type="text" 
                placeholder="Write a sweet comment... 🎤" 
                value={commentText} 
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddComment(activeCommentPostId);
                }}
                className="flex-1 bg-secondary text-sm rounded-full px-5 py-3.5 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all border border-transparent focus:border-primary/50"
              />
              <button 
                onClick={() => handleAddComment(activeCommentPostId)}
                className="px-6 bg-primary text-primary-foreground font-bold rounded-full text-sm transition-all hover:bg-primary/90 hover:scale-[1.02]"
              >
                Post
              </button>
            </div>
          </div>
        </div>
      )}

{/* Profile background position editor */}
      {backgroundEditorDraft ? (
        <KaraokeProfileBackgroundEditor
          draft={backgroundEditorDraft}
          onSave={handleBackgroundEditorSave}
          onCancel={handleBackgroundEditorCancel}
        />
      ) : null}

{/* Edit Profile Modal */}
      {showEditProfileModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-md rounded-3xl p-6 md:p-8 shadow-2xl relative border border-border animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-extrabold text-2xl flex items-center gap-2">
                <Edit className="w-5 h-5 text-primary" /> Edit Profile
              </h3>
              <button 
                onClick={() => setShowEditProfileModal(false)}
                className="p-2 hover:bg-secondary rounded-full bg-secondary/50 text-muted-foreground hover:text-foreground transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5">
              {/* Avatar Picker */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Choose Avatar / Seed</label>
                <div className="flex items-center gap-4 bg-secondary/40 p-3 rounded-2xl border border-border">
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-muted shrink-0 border border-border relative">
                    <img 
                      src={karaokeAvatarSrc(editProfileAvatar, appUser.id)} 
                      alt="Avatar Preview" 
                      className="block h-full w-full object-cover" 
                      onError={handleAvatarError}
                    />
                    <label className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/25 hover:bg-black/40 transition-colors">
                      <Camera className="w-4 h-4 text-white" />
                      <input
                        type="file"
                        className="sr-only"
                        accept="image/*,image/svg+xml,.svg,.webp"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = '';
                          if (file) void applySelfProfileAvatarFile(file);
                        }}
                      />
                    </label>
                  </div>
                  <div className="flex-1 min-w-0">
                    <input 
                      type="text" 
                      value={editProfileAvatar.includes('seed=') ? editProfileAvatar.split('seed=')[1] : editProfileAvatar} 
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        if (val) {
                          if (val.startsWith('http://') || val.startsWith('https://')) {
                            setEditProfileAvatar(val);
                          } else {
                            setEditProfileAvatar(`https://api.dicebear.com/7.x/avataaars/svg?seed=${val}`);
                          }
                        } else {
                          setEditProfileAvatar('');
                        }
                      }}
                      placeholder="Type custom seed (e.g., violet, music)" 
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                    <span className="text-[10px] text-muted-foreground block mt-1">Accepts any custom seed or image URL</span>
                  </div>
                </div>

                {/* Predefined Beautiful Seeds Grid */}
                <div className="mt-3">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground/70 block mb-1.5">Quick Presets</span>
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                    {['vocal', 'melody', 'rhythm', 'superstar', 'diva', 'artist', 'legend', 'wave'].map(seed => {
                      const url = `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
                      const isSelected = editProfileAvatar === url;
                      return (
                        <button 
                          key={seed}
                          onClick={() => setEditProfileAvatar(url)}
                          className={`w-10 h-10 rounded-full overflow-hidden border-2 shrink-0 bg-secondary hover:scale-105 transition-transform ${isSelected ? 'border-primary shadow-md shadow-primary/25' : 'border-transparent'}`}
                        >
                          <img src={url} className="w-full h-full" alt={seed} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  K-Star Profile Background
                </label>
                <div className="rounded-2xl border border-border overflow-hidden bg-secondary/30">
                  <KaraokeProfileBackground
                    url={editProfileBackgroundUrl}
                    mediaId={editProfileBackgroundMediaId}
                    mimeType={editProfileBackgroundMimeType}
                    mediaKind={editProfileBackgroundMediaKind}
                    focus={editProfileBackgroundFocus}
                    className="relative h-40 sm:h-44 overflow-hidden"
                    overlayClassName="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent"
                  />
                  <div className="flex items-center gap-2 p-3">
                    <label className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold cursor-pointer hover:bg-secondary transition">
                      <ImagePlus className="w-4 h-4" />
                      Upload image or video
                      <input
                        type="file"
                        className="sr-only"
                        accept={KARAOKE_PROFILE_BACKGROUND_ACCEPT}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = '';
                          if (file) void applyProfileBackgroundFile(file);
                        }}
                      />
                    </label>
                    {editProfileBackgroundUrl || editProfileBackgroundMediaId ? (
                      <button
                        type="button"
                        onClick={() => {
                          setEditProfileBackgroundUrl(null);
                          setEditProfileBackgroundMediaId(null);
                          setEditProfileBackgroundMimeType(undefined);
                          setEditProfileBackgroundMediaKind('image');
                          setEditProfileBackgroundFocus(null);
                        }}
                        className="px-3 py-2 rounded-xl border border-border text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-secondary transition"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  Shown on your K-Star profile header and profile previews. Videos play muted on loop.
                </p>
              </div>

              {/* Display Name */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Vocalist Name</label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={editProfileName} 
                    onChange={(e) => setEditProfileName(e.target.value.slice(0, 25))}
                    placeholder="E.g. Sarah Sings" 
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-primary focus:outline-none pl-10"
                  />
                  <Mic className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-sans text-muted-foreground">{editProfileName.length}/25</span>
                </div>
              </div>

              {/* Bio/Description */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Vocal Bio</label>
                <div className="relative">
                  <textarea 
                    value={editProfileBio} 
                    onChange={(e) => setEditProfileBio(e.target.value.slice(0, 150))}
                    placeholder="Tell other stars about your voice type, genres, and favorite covers..." 
                    rows={3}
                    className="w-full bg-background border border-border rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-primary focus:outline-none resize-none"
                  />
                  <span className="absolute right-3 bottom-2 text-[10px] font-sans text-muted-foreground">{editProfileBio.length}/150</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button 
                onClick={() => setShowEditProfileModal(false)}
                className="flex-1 py-3 border border-border rounded-xl font-bold text-sm text-foreground hover:bg-secondary transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  if (!editProfileName.trim()) {
                    window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Name cannot be empty! ⚠️' }));
                    return;
                  }

                  db.updateUser(appUser.id, (user) => ({
                    ...user,
                    username: editProfileName.trim(),
                    displayName: editProfileName.trim(),
                    bio: editProfileBio,
                    avatarUrl: editProfileAvatar || user.avatarUrl,
                  }));
                  const next = db.users.find((user) => user.id === appUser.id);
                  if (next) scheduleCloudProfileSync(next);
                  setKaraokeProfileBackground(
                    appUser.id,
                    editProfileBackgroundUrl || editProfileBackgroundMediaId
                      ? {
                          url: editProfileBackgroundUrl ?? '',
                          mediaId: editProfileBackgroundMediaId ?? undefined,
                          mediaKind: editProfileBackgroundMediaKind,
                          mimeType: editProfileBackgroundMimeType,
                          focus: editProfileBackgroundFocus ?? undefined,
                          updatedAt: Date.now(),
                        }
                      : null,
                  );
                  setShowEditProfileModal(false);
                  window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Profile saved successfully! ✨' }));
                }}
                className="flex-1 py-3 bg-primary text-primary-foreground font-bold rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-[1.01] flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" /> Save Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden preview media — audio stays here; video moves into track-details stage when visible. */}
      {playingTrack && (
        <div className="sr-only" aria-hidden="true">
          <audio ref={uploadPreviewAudioRef} preload="auto" playsInline />
          <audio ref={coverPreviewAudioRef} preload="auto" playsInline />
          {!(
            showTrackDetails &&
            (
              (activeCoverRecording && activeCoverMediaUrl && isCoverRecordingVideo(activeCoverRecording)) ||
              (playingTrack.isUploaded && isUploadedVideoTrack(playingTrack) && playingTrack.audioUrl && !activeCoverRecording)
            )
          ) && (
            <>
              <video ref={uploadPreviewVideoRef} preload="auto" playsInline muted={false} />
              <video ref={coverPreviewVideoRef} preload="auto" playsInline muted={false} />
            </>
          )}
        </div>
      )}

      {/* Floating Glassmorphic Native Music Player */}
      {playingTrack && !showTrackDetails && (
        <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-background/90 backdrop-blur-xl border border-border rounded-2xl shadow-2xl p-4 z-40 animate-in slide-in-from-bottom-8 duration-300">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className={`w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-border/80 bg-muted relative shadow-md ${isPlayingTrack ? 'animate-[spin_10s_linear_infinite]' : ''}`}>
                <img src={playingTrack.img || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&auto=format&fit=crop&q=60'} className="w-full h-full object-cover" alt="Album" />
                {isPlayingTrack && (
                  <div className="absolute inset-x-0 bottom-0.5 flex justify-center gap-[2px] px-1 h-3 bg-black/45 backdrop-blur-[0.5px] items-end pointer-events-none z-20">
                    {[...Array(5)].map((_, idx) => {
                      const animationDur = ['0.6s', '0.4s', '0.8s', '0.5s', '0.7s'][idx];
                      return (
                        <div 
                          key={idx} 
                          className="w-[3px] bg-primary rounded-full animate-bounce" 
                          style={{ 
                            height: '100%', 
                            animationDuration: animationDur, 
                            animationIterationCount: 'infinite',
                            animationDelay: `${idx * 0.1}s`
                          }} 
                        />
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="absolute -top-1 -right-1 bg-primary text-[8px] font-bold text-white px-1.5 py-0.5 rounded-full border border-background shadow-sm flex items-center gap-0.5 animate-pulse">
                <Sparkles className="w-2.5 h-2.5" /> LIVE
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="font-extrabold text-sm truncate text-foreground">{playingTrack.title}</h4>
              <p className="text-xs text-muted-foreground truncate font-semibold">{playingTrack.artist}</p>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-bold mt-1">
                <span className="flex items-center gap-0.5"><Play className="w-3 h-3 text-primary fill-primary" /> {playingTrack.plays}</span>
                <span className="flex items-center gap-0.5 text-rose-500"><Heart className="w-3 h-3 fill-rose-500" /> {playingTrack.likes}</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button 
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Added track to My Playlist! 💖' }));
                }}
                className="p-2 hover:bg-secondary rounded-full text-muted-foreground hover:text-primary transition"
                title="Add to Playlist"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button 
                type="button"
                onClick={() => {
                  if (!playingTrack?.id) return;
                  openKaraokeShareModal(
                    buildKaraokeTrackSharePayload({
                      trackId: playingTrack.id,
                      recordingId: activeCoverRecording?.id ?? null,
                      title: playingTrack.title,
                    }),
                  );
                }}
                className="group p-2 hover:bg-secondary rounded-full text-muted-foreground hover:text-primary transition"
                title="Share track"
                aria-label="Share track"
              >
                <ShareIcon size="xs" />
              </button>
              <button 
                onClick={() => {
                  captureTrackDetailsOriginRef.current({
                    tab: activeTab,
                    profileTab: activeTab === 'profile' ? profileActiveTab : null,
                    selectedUserProfile,
                    force: true,
                  });
                  setDetailsTab('lyrics');
                  setShowTrackDetails(true);
                }}
                className="p-2 hover:bg-secondary rounded-full text-muted-foreground hover:text-primary transition-all duration-300"
                title="Lyrics & Recordings"
              >
                <Info className="w-4 h-4" />
              </button>
              
              <button 
                onClick={handlePrevTrack}
                className="p-1.5 hover:bg-secondary rounded-full text-muted-foreground hover:text-foreground transition shrink-0"
                title="Previous Track"
              >
                <SkipBack className="w-4 h-4 fill-current" />
              </button>
              <button 
                onClick={() => setIsPlayingTrack(!isPlayingTrack)}
                className={`p-2.5 rounded-full flex items-center justify-center transition shadow-md shrink-0 ${isPlayingTrack ? 'bg-primary text-white hover:bg-primary/95' : 'bg-primary/20 text-primary hover:bg-primary/30'}`}
                title={isPlayingTrack ? "Pause" : "Play"}
              >
                {isPlayingTrack ? (
                  <span className="w-4 h-4 flex items-center justify-center font-black text-[10px] tracking-tighter">||</span>
                ) : (
                  <Play className="w-4 h-4 fill-primary text-primary ml-0.5" />
                )}
              </button>
              <button 
                onClick={handleNextTrack}
                className="p-1.5 hover:bg-secondary rounded-full text-muted-foreground hover:text-foreground transition shrink-0"
                title="Next Track"
              >
                <SkipForward className="w-4 h-4 fill-current" />
              </button>

              <button 
                onClick={() => {
                  pauseUploadPreviewMedia();
                  pauseCoverPreviewMedia();
                  clearActiveCoverPlayback();
                  setPlayingTrack(null);
                  setIsPlayingTrack(false);
                  setTrackTime(0);
                  setTrackProgress(0);
                }} 
                className="p-2 hover:bg-secondary rounded-full text-muted-foreground hover:text-red-500 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-1">
            <div className="relative h-1.5 w-full bg-secondary rounded-full overflow-hidden cursor-pointer" onClick={(e) => {
              seekTrackPreviewFromClientX(e.clientX);
            }}>
              <div 
                className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all duration-150"
                style={{ width: `${trackProgress}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white border-2 border-primary shadow-md"></div>
              </div>
            </div>
            <div className="flex justify-between text-[10px] font-mono text-muted-foreground font-bold">
              <span>{Math.floor(trackTime / 60)}:{(trackTime % 60).toString().padStart(2, '0')}</span>
              <span>{Math.floor(trackMaxSeconds / 60)}:{(trackMaxSeconds % 60).toString().padStart(2, '0')}</span>
            </div>
          </div>
        </div>
      )}

      {/* Playlist Songs Detail Dialog Modal */}
      {viewingPlaylist && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-md rounded-3xl p-6 shadow-2xl relative border border-border animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-6 w-full">
              <div className="flex gap-4 items-center min-w-0 flex-1">
                <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 bg-zinc-800">
                  <img src={viewingPlaylist.img || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&auto=format&fit=crop&q=60'} className="w-full h-full object-cover" alt="Playlist" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-extrabold text-xl truncate text-foreground">{viewingPlaylist.title}</h3>
                  <p className="text-xs text-muted-foreground font-semibold mt-1">Playlist • {viewingPlaylist.id.startsWith('up_') ? '0' : '3'} songs</p>
                </div>
              </div>
              <button 
                onClick={() => setViewingPlaylist(null)}
                className="p-2 hover:bg-secondary rounded-full bg-secondary/50 text-muted-foreground hover:text-foreground transition shrink-0 ml-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Playlist songs list */}
            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {viewingPlaylist.id.startsWith('up_') ? (
                <div className="text-center py-12 text-muted-foreground font-semibold text-sm">
                  This Playlist is empty. Select covers and click add to populate! 💿
                </div>
              ) : (
                [
                  { id: 'p_s1', title: 'Bohemian Rhapsody', artist: 'Queen', plays: '12.4K', likes: '840', img: 'https://images.unsplash.com/photo-1516280440502-6c9ab45187fb?w=100&auto=format&fit=crop&q=60&1' },
                  { id: 'p_s2', title: 'Blinding Lights', artist: 'The Weeknd', plays: '8.2K', likes: '620', img: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&auto=format&fit=crop&q=60' },
                  { id: 'p_s3', title: 'Someone Like You', artist: 'Adele', plays: '5.1K', likes: '430', img: 'https://images.unsplash.com/photo-1493225457124-a1a2a5f5f9af?w=100&auto=format&fit=crop&q=60' }
                ].map((song, i) => (
                  <div 
                    key={song.id}
                    onClick={() => {
                      setPlayingTrack({
                        id: song.id,
                        title: song.title,
                        artist: song.artist,
                        plays: song.plays,
                        likes: song.likes,
                        img: song.img,
                      });
                      setTrackTime(0);
                      setTrackMaxSeconds(150);
                      setIsPlayingTrack(true);
                      setViewingPlaylist(null);
                      window.dispatchEvent(new CustomEvent('app-toast', { detail: `Playing "${song.title}" from ${viewingPlaylist.title} 🎧` }));
                    }}
                    className="p-3 bg-secondary/30 hover:bg-secondary/70 border border-border/50 hover:border-primary/30 rounded-2xl flex items-center gap-3 cursor-pointer group transition-all"
                  >
                    <span className="font-bold text-xs text-muted-foreground w-4 text-center">{i + 1}</span>
                    <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-zinc-800 relative">
                      <img src={song.img} className="w-full h-full object-cover" alt={song.title} />
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="w-4 h-4 text-white fill-white" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm truncate group-hover:text-primary transition-colors">{song.title}</h4>
                      <p className="text-xs text-muted-foreground truncate font-medium mt-0.5">{song.artist}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                      <Play className="w-3 h-3 text-muted-foreground" /> {song.plays}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-border flex justify-end gap-3">
              <button 
                onClick={() => setViewingPlaylist(null)}
                className="px-6 py-2 bg-secondary hover:bg-secondary/80 font-bold rounded-xl text-sm transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Song Info / Recordings & Lyrics Modal */}
      {showTrackDetails && playingTrack && (
        <div className="fixed inset-0 z-50 bg-background text-foreground flex flex-col animate-in slide-in-from-bottom duration-300">
          {/* Header */}
          <div className="h-16 shrink-0 border-b border-border flex items-center justify-between px-4 bg-card shadow-sm z-10">
            <button 
              onClick={() => { closeTrackDetails(); }}
              className="p-2 bg-secondary hover:bg-secondary/80 text-foreground rounded-full transition shrink-0 flex items-center justify-center shadow-sm"
              title="Back"
            >
              <ChevronLeft className="w-6 h-6 stroke-[3]" />
            </button>
            <div className="min-w-0 flex-1 text-center px-4">
              <h2 className="font-extrabold text-sm sm:text-base truncate text-foreground leading-tight">
                {activeCoverRecording?.songTitle || playingTrack.title}
              </h2>
              <p className="text-xs text-muted-foreground truncate leading-tight mt-0.5">
                {activeCoverRecording
                  ? activeCoverRecording.performers.map((performer) => performer.handle).join(' + ')
                  : playingTrack.artist}
              </p>
            </div>
            <button 
              onClick={() => {
                const isBookmarked = bookmarkedTracks.includes(playingTrack.id);
                if (isBookmarked) {
                  setBookmarkedTracks(prev => prev.filter(id => id !== playingTrack.id));
                  window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Removed from Bookmarks! 🗑️' }));
                } else {
                  setBookmarkedTracks(prev => [...prev, playingTrack.id]);
                  window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Added to Bookmarks! 🔖' }));
                }
              }}
              className="p-2 hover:bg-secondary rounded-full transition shrink-0"
              title="Bookmark Song"
            >
              <Bookmark className={`w-5 h-5 transition-all ${bookmarkedTracks.includes(playingTrack.id) ? 'text-primary fill-primary scale-110' : 'text-muted-foreground hover:text-foreground'}`} />
            </button>
          </div>

          {/* Scrollable Content Wrapper */}
          <div className="flex-1 overflow-y-auto pb-24 bg-background">
            {/* Banner / playback stage */}
            <div
              className={`relative aspect-[16/10] sm:aspect-[16/7] w-full bg-zinc-950 overflow-hidden group ${
                (
                  (activeCoverRecording && activeCoverMediaUrl && isCoverRecordingVideo(activeCoverRecording)) ||
                  (playingTrack.isUploaded && isUploadedVideoTrack(playingTrack) && playingTrack.audioUrl && !activeCoverRecording)
                )
                  ? 'cursor-pointer'
                  : ''
              }`}
              onClick={() => {
                const isVideoStage =
                  Boolean(activeCoverRecording && activeCoverMediaUrl && isCoverRecordingVideo(activeCoverRecording)) ||
                  Boolean(playingTrack.isUploaded && isUploadedVideoTrack(playingTrack) && playingTrack.audioUrl && !activeCoverRecording);
                if (isVideoStage || (activeCoverRecording && activeCoverMediaUrl)) {
                  setShowTrackPlayerControls((prev) => !prev);
                }
              }}
            >
              {(activeCoverRecording && activeCoverMediaUrl && isCoverRecordingVideo(activeCoverRecording)) ||
              (playingTrack.isUploaded && isUploadedVideoTrack(playingTrack) && playingTrack.audioUrl && !activeCoverRecording) ? (
                activeCoverRecording && activeCoverMediaUrl && isCoverRecordingVideo(activeCoverRecording) ? (
                  <video
                    ref={coverPreviewVideoRef}
                    preload="auto"
                    playsInline
                    muted={false}
                    className="w-full h-full object-contain bg-black"
                  />
                ) : (
                  <video
                    ref={uploadPreviewVideoRef}
                    preload="auto"
                    playsInline
                    muted={false}
                    className="w-full h-full object-contain bg-black"
                  />
                )
              ) : (
                <img
                  src={
                    activeCoverRecording?.img ||
                    (playingTrack.id === 'epic_underworld' || playingTrack.img?.includes('seed')
                      ? 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=60'
                      : (playingTrack.img ||
                          'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=60'))
                  }
                  className="w-full h-full object-cover opacity-90 scale-105 group-hover:scale-110 transition-transform duration-700"
                  alt={activeCoverRecording ? 'Cover recording' : 'Cover art'}
                />
              )}
              {activeCoverRecording && showTrackPlayerControls && (
                <div className="absolute top-3 left-3 z-10 pointer-events-none">
                  <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur text-[10px] font-bold uppercase tracking-wide text-white">
                    {performanceTypeLabel(activeCoverRecording.performanceType)} cover · {activeCoverRecording.mediaKind}
                  </span>
                </div>
              )}
              <div
                className={`absolute inset-0 bg-gradient-to-t from-background via-black/30 to-black/60 flex flex-col justify-between p-4 transition-opacity duration-300 ${
                  showTrackPlayerControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              >
                {/* Top decorative spacing */}
                <div></div>
                
                {/* Big Center Play Overlay */}
                <div className="flex justify-center items-center pointer-events-auto">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsPlayingTrack((prev) => !prev);
                    }}
                    className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white flex items-center justify-center hover:bg-white/25 hover:scale-105 active:scale-95 transition-all duration-300 shadow-xl"
                  >
                    {isPlayingTrack ? (
                      <span className="font-bold text-lg leading-none tracking-tighter">||</span>
                    ) : (
                      <Play className="w-7 h-7 text-white fill-white ml-1" />
                    )}
                  </button>
                </div>

                {/* Bottom Timing Status overlay */}
                <div
                  className="flex justify-between items-end gap-3 pointer-events-auto"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <div className="bg-black/65 backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-mono font-bold text-white tracking-widest flex items-center gap-1.5 border border-white/10 shrink-0">
                    <span className="w-2 h-2 rounded-full bg-primary animate-ping"></span>
                    {Math.floor(trackTime / 60)}:{(trackTime % 60).toString().padStart(2, '0')} / {Math.floor(trackMaxSeconds / 60)}:{(trackMaxSeconds % 60).toString().padStart(2, '0')}
                  </div>
                  <div
                    ref={trackSeekBarRef}
                    role="slider"
                    aria-label="Seek"
                    aria-valuemin={0}
                    aria-valuemax={trackMaxSeconds}
                    aria-valuenow={trackTime}
                    className="relative flex-1 max-w-[320px] h-5 flex items-center cursor-pointer touch-none select-none"
                    onPointerDown={handleTrackSeekPointerDown}
                    onPointerMove={handleTrackSeekPointerMove}
                    onPointerUp={handleTrackSeekPointerUp}
                    onPointerCancel={handleTrackSeekPointerUp}
                  >
                    <div className="relative w-full h-1.5 bg-white/25 rounded-full">
                      <div
                        className="absolute inset-y-0 left-0 bg-primary rounded-full"
                        style={{
                          width: `${trackProgress}%`,
                          transition: isTrackSeeking ? 'none' : 'width 150ms linear',
                        }}
                      />
                      <div
                        className={`absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white border border-black/15 shadow-md transition-transform ${
                          isTrackSeeking ? 'scale-110' : 'scale-100 group-hover:scale-105'
                        }`}
                        style={{ left: `calc(${trackProgress}% - 7px)` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Creator Profile section */}
            {trackDetailsCreator && (
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-card/25">
              <div className="flex items-center gap-3">
                <div className="relative w-11 h-11 rounded-full border border-primary/20 p-[1.5px] bg-secondary/80 flex items-center justify-center">
                  <img src={trackDetailsCreator.avatar} className="w-full h-full object-cover rounded-full" alt={trackDetailsCreator.name} />
                  {trackDetailsCreator.showVip ? (
                    <div className="absolute -bottom-1 -right-1 bg-yellow-500 text-[7px] font-black text-black px-1 py-0.5 rounded-md border border-background scale-105 shadow-sm">VIP</div>
                  ) : null}
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-foreground flex items-center gap-1">
                    {trackDetailsCreator.name}
                    {trackDetailsCreator.showVip ? (
                      <Sparkles className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                    ) : null}
                  </h4>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                    {trackDetailsCreator.subtitle}
                  </p>
                  <p className="text-[10px] text-muted-foreground/80 font-bold mt-0.5">{trackDetailsCreator.handle}</p>
                </div>
              </div>
              {trackDetailsCreator.followKey !== CURRENT_USER.handle.replace(/^@/, '') ? (
              <button 
                type="button"
                onClick={() => { toggleFollowUser(trackDetailsCreator.handle); }}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm ${
                  isFollowingUser(trackDetailsCreator.handle)
                  ? 'bg-secondary text-muted-foreground border border-border' 
                  : 'bg-primary text-primary-foreground hover:bg-primary/95 hover:scale-[1.02]'
                }`}
              >
                {isFollowingUser(trackDetailsCreator.handle) ? 'Following' : 'Follow'}
              </button>
              ) : null}
            </div>
            )}

            {/* Tabs Selector list */}
            <div className="flex border-b border-border bg-card/10">
              <button 
                onClick={() => setDetailsTab('recordings')}
                className={`flex-1 py-4 text-center font-extrabold text-sm transition relative ${detailsTab === 'recordings' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Recordings
                {detailsTab === 'recordings' && (
                  <div className="absolute bottom-0 inset-x-12 h-[3px] bg-primary rounded-full animate-in fade-in" />
                )}
              </button>
              <button 
                onClick={() => setDetailsTab('lyrics')}
                className={`flex-1 py-4 text-center font-extrabold text-sm transition relative ${detailsTab === 'lyrics' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Lyrics
                {detailsTab === 'lyrics' && (
                  <div className="absolute bottom-0 inset-x-12 h-[3px] bg-primary rounded-full animate-in fade-in" />
                )}
              </button>
            </div>

            {/* Tab Body Contents */}
            <div className="p-4 sm:p-6 min-h-[400px] bg-gradient-to-b from-muted/30 via-background to-muted/20">
              {detailsTab === 'lyrics' && (
                <div className="max-w-lg mx-auto py-4 px-6 bg-card/90 backdrop-blur-md rounded-3xl border border-border shadow-lg animate-in fade-in duration-300">
                  <div className="space-y-4">
                    {getLyricsForSong(playingTrack).map((line, idx) => {
                      const isHeader = line.startsWith('[') && line.endsWith(']');
                      const songLyrics = getLyricsForSong(playingTrack);
                      const studioLines = playingTrack.isUploaded || playingTrack.timedLyrics?.length
                        ? studioLyricsFromUpload(playingTrack)
                        : null;
                      const lyricProgressIdx = studioLines
                        ? activeLyricIndexForTime(studioLines, trackTime)
                        : Math.min(
                            songLyrics.length - 1,
                            Math.floor((trackTime / Math.max(trackMaxSeconds, 1)) * songLyrics.length),
                          );
                      const isActiveLine = idx === lyricProgressIdx;

                      if (isHeader) {
                        return (
                          <h4 
                            key={idx} 
                            className={`font-black text-[11px] sm:text-xs uppercase tracking-widest pt-4 leading-relaxed transition-all duration-300 ${isActiveLine ? 'text-primary' : 'text-muted-foreground/75'}`}
                          >
                            {line}
                          </h4>
                        );
                      }
                      if (line.trim() === '') {
                        return <div key={idx} className="h-4" />;
                      }
                      return (
                        <p 
                          key={idx} 
                          className={`text-sm sm:text-base leading-relaxed tracking-wide transition-all duration-300 ${
                            isActiveLine 
                            ? 'text-primary font-black scale-[1.03] origin-left drop-shadow-sm border-l-4 border-primary pl-3' 
                            : 'text-foreground/80 pl-0 hover:text-foreground font-medium'
                          }`}
                        >
                          {line}
                        </p>
                      );
                    })}
                  </div>
                </div>
              )}

              {detailsTab === 'recordings' && (
                <div className="space-y-3.5 max-w-xl mx-auto">
                  {playingTrack.isUploaded && (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-1">
                      <p className="text-xs text-muted-foreground font-medium">
                        Cover recordings of your uploaded backing track. Play a cover below, or listen to the original upload.
                      </p>
                      <button
                        type="button"
                        onClick={() => { void playUploadBackingTrack(); }}
                        className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary hover:bg-secondary/80 text-xs font-bold transition"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        Play original upload
                      </button>
                    </div>
                  )}
                  {(() => {
                    const trackRecordings =
                      coverRecordings.length > 0
                        ? coverRecordings
                        : playingTrack.isUploaded
                          ? []
                          : getDemoRecordingsForSong(playingTrack);
                    return (
                      <>
                  {trackRecordings.length === 0 && (
                    <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-border bg-card/60">
                      <Mic className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                      <p className="font-bold text-sm">No covers yet</p>
                      <p className="text-xs text-muted-foreground mt-1">Sing this song solo, as a duet, or in a group — your recording will appear here for others to listen.</p>
                    </div>
                  )}
                  {trackRecordings.map((recording: any) => {
                    const isPersistedCover = Boolean(recording.performers);
                    const isActive = activeCoverRecording?.id === recording.id;

                    if (isPersistedCover) {
                      const cover = recording as KaraokeCoverRecordingMeta;
                      return (
                        <div
                          key={cover.id}
                          className={`flex items-center p-3.5 bg-card border rounded-2xl transition shadow-sm group hover:shadow-md cursor-pointer animate-in fade-in duration-200 ${
                            isActive
                              ? 'border-primary ring-1 ring-primary/30'
                              : 'border-border hover:border-primary/45'
                          }`}
                          onClick={() => { toggleCoverRecordingPlayback(cover); }}
                        >
                          <div className="w-13 h-13 rounded-xl overflow-hidden shrink-0 border border-border/80 bg-muted relative shadow-md">
                            <img
                              src={cover.img || playingTrack.img || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=200&auto=format&fit=crop&q=60'}
                              className="w-full h-full object-cover"
                              alt="Cover thumbnail"
                            />
                            <div className="absolute inset-0 bg-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              {isCoverRecordingVideo(cover) ? (
                                <Video className="w-4 h-4 text-white fill-white" />
                              ) : (
                                <Play className="w-4 h-4 text-white fill-white" />
                              )}
                            </div>
                          </div>

                          <div className="ml-4 flex-1 min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <h4 className="font-extrabold text-sm text-foreground truncate leading-normal group-hover:text-primary transition-colors">
                                {cover.songTitle || playingTrack.title}
                              </h4>
                              <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[9px] font-black uppercase">
                                {performanceTypeLabel(cover.performanceType)}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate leading-relaxed mt-0.5 font-bold">
                              {cover.performers.map((p) => p.handle).join(' + ')}
                            </p>
                            {cover.caption ? (
                              <p className="text-[11px] text-muted-foreground/90 line-clamp-2 leading-snug mt-1">
                                {cover.caption}
                              </p>
                            ) : null}
                            <div className="flex items-center gap-3 text-[10px] text-muted-foreground/80 font-bold mt-1.5 font-mono">
                              {typeof cover.score === 'number' ? (
                                <span className="text-emerald-600 dark:text-emerald-400">Score {cover.score}</span>
                              ) : null}
                              <span className="flex items-center gap-0.5"><Play className="w-3 h-3 text-primary fill-primary" /> {formatRecordingCount(cover.plays)}</span>
                              <span className="flex items-center gap-0.5 text-rose-500"><Heart className="w-3 h-3 fill-rose-500" /> {cover.likes}</span>
                              <span className="flex items-center gap-0.5 text-amber-500"><Gift className="w-3 h-3" /> {cover.gifts}</span>
                              <span className="flex items-center gap-0.5 text-muted-foreground"><Clock className="w-3 h-3" /> {formatRecordingAge(cover.recordedAt)}</span>
                            </div>
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCoverRecordingPlayback(cover);
                            }}
                            className="p-2 hover:bg-secondary rounded-full text-muted-foreground hover:text-foreground transition shrink-0 ml-2"
                            title="Listen"
                          >
                            {isActive && isPlayingTrack ? (
                              <span className="font-bold text-xs">||</span>
                            ) : (
                              <Play className="w-5 h-5 fill-current" />
                            )}
                          </button>
                        </div>
                      );
                    }

                    return (
                    <div 
                      key={recording.id} 
                      className="flex items-center p-3.5 bg-card border border-border hover:border-primary/45 rounded-2xl transition shadow-sm group hover:shadow-md cursor-pointer animate-in fade-in duration-200"
                      onClick={() => {
                        setPlayingTrack({
                          ...playingTrack,
                          artist: recording.users.join(' & '),
                          plays: `${recording.plays} (Duet)`,
                          likes: `${recording.likes} Likes`
                        });
                        setTrackTime(0);
                        setIsPlayingTrack(true);
                        window.dispatchEvent(new CustomEvent('app-toast', { detail: `Now tuning in to collab cover by ${recording.users.map((u: string) => `@${u}`).join(' + ')}! 🎧` }));
                      }}
                    >
                      {/* Album cover layout */}
                      <div className="w-13 h-13 rounded-xl overflow-hidden shrink-0 border border-border/80 bg-muted relative shadow-md">
                        <img 
                          src="https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=200&auto=format&fit=crop&q=60" 
                          className="w-full h-full object-cover" 
                          alt="Album small" 
                        />
                        <div className="absolute inset-0 bg-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Play className="w-4 h-4 text-white fill-white" />
                        </div>
                      </div>
                      
                      {/* Content column */}
                      <div className="ml-4 flex-1 min-w-0">
                        <h4 className="font-extrabold text-sm text-foreground truncate leading-normal sm:max-w-[280px] group-hover:text-primary transition-colors">{recording.title}</h4>
                        <p className="text-xs text-muted-foreground truncate leading-relaxed mt-0.5 font-bold">
                          {recording.users.map((u: string) => `@${u}`).join(' + ')}
                        </p>
                        
                        {/* Meta row with Play, Heart, GiftBox, Clock */}
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground/80 font-bold mt-1.5 font-mono">
                          <span className="flex items-center gap-0.5"><Play className="w-3 h-3 text-primary fill-primary" /> {recording.plays}</span>
                          <span className="flex items-center gap-0.5 text-rose-500"><Heart className="w-3 h-3 fill-rose-500" /> {recording.likes}</span>
                          <span className="flex items-center gap-0.5 text-amber-500"><Gift className="w-3 h-3" /> {recording.gifts}</span>
                          <span className="flex items-center gap-0.5 text-muted-foreground"><Clock className="w-3 h-3" /> {recording.duration}</span>
                        </div>
                      </div>

                      {/* Triple dot options button */}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          window.dispatchEvent(new CustomEvent('app-toast', { detail: `Recording options opened! 🎙️` }));
                        }}
                        className="p-2 hover:bg-secondary rounded-full text-muted-foreground hover:text-foreground transition shrink-0 ml-2"
                        title="Options"
                      >
                        <MoreHorizontal className="w-5 h-5" />
                      </button>
                    </div>
                    );
                  })}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* Footer Action segment */}
          <div className="fixed bottom-0 left-0 right-0 p-4 border-t border-border bg-background/80 backdrop-blur-xl shrink-0 flex gap-3 shadow-lg z-50">
            <button 
              onClick={() => {
                const matchedSong = [...trendingSongs, ...librarySongs, ...uploadedSongs].find((s) => s.id === playingTrack.id);
                const studioSong = matchedSong ? { ...matchedSong, ...playingTrack } : playingTrack;
                closeTrackDetails();
                setSelectedSong(studioSong);
                window.dispatchEvent(new CustomEvent('app-toast', { detail: `Loaded session for "${playingTrack.title}" in Recording Studio! 🎙️` }));
              }}
              className="w-full py-4 bg-primary hover:bg-primary/95 text-primary-foreground font-black tracking-wide text-center rounded-2xl shadow-xl hover:shadow-2xl hover:scale-[1.005] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Mic className="w-5 h-5 text-primary-foreground fill-current" /> Sing
            </button>
          </div>
        </div>
      )}
      {isUploadModalOpen && (
        <SongUpload
          onClose={() => setIsUploadModalOpen(false)}
          onUpload={handleSongUploaded}
        />
      )}

      {isPlaylistModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-md rounded-3xl p-6 md:p-8 shadow-2xl relative border border-border animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-extrabold text-2xl flex items-center gap-2">
                <Music className="w-5 h-5 text-primary" /> Create Playlist
              </h3>
              <button
                onClick={() => {
                  setNewPlaylistName('');
                  setIsPlaylistModalOpen(false);
                }}
                className="p-2 hover:bg-secondary rounded-full bg-secondary/50 text-muted-foreground hover:text-foreground transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Playlist Name
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={newPlaylistName}
                    onChange={(e) => setNewPlaylistName(e.target.value.slice(0, 60))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreatePlaylist();
                    }}
                    placeholder="E.g. Late Night Chill Vibes 🌙"
                    autoFocus
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-primary focus:outline-none pl-10"
                  />
                  <Music className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-sans text-muted-foreground">
                    {newPlaylistName.length}/60
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => {
                  setNewPlaylistName('');
                  setIsPlaylistModalOpen(false);
                }}
                className="flex-1 py-3 border border-border rounded-xl font-bold text-sm text-foreground hover:bg-secondary transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePlaylist}
                className="flex-1 py-3 bg-primary text-primary-foreground font-bold rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-[1.01] flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> Create
              </button>
            </div>
          </div>
        </div>
      )}
      {karaokeFollowList ? (
        <FollowListModal
          profileUserId={karaokeFollowList.userId}
          mode={karaokeFollowList.mode}
          onClose={() => setKaraokeFollowList(null)}
        />
      ) : null}
      <ShareModal
        isOpen={Boolean(karaokeShareModal)}
        onClose={() => setKaraokeShareModal(null)}
        shareUrl={karaokeShareModal?.shareUrl ?? ''}
        itemTitle={karaokeShareModal?.itemTitle ?? 'Share'}
        shareText={karaokeShareModal?.shareText ?? 'Shared from K-Star'}
        kind={karaokeShareModal?.kind ?? 'karaoke-track'}
        notificationText={karaokeShareModal?.notificationText}
      />
      <AccountSwitcherModal
        open={showAccountSwitcher}
        accounts={userAccounts}
        activeUid={cloudSession?.user?.id ?? appUser.id}
        linking={accountLinking}
        cloudAuthEnabled={isCloudAuthConfigured()}
        onClose={() => setShowAccountSwitcher(false)}
        onSelectAccount={async (uid, password) => {
          try {
            const label =
              userAccounts.find((account) => account.uid === uid)?.displayName || 'account';
            window.dispatchEvent(
              new CustomEvent('app-toast', { detail: `Switching to ${label}…` }),
            );
            await selectAccount(uid, password);
            setShowAccountSwitcher(false);
            reconcileWalletAndKstarCoins(uid);
            void loadUserUploads();
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to switch account.';
            window.dispatchEvent(new CustomEvent('app-toast', { detail: message }));
          }
        }}
        onRemoveAccount={removeAccount}
        onSignInWithEmail={async (email, password) => {
          try {
            setAccountLinking(true);
            await ensureDeviceAccountsSynced();
            const result = await linkEmailAccount(email, password);
            if (result.ok) {
              window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Signed in!' }));
              setShowAccountSwitcher(false);
              if (db.currentUser?.id) reconcileWalletAndKstarCoins(db.currentUser.id);
              void loadUserUploads();
            }
            return result;
          } catch {
            return { ok: false, reason: 'Failed to sign in with email.' };
          } finally {
            setAccountLinking(false);
          }
        }}
        onLinkGoogle={async () => {
          setAccountLinking(true);
          try {
            const result = await linkGoogleAccount();
            if (!result.ok && result.reason) {
              window.dispatchEvent(new CustomEvent('app-toast', { detail: result.reason }));
            }
          } finally {
            setAccountLinking(false);
          }
        }}
      />
    </div>
  );
}

