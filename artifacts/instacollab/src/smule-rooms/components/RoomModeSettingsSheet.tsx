import React, { useEffect, useState } from 'react';
import { Check, Copy, Globe, Lock } from 'lucide-react';
import { RoomSettingsSheet } from './RoomSettingsEditors';
import { formatRoomModeLabel, ROOM_MODE_DESCRIPTIONS, ROOM_MODE_OPTIONS } from '../utils/managedRooms';
import {
  formatRoomPrivacyLabel,
  MAX_ROOM_KEY_LENGTH,
  MIN_ROOM_KEY_LENGTH,
  ROOM_PRIVACY_OPTIONS,
  validateRoomKeyInput,
  verifyRoomKey,
  type RoomPrivacy,
} from '../utils/roomPrivacy';

type RoomModeSettingsSheetProps = {
  open: boolean;
  onClose: () => void;
  roomMode: string;
  privacy: RoomPrivacy;
  roomKey: string;
  /** Owner in the live room — can set or change the private room key. */
  canManageRoomKey?: boolean;
  /** Whether the user may switch the room to private (owner in-room, or already private). */
  canSetPrivate?: boolean;
  onSave: (next: {
    roomMode: string;
    privacy: RoomPrivacy;
    roomKey: string;
    publicKeyConfirm?: string;
  }) => void;
};

export function RoomModeSettingsSheet({
  open,
  onClose,
  roomMode,
  privacy,
  roomKey,
  canManageRoomKey = false,
  canSetPrivate = canManageRoomKey || privacy === 'Private',
  onSave,
}: RoomModeSettingsSheetProps) {
  const [draftMode, setDraftMode] = useState(roomMode);
  const [draftPrivacy, setDraftPrivacy] = useState<RoomPrivacy>(privacy);
  const [draftRoomKey, setDraftRoomKey] = useState(roomKey);
  const [publicConfirmKey, setPublicConfirmKey] = useState('');
  const [keyCopied, setKeyCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setDraftMode(roomMode);
      setDraftPrivacy(privacy);
      setDraftRoomKey(roomKey.trim());
      setPublicConfirmKey('');
      setKeyCopied(false);
    }
  }, [open, roomMode, privacy, roomKey]);

  if (!open) return null;

  const switchingToPublic =
    privacy === 'Private' &&
    roomKey.trim().length > 0 &&
    draftPrivacy === 'Public';

  const publicKeyConfirmed =
    !switchingToPublic || verifyRoomKey(roomKey, publicConfirmKey);

  const privateKeyValidation =
    draftPrivacy === 'Private'
      ? validateRoomKeyInput(canManageRoomKey ? draftRoomKey : roomKey)
      : { valid: true };

  const hasChanges =
    draftMode !== roomMode ||
    draftPrivacy !== privacy ||
    (canManageRoomKey &&
      draftPrivacy === 'Private' &&
      draftRoomKey.trim() !== roomKey.trim());

  const canSave = hasChanges && privateKeyValidation.valid && publicKeyConfirmed;

  const handleCopyKey = async () => {
    if (!draftRoomKey.trim()) return;
    try {
      await navigator.clipboard.writeText(draftRoomKey.trim());
      setKeyCopied(true);
      window.setTimeout(() => setKeyCopied(false), 2000);
    } catch {
      setKeyCopied(false);
    }
  };

  return (
    <RoomSettingsSheet title="Room Mode" onClose={onClose}>
      <div className="space-y-5">
        <section className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Layout
          </p>
          <div className="space-y-2">
            {ROOM_MODE_OPTIONS.map((option) => {
              const selected = option === draftMode;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setDraftMode(option)}
                  className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                    selected
                      ? 'border-primary/40 bg-primary/10 text-foreground'
                      : 'border-border/60 bg-secondary/20 text-foreground hover:bg-secondary/40'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">
                      {formatRoomModeLabel(option)}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                      {ROOM_MODE_DESCRIPTIONS[option]}
                    </span>
                  </span>
                  {selected ? <Check size={18} className="shrink-0 text-primary" /> : null}
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Privacy
          </p>
          <div className="grid grid-cols-2 gap-2">
            {ROOM_PRIVACY_OPTIONS.map((option) => {
              const selected = option === draftPrivacy;
              const Icon = option === 'Public' ? Globe : Lock;
              const privateLocked = option === 'Private' && !canSetPrivate;
              return (
                <button
                  key={option}
                  type="button"
                  disabled={privateLocked}
                  onClick={() => {
                    if (privateLocked) return;
                    setDraftPrivacy(option);
                    if (option === 'Public') {
                      setPublicConfirmKey('');
                    } else if (!draftRoomKey.trim() && roomKey.trim()) {
                      setDraftRoomKey(roomKey.trim());
                    }
                  }}
                  className={`flex flex-col items-start rounded-2xl border px-3 py-3 text-left transition ${
                    privateLocked
                      ? 'cursor-not-allowed border-border/40 bg-secondary/10 text-muted-foreground opacity-50'
                      : selected
                      ? option === 'Public'
                        ? 'border-primary/40 bg-primary/10 text-foreground'
                        : 'border-amber-500/40 bg-amber-500/10 text-foreground'
                      : 'border-border/60 bg-secondary/20 text-foreground hover:bg-secondary/40'
                  }`}
                >
                  <Icon
                    size={16}
                    className={
                      selected
                        ? option === 'Public'
                          ? 'text-primary'
                          : 'text-amber-500'
                        : 'text-muted-foreground'
                    }
                  />
                  <span className="mt-2 text-sm font-semibold">
                    {formatRoomPrivacyLabel(option)}
                  </span>
                  <span className="mt-0.5 text-[10px] text-muted-foreground">
                    {option === 'Public'
                      ? 'Everyone can join'
                      : privateLocked
                        ? 'Owner must set key in room'
                        : 'Room key required'}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {draftPrivacy === 'Private' ? (
          <section className="space-y-2 rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-500/90">
              Room Key
            </p>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {canManageRoomKey
                ? 'Only you as owner can change this key while you are in the room.'
                : 'Only the room owner can change the key from inside the live room.'}
            </p>
            {canManageRoomKey ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={draftRoomKey}
                  onChange={(event) => setDraftRoomKey(event.target.value)}
                  placeholder={`${MIN_ROOM_KEY_LENGTH}-${MAX_ROOM_KEY_LENGTH} characters`}
                  maxLength={MAX_ROOM_KEY_LENGTH}
                  className="flex-1 rounded-2xl border border-border/60 bg-background/70 px-4 py-3 text-sm font-semibold text-foreground outline-none transition focus:border-amber-400/50"
                />
                <button
                  type="button"
                  onClick={handleCopyKey}
                  disabled={!draftRoomKey.trim()}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border/60 bg-secondary/30 text-foreground transition hover:bg-secondary/50 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={keyCopied ? 'Room key copied' : 'Copy room key'}
                  title={keyCopied ? 'Copied' : 'Copy room key'}
                >
                  {keyCopied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
            ) : (
              <p className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3 text-center text-sm text-muted-foreground">
                Ask the host for the room key.
              </p>
            )}
            {!privateKeyValidation.valid && canManageRoomKey ? (
              <p className="text-xs font-medium text-red-400">{privateKeyValidation.message}</p>
            ) : null}
          </section>
        ) : null}

        {switchingToPublic ? (
          <section className="space-y-2 rounded-2xl border border-primary/25 bg-primary/5 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-primary">
              Confirm Room Key
            </p>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Enter the current private room key to switch this room to public.
            </p>
            <input
              type="text"
              value={publicConfirmKey}
              onChange={(event) => setPublicConfirmKey(event.target.value)}
              placeholder="Enter current room key"
              maxLength={MAX_ROOM_KEY_LENGTH}
              className="w-full rounded-2xl border border-border/60 bg-background/70 px-4 py-3 text-sm font-semibold text-foreground outline-none transition focus:border-primary/50"
            />
            {publicConfirmKey.trim() && !publicKeyConfirmed ? (
              <p className="text-xs font-medium text-red-400">
                Incorrect room key. You cannot make this room public without confirming the key.
              </p>
            ) : null}
          </section>
        ) : null}
      </div>

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-2xl border border-border py-3 text-sm font-semibold text-foreground transition hover:bg-secondary/40"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!canSave}
          onClick={() => {
            if (switchingToPublic && !verifyRoomKey(roomKey, publicConfirmKey)) {
              return;
            }
            const savedRoomKey =
              draftPrivacy === 'Private'
                ? canManageRoomKey
                  ? draftRoomKey.trim()
                  : roomKey.trim()
                : '';
            onSave({
              roomMode: draftMode,
              privacy: draftPrivacy,
              roomKey: savedRoomKey,
              publicKeyConfirm: switchingToPublic ? publicConfirmKey.trim() : undefined,
            });
            onClose();
          }}
          className="flex-1 rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </RoomSettingsSheet>
  );
}
