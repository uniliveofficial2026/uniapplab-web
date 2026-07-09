import { PARTY_GUEST_SEAT_KEYS, type PartySeatMap, type RoomGuest, type RoomSeatKey } from './roomSeats';
import type { PKFighter, PKMode } from './liveRoomTypes';

/** PK battles are only enabled on solo live and shop (commerce) live streams. */
export function isPkEligibleRoomMode(roomMode: string | undefined): boolean {
  const mode = String(roomMode || '').trim();
  return mode === 'Solo-Live' || mode === 'Commerce-Live';
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
): { teamA: PKFighter[]; teamB: PKFighter[] } {
  const seated = collectSeatedFighters(seats);
  const opponent = seated.find((fighter) => fighter.userId === opponentUserId);

  if (!opponent) {
    return { teamA: seated.slice(0, 1), teamB: [] };
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
    if (teamB.length >= 4) break;
    if (fighter.userId === opponentUserId) continue;
    if (teamB.some((member) => member.userId === fighter.userId)) continue;
    teamB.push(fighter);
  }

  const teamBIds = new Set(teamB.map((fighter) => fighter.userId));
  const teamA = seated.filter((fighter) => !teamBIds.has(fighter.userId)).slice(0, 4);

  return { teamA, teamB };
}

export function sumPkTeamScore(fighters: PKFighter[]): number {
  return fighters.reduce((total, fighter) => total + fighter.score, 0);
}

/** Auto grid class for 1–4 fighters on one PK side. */
export function getPkTeamGridClass(count: number): string {
  const clamped = Math.max(1, Math.min(4, count));
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

export function padPkTeamFighters(fighters: PKFighter[], label: string): PKFighter[] {
  const next = [...fighters];
  while (next.length < 4) {
    next.push({
      userId: `empty-${label}-${next.length}`,
      name: label,
      score: 0,
    });
  }
  return next.slice(0, 4);
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
): { teamA: PKFighter[]; teamB: PKFighter[] } {
  if (mode === 'single') {
    return { teamA: [host], teamB: [opponent] };
  }

  const fromSeats = buildPkTeamsFromSeats(seats, opponent.userId, 'team');
  const teamA = fromSeats.teamA.some((fighter) => fighter.userId === host.userId)
    ? fromSeats.teamA
    : [host, ...fromSeats.teamA.filter((fighter) => fighter.userId !== host.userId)];
  const teamB = fromSeats.teamB.some((fighter) => fighter.userId === opponent.userId)
    ? fromSeats.teamB
    : [opponent, ...fromSeats.teamB.filter((fighter) => fighter.userId !== opponent.userId)];

  return {
    teamA: padPkTeamFighters(teamA, 'Host').slice(0, 4),
    teamB: padPkTeamFighters(teamB, 'Rival').slice(0, 4),
  };
}
