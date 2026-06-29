
export type RoomMode = 'Chat' | 'Radio' | 'Karaoke' | 'Multi-Guest' | 'Party';

export type RoomSettings = {
    coverPhoto: string;
    background: string;
    bulletin: string;
    greetings: string;
    roomMode: RoomMode | string;
    roomName: string;
    roomId: string;
    owner: string;
    ownerUserId?: string;
    coOwner: string;
    coOwnerUserId?: string;
    admin: string;
    adminUserIds?: string[];
    host: string;
    hostUserId?: string;
    leadSinger: string;
    leadSingerUserIds?: string[];
    roomPriority: string;
    whoCanJoin: string;
    whoCanBeSeated: string;
    manageRecommendations: string;
    singingManagement: string;
    songList: string;
    blockList: string;
    privacy?: string;
    /** Six-digit key required to enter private rooms. */
    roomKey?: string;
    /** Hosted URL, legacy data URL, or upload marker for Watch Together / Radio playback. */
    watchTogetherMediaUrl?: string;
    /** Display name when watchTogetherMediaUrl is an IndexedDB upload marker. */
    watchTogetherMediaFileName?: string;
};

const ROOM_SETTINGS_PREFIX = 'roomSettings:';

function defaultSettings(): RoomSettings {
    return {
        coverPhoto: 'Default',
        background: 'Default',
        bulletin: 'Edit',
        greetings: 'Edit',
        roomMode: 'Chat',
        roomName: 'BRASIL',
        roomId: '1181033',
        owner: 'Owner',
        coOwner: 'Edit',
        admin: 'Admin 1, Admin 2',
        host: 'Edit',
        leadSinger: 'Singer 1, Singer 2',
        roomPriority: 'YES',
        whoCanJoin: 'Room Owner\'s Following',
        whoCanBeSeated: 'Anyone',
        manageRecommendations: 'Edit',
        singingManagement: 'Enabled',
        songList: 'Edit',
        blockList: 'Edit',
    };
}

function readStoredSettings(key: string): RoomSettings | null {
    try {
        const saved = localStorage.getItem(key);
        if (!saved) return null;
        return { ...defaultSettings(), ...JSON.parse(saved) };
    } catch {
        return null;
    }
}

export const getRoomSettings = (roomId?: string): RoomSettings => {
    if (roomId) {
        const perRoom = readStoredSettings(`${ROOM_SETTINGS_PREFIX}${roomId}`);
        if (perRoom) return perRoom;

        const global = readStoredSettings('roomSettings');
        if (global && global.roomId === roomId) {
            return global;
        }

        return {
            ...defaultSettings(),
            roomId,
            roomName: `Room ${roomId}`,
        };
    }

    const activeRoomId = localStorage.getItem('activeRoomId');
    if (activeRoomId) {
        const active = readStoredSettings(`${ROOM_SETTINGS_PREFIX}${activeRoomId}`);
        if (active) return active;
    }

    return readStoredSettings('roomSettings') ?? defaultSettings();
};

export const saveRoomSettings = (roomId: string, patch: Partial<RoomSettings>) => {
    const merged: RoomSettings = {
        ...getRoomSettings(roomId),
        ...patch,
        roomId,
    };
    localStorage.setItem(`${ROOM_SETTINGS_PREFIX}${roomId}`, JSON.stringify(merged));

    const activeRoomId = localStorage.getItem('activeRoomId');
    if (activeRoomId === roomId || !activeRoomId) {
        localStorage.setItem('roomSettings', JSON.stringify(merged));
        localStorage.setItem('activeRoomId', roomId);
    }

    window.dispatchEvent(new CustomEvent('room-settings-updated', { detail: { roomId } }));
};

export const updateRoomSetting = (key: string, value: string, roomId?: string) => {
    const targetRoomId = roomId ?? getRoomSettings().roomId;
    saveRoomSettings(targetRoomId, { [key]: value } as Partial<RoomSettings>);
};

/** Known demo rooms — filled when settings still use Smule placeholder values. */
const DEMO_ROOM_SETTINGS: Record<string, Partial<RoomSettings>> = {
    '1167298': {
        roomName: '90S R&B THROWBACKS',
        roomMode: 'Chat',
        owner: 'SoulSister',
        coOwner: '',
        admin: 'Admin 1, Admin 2',
        leadSinger: 'Singer 1, Singer 2',
        host: 'SoulSister',
        bulletin: 'Welcome to 90s R&B throwbacks — grab a seat and sing!',
        greetings: 'Thanks for joining! Be respectful and have fun 🎤',
        background: 'Default',
        coverPhoto: 'Default',
        whoCanJoin: 'Anyone',
        whoCanBeSeated: 'Anyone',
        roomPriority: 'YES',
        manageRecommendations: 'Auto recommendations on',
        singingManagement: 'Enabled',
        songList: '90s R&B throwback playlist',
        blockList: 'No blocked users',
    },
    '1181033': {
        roomName: 'BRASIL',
        roomMode: 'Chat',
        owner: 'VIP_Sanny',
        coOwner: '',
        admin: 'Admin 1, Admin 2',
        leadSinger: 'Singer 1, Singer 2',
        host: 'VIP_Sanny',
        bulletin: 'Bem-vindo! Grab a seat and join the party.',
        greetings: 'Olá! Thanks for joining our room 🎶',
        background: 'Default',
        coverPhoto: 'Default',
        whoCanJoin: "Room Owner's Following",
        whoCanBeSeated: 'Anyone',
        roomPriority: 'YES',
        manageRecommendations: 'Auto recommendations on',
        singingManagement: 'Enabled',
        songList: 'Featured playlist',
        blockList: 'No blocked users',
    },
};

const PLACEHOLDER_TEXT_FIELDS: (keyof RoomSettings)[] = [
    'bulletin',
    'greetings',
    'coOwner',
    'host',
    'manageRecommendations',
    'songList',
    'blockList',
];

function isPlaceholderText(value: string | undefined | null): boolean {
    const trimmed = value?.trim() ?? '';
    return !trimmed || trimmed === 'Edit';
}

export function needsRoomSettingsSeed(settings: RoomSettings): boolean {
    if (!settings.roomName?.trim() || settings.roomName.startsWith('Room ')) {
        return true;
    }
    if (isPlaceholderText(settings.owner)) {
        return true;
    }
    return PLACEHOLDER_TEXT_FIELDS.some((key) =>
        isPlaceholderText(String(settings[key] ?? '')),
    );
}

/** Merge demo / managed metadata into per-room settings when placeholders remain. */
export function ensureRoomSettingsSeeded(
    roomId: string,
    overrides?: Partial<RoomSettings>,
): RoomSettings {
    const current = getRoomSettings(roomId);
    const demo = DEMO_ROOM_SETTINGS[roomId];
    const patch: Partial<RoomSettings> = { roomId };

    const applyIfPlaceholder = <K extends keyof RoomSettings>(key: K, value: RoomSettings[K]) => {
        const existing = current[key];
        if (key === 'roomName') {
            const name = typeof existing === 'string' ? existing : '';
            const nextName = typeof value === 'string' ? value : String(value ?? '');
            if (!name.trim() || name.startsWith('Room ')) {
                patch.roomName = nextName;
            }
            return;
        }
        if (key === 'owner') {
            if (isPlaceholderText(String(existing ?? ''))) {
                patch[key] = value;
            }
            return;
        }
        if (PLACEHOLDER_TEXT_FIELDS.includes(key)) {
            if (isPlaceholderText(String(existing ?? ''))) {
                patch[key] = value;
            }
        }
    };

    if (demo) {
        for (const [key, value] of Object.entries(demo) as [keyof RoomSettings, RoomSettings[keyof RoomSettings]][]) {
            applyIfPlaceholder(key, value);
        }
    }

    if (overrides) {
        for (const [key, value] of Object.entries(overrides) as [keyof RoomSettings, RoomSettings[keyof RoomSettings]][]) {
            if (value !== undefined) {
                (patch as Record<keyof RoomSettings, RoomSettings[keyof RoomSettings]>)[key] = value;
            }
        }
    }

    const hasChanges = Object.keys(patch).some(
        (key) => key !== 'roomId' && patch[key as keyof RoomSettings] !== current[key as keyof RoomSettings],
    );

    if (hasChanges) {
        saveRoomSettings(roomId, patch);
        return getRoomSettings(roomId);
    }

    return current;
}
