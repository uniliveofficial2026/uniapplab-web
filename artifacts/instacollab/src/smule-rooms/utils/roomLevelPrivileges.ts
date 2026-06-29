import { LEVEL_START_TOTAL_EXP } from './roomExp';

export type RoomLevelPrivilege = {
  level: number;
  title: string;
  perks: string[];
  expRequired: number;
};

const PERK_TABLE: Record<number, string[]> = {
  1: ['Basic room badge', 'Up to 8 guest seats', 'Daily room EXP'],
  2: ['Custom room cover', 'Room announcement board', 'Admin roles'],
  3: ['Co-owner slot', 'Elite priority seating', 'Extended gift EXP tracking'],
  4: ['Lead singer roles', 'Room level badge on feed', 'Higher daily EXP targets'],
  5: ['Featured room eligibility', 'Advanced moderation tools', 'Custom backgrounds'],
  6: ['Premium room frame', 'Expanded block list', 'Song list curation'],
  7: ['Top-tier room spotlight', 'Maximum seat capacity', 'Full admin suite'],
};

export function getRoomLevelPrivileges(): RoomLevelPrivilege[] {
  return LEVEL_START_TOTAL_EXP.map((expRequired, index) => {
    const level = index + 1;
    return {
      level,
      expRequired,
      title: `Level ${level}`,
      perks: PERK_TABLE[level] ?? ['Room perks unlock as you level up'],
    };
  });
}

export function getPrivilegesForLevel(level: number): RoomLevelPrivilege | undefined {
  return getRoomLevelPrivileges().find((entry) => entry.level === level);
}
