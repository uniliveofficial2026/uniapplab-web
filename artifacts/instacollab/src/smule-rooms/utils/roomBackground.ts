import {
  getGuestSeatKeysForSettingsMode,
  type RoomSeatKey,
} from './roomSeats';

export type RoomBackgroundMode = {
  type: 'css' | 'image' | 'video';
  value: string;
};

export type RoomBackgroundPreset = RoomBackgroundMode & {
  label: string;
  storageKey: string;
};

export const ROOM_BACKGROUND_PRESETS: RoomBackgroundPreset[] = [
  { label: 'Default theme', storageKey: 'Default', type: 'css', value: 'bg-radial-gradient' },
  { label: 'Deep Space', storageKey: 'Deep Space', type: 'css', value: 'bg-slate-900' },
  { label: 'Neon Night', storageKey: 'Neon Night', type: 'css', value: 'bg-indigo-950' },
  { label: 'Golden Hour', storageKey: 'Golden Hour', type: 'css', value: 'bg-orange-950' },
];

export function parseRoomBackground(stored: string | undefined | null): RoomBackgroundMode {
  const trimmed = stored?.trim() ?? '';
  if (!trimmed || trimmed === 'Edit' || trimmed === 'Default') {
    return { type: 'css', value: 'bg-radial-gradient' };
  }

  const preset = ROOM_BACKGROUND_PRESETS.find((entry) => entry.storageKey === trimmed);
  if (preset) {
    return { type: preset.type, value: preset.value };
  }

  if (trimmed.startsWith('css:')) {
    return { type: 'css', value: trimmed.slice(4) };
  }
  if (trimmed.startsWith('image:')) {
    return { type: 'image', value: trimmed.slice(6) };
  }
  if (trimmed.startsWith('video:')) {
    return { type: 'video', value: trimmed.slice(6) };
  }

  return { type: 'css', value: 'bg-radial-gradient' };
}

export function serializeRoomBackground(mode: RoomBackgroundMode): string {
  const preset = ROOM_BACKGROUND_PRESETS.find(
    (entry) => entry.type === mode.type && entry.value === mode.value,
  );
  if (preset) return preset.storageKey;
  return `${mode.type}:${mode.value}`;
}

export function formatRoomBackgroundLabel(stored: string | undefined | null): string {
  const trimmed = stored?.trim() ?? '';
  if (!trimmed || trimmed === 'Edit') return 'Default theme';

  const preset = ROOM_BACKGROUND_PRESETS.find((entry) => entry.storageKey === trimmed);
  if (preset) return preset.label;

  const mode = parseRoomBackground(trimmed);
  if (mode.type === 'image') return 'Custom image';
  if (mode.type === 'video') return 'Custom video';
  return 'Default theme';
}

export type RoomLayoutMode = 'Party' | 'Chorus' | 'WatchTogether';

export type RoomLayoutConfig = {
  layout: RoomLayoutMode;
  /** Party-chat layout density — false for Party Chat, true for staged party modes. */
  isFullPartyMode: boolean;
  guestSeatKeys: RoomSeatKey[];
};

export function mapSettingsModeToRoomMode(
  roomMode: string | undefined,
): RoomLayoutMode {
  if (roomMode === 'Karaoke') return 'Chorus';
  if (roomMode === 'Radio') return 'WatchTogether';
  return 'Party';
}

export function resolveRoomLayoutFromSettings(
  settingsMode: string | undefined,
): RoomLayoutConfig {
  const layout = mapSettingsModeToRoomMode(settingsMode);
  const isFullPartyMode =
    settingsMode === 'Party' ||
    settingsMode === 'Multi-Guest' ||
    settingsMode === 'Karaoke' ||
    settingsMode === 'Radio';

  return {
    layout,
    isFullPartyMode,
    guestSeatKeys: getGuestSeatKeysForSettingsMode(settingsMode),
  };
}

export function mapRoomModeToSettingsMode(
  roomMode: RoomLayoutMode,
): string {
  if (roomMode === 'Chorus') return 'Karaoke';
  if (roomMode === 'WatchTogether') return 'Radio';
  return 'Chat';
}
