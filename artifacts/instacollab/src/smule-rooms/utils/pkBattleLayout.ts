import { PARTY_GUEST_SEAT_KEYS, type PartySeatMap, type RoomGuest, type RoomSeatKey } from './roomSeats';
import type { PKFighter, PKMode } from './liveRoomTypes';

function normalizeRoomMode(roomMode: string | undefined): string {
  return String(roomMode || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-');
}

export function isCommercePkRoomMode(roomMode: string | undefined): boolean {
  const mode = normalizeRoomMode(roomMode);
  return mode === 'commerce-live' || mode === 'commercelive' || mode === 'commerce' || mode === 'shop-live' || mode === 'shoplive' || mode === 'shop';
}

export function isSoloPkRoomMode(roomMode: string | undefined): boolean {
  const mode = normalizeRoomMode(roomMode);
  return mode === 'solo-live' || mode === 'sololive' || mode === 'solo-video' || mode === 'solo-audio' || mode === 'solo';
}

/** PK battles are only enabled on Solo Live and Shop (Commerce) Live — never Party, Multi-Guest, or karaoke rooms. */
export function isPkEligibleRoomMode(roomMode: string | undefined): boolean {
  return isSoloPkRoomMode(roomMode) || isCommercePkRoomMode(roomMode);
}

/** Solo matches Solo. Shop matches Shop. Other modes never match. */
export function canPkMatchRoomModes(selfRoomMode: string | undefined, opponentRoomMode: string | undefined): boolean {
  if (!isPkEligibleRoomMode(selfRoomMode) || !isPkEligibleRoomMode(opponentRoomMode)) return false;
  return isCommercePkRoomMode(selfRoomMode) === isCommercePkRoomMode(opponentRoomMode);
}

const PK_SEAT_ORDER: RoomSeatKey[] = ['host', 'coowner', 'admin', ...PARTY_GUEST_SEAT_KEYS];

function guestToFighter(guest: RoomGuest, fallbackUserId: string): PKFighter {
  return {
    userId: guest.userId ?? fallbackUserId,
    name: guest.name,
    score: 0,
    avatarUrl: guest.avatar,
  };
}

function collectSeatedFighters(seats: PartySeatMap): PKFighter[] {
  const fighters: PKFighter[] = [];
  const seen = new Set<string>();

  for (const key of PK_SEAT_ORDER) {
    const guest = seats[key];
    if (!guest) continue;
    const userId = guest.userId ?? key;
    if (seen.has(userId)) continue;
    seen.add(userId);
    fighters.push(guestToFighter(guest, userId));
  }

  return fighters;
}

export function buildPkTeamsFromSeats(
  seats: PartySeatMap,
  opponentUserId: string,
  mode: PKMode,
  teamSize: 2 | 3 | 4 | 6 = 4,
): { teamA: PKFighter[]; teamB: PKFighter[] } {
  const seated = collectSeatedFighters(seats);
  const opponent = seated.find((fighter) => fighter.userId === opponentUserId);
  const perSide = mode === 'single' ? 1 : teamSize;

  if (!opponent) {
    return { teamA: seated.slice(0, perSide), teamB: [] };
  }

  if (mode === 'single') {
    const lead = seated.find((fighter) => fighter.userId !== opponentUserId) ?? seated[0];
    return {
      teamA: lead ? [lead] : [],
      teamB: [opponent],
    };
  }

  const teamB: PKFighter[] = [opponent];
  for (const fighter of seated) {
    if (teamB.length >= perSide) break;
    if (fighter.userId === opponentUserId) continue;
    if (teamB.some((member) => member.userId === fighter.userId)) continue;
    teamB.push(fighter);
  }

  const teamBIds = new Set(teamB.map((fighter) => fighter.userId));
  const teamA = seated.filter((fighter) => !teamBIds.has(fighter.userId)).slice(0, perSide);

  return { teamA, teamB };
}

export function sumPkTeamScore(fighters: PKFighter[]): number {
  return fighters.reduce((total, fighter) => total + fighter.score, 0);
}

/** Auto grid class for 1–6 fighters on one PK side. */
export function getPkTeamGridClass(count: number): string {
  const clamped = Math.max(1, Math.min(6, count));
  return `pk-team-grid--${clamped}`;
}

export function pkWinnerSide(state: {
  teamAScore: number;
  teamBScore: number;
}): 'a' | 'b' {
  return state.teamAScore >= state.teamBScore ? 'a' : 'b';
}

export type PKAudioSlotId =
  | 'a_boss'
  | 'a_guest1'
  | 'a_guest2'
  | 'b_boss'
  | 'b_guest1'
  | 'b_guest2';

export type PKAudioSeatId = PKAudioSlotId;

export type PKAudioSideSeats = {
  boss: PKFighter | null;
  guests: [PKFighter | null, PKFighter | null];
};

export type PKAudioSeats = {
  sideA: PKAudioSideSeats;
  sideB: PKAudioSideSeats;
};

export type PKSeatLayout = 'live-compact' | 'split-rooms' | 'audio-only' | 'video-only';

export const EMPTY_PK_AUDIO_SEATS: PKAudioSeats = {
  sideA: { boss: null, guests: [null, null] },
  sideB: { boss: null, guests: [null, null] },
};

export function padPkTeamFighters(
  fighters: PKFighter[],
  label: string,
  teamSize: 2 | 3 | 4 | 6 = 4,
): PKFighter[] {
  const next = [...fighters];
  while (next.length < teamSize) {
    next.push({
      userId: `empty-${label}-${next.length}`,
      name: label,
      score: 0,
    });
  }
  return next.slice(0, teamSize);
}

export function isPkAudioBossSlot(slotId: PKAudioSlotId): boolean {
  return slotId.endsWith('_boss');
}

export function formatPkRoomModeLabel(roomMode: string): string {
  const trimmed = roomMode?.trim() ?? '';
  if (!trimmed) return 'Party';
  return trimmed.replace(/-/g, ' ');
}

export function buildSoloLivePkTeams(
  seats: PartySeatMap,
  host: PKFighter,
  opponent: PKFighter,
  mode: PKMode,
  teamSize: 2 | 3 | 4 | 6 = 4,
): { teamA: PKFighter[]; teamB: PKFighter[] } {
  if (mode === 'single') {
    return { teamA: [host], teamB: [opponent] };
  }

  const fromSeats = buildPkTeamsFromSeats(seats, opponent.userId, 'team', teamSize);
  const teamA = fromSeats.teamA.some((fighter) => fighter.userId === host.userId)
    ? fromSeats.teamA
    : [host, ...fromSeats.teamA.filter((fighter) => fighter.userId !== host.userId)];
  const teamB = fromSeats.teamB.some((fighter) => fighter.userId === opponent.userId)
    ? fromSeats.teamB
    : [opponent, ...fromSeats.teamB.filter((fighter) => fighter.userId !== opponent.userId)];

  return {
    teamA: padPkTeamFighters(teamA, 'Host', teamSize),
    teamB: padPkTeamFighters(teamB, 'Rival', teamSize),
  };
}
