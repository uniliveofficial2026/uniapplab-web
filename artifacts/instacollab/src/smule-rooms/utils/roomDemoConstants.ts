/** Stable demo owner ids when no app user matches the seeded display name. */
export const DEMO_ROOM_OWNER_USER_IDS: Record<string, string> = {
  '1167298': 'room-owner-1167298',
  '1181033': 'room-owner-1181033',
};

export const DEMO_ROOM_IDS = Object.keys(DEMO_ROOM_OWNER_USER_IDS);

/** Demo personas keyed by synthetic owner user id — stable name + avatar for host seats. */
export const DEMO_ROOM_PERSONAS: Record<string, { displayName: string; avatarUrl: string }> = {
  'room-owner-1167298': {
    displayName: 'SoulSister',
    avatarUrl:
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&h=120&fit=crop&crop=faces',
  },
  'room-owner-1181033': {
    displayName: 'VIP_Sanny',
    avatarUrl:
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&h=120&fit=crop&crop=faces',
  },
};

/** Demo room admins by slot index when settings still use placeholder labels like "Admin 1". */
export const DEMO_ROOM_ADMIN_USER_IDS: Record<string, string[]> = {
  '1167298': ['u4', 'u3'],
  '1181033': ['u6', 'u8'],
};

/** Demo room lead singers by slot index for placeholder labels like "Singer 1". */
export const DEMO_ROOM_SINGER_USER_IDS: Record<string, string[]> = {
  '1167298': ['u6', 'u10'],
  '1181033': ['u5', 'u7'],
};
