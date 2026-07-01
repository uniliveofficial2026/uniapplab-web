import React, { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import {
  ROOM_BACKGROUND_PRESETS,
  formatRoomBackgroundLabel,
  parseRoomBackground,
  serializeRoomBackground,
  type RoomBackgroundMode,
} from '../utils/roomBackground';
import { nativeVideoControlGuardProps } from '../../lib/nativeVideoControls';

export function RoomSettingsSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        aria-label={`Close ${title}`}
        onClick={onClose}
      />
      <div className="relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-[24px] border border-border bg-card/95 shadow-2xl backdrop-blur-2xl sm:max-w-md sm:rounded-[24px]">
        <div className="flex items-center justify-between border-b border-border/60 p-4">
          <h3 className="text-lg font-bold text-foreground">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground transition hover:bg-secondary/60"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto p-4 scrollbar-hide">{children}</div>
      </div>
    </div>
  );
}

export function RoomSettingsTextEditor({
  open,
  title,
  value,
  placeholder,
  multiline = false,
  onClose,
  onSave,
}: {
  open: boolean;
  title: string;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  onClose: () => void;
  onSave: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  if (!open) return null;

  return (
    <RoomSettingsSheet title={title} onClose={onClose}>
      {multiline ? (
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={placeholder}
          rows={5}
          className="w-full resize-none rounded-2xl border border-border bg-background/60 px-4 py-3 text-sm text-foreground outline-none backdrop-blur-md focus:border-primary"
        />
      ) : (
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={placeholder}
          className="w-full rounded-2xl border border-border bg-background/60 px-4 py-3 text-sm text-foreground outline-none backdrop-blur-md focus:border-primary"
        />
      )}
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
          onClick={() => onSave(draft.trim())}
          className="flex-1 rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          Save
        </button>
      </div>
    </RoomSettingsSheet>
  );
}

export function RoomSettingsOptionPicker({
  open,
  title,
  value,
  options,
  formatOptionLabel,
  onClose,
  onSelect,
}: {
  open: boolean;
  title: string;
  value: string;
  options: string[];
  formatOptionLabel?: (option: string) => string;
  onClose: () => void;
  onSelect: (next: string) => void;
}) {
  if (!open) return null;

  return (
    <RoomSettingsSheet title={title} onClose={onClose}>
      <div className="space-y-2">
        {options.map((option) => {
          const selected = option === value;
          const label = formatOptionLabel?.(option) ?? option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => {
                onSelect(option);
                onClose();
              }}
              className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition ${
                selected
                  ? 'border-primary/40 bg-primary/10 text-foreground'
                  : 'border-border/60 bg-secondary/20 text-foreground hover:bg-secondary/40'
              }`}
            >
              <span>{label}</span>
              {selected ? <Check size={18} className="text-primary" /> : null}
            </button>
          );
        })}
      </div>
    </RoomSettingsSheet>
  );
}

export function RoomSettingsCoverEditor({
  open,
  coverUrl,
  onClose,
  onSaveUrl,
  onSaveFile,
}: {
  open: boolean;
  coverUrl: string;
  onClose: () => void;
  onSaveUrl: (url: string) => void;
  onSaveFile: (dataUrl: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [urlDraft, setUrlDraft] = useState('');

  useEffect(() => {
    if (open) {
      setUrlDraft(coverUrl.startsWith('http') || coverUrl.startsWith('data:') ? coverUrl : '');
    }
  }, [open, coverUrl]);

  if (!open) return null;

  return (
    <RoomSettingsSheet title="Cover Photo" onClose={onClose}>
      <div className="flex flex-col items-center gap-4">
        <img
          src={coverUrl}
          alt="Room cover preview"
          className="h-28 w-28 rounded-[24px] border-2 border-border object-cover shadow-lg"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-full border border-border bg-background/60 px-4 py-2 text-sm font-semibold text-foreground backdrop-blur-md transition hover:bg-secondary/40"
        >
          Upload photo
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onloadend = () => {
              const result = reader.result;
              if (typeof result === 'string') {
                onSaveFile(result);
                onClose();
              }
            };
            reader.readAsDataURL(file);
          }}
        />
        <div className="w-full">
          <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Image URL
          </label>
          <input
            value={urlDraft}
            onChange={(event) => setUrlDraft(event.target.value)}
            placeholder="https://..."
            className="w-full rounded-2xl border border-border bg-background/60 px-4 py-3 text-sm text-foreground outline-none backdrop-blur-md focus:border-primary"
          />
        </div>
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
          onClick={() => {
            if (urlDraft.trim()) {
              onSaveUrl(urlDraft.trim());
              onClose();
            }
          }}
          className="flex-1 rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          Save URL
        </button>
      </div>
    </RoomSettingsSheet>
  );
}

export function RoomSettingsBackgroundEditor({
  open,
  storedValue,
  onClose,
  onSave,
}: {
  open: boolean;
  storedValue: string;
  onClose: () => void;
  onSave: (serialized: string) => void;
}) {
  const [pending, setPending] = useState<RoomBackgroundMode>(() =>
    parseRoomBackground(storedValue),
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setPending(parseRoomBackground(storedValue));
  }, [open, storedValue]);

  if (!open) return null;

  const active = pending;

  return (
    <RoomSettingsSheet title="Background" onClose={onClose}>
      <div className="relative mb-4 h-32 overflow-hidden rounded-2xl border border-border shadow-inner">
        <div
          className={`absolute inset-0 ${active.type === 'css' ? active.value : ''}`}
        >
          {active.type === 'video' ? (
            <video
              src={active.value}
              autoPlay
              loop
              muted
              controls
              playsInline
              className="absolute inset-0 h-full w-full object-cover"
              {...nativeVideoControlGuardProps()}
            />
          ) : null}
          {active.type === 'image' ? (
            <div
              className="absolute inset-0 h-full w-full"
              style={{
                backgroundImage: `url(${active.value})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {ROOM_BACKGROUND_PRESETS.map((preset) => (
          <button
            key={preset.storageKey}
            type="button"
            onClick={() => setPending({ type: preset.type, value: preset.value })}
            className={`rounded-2xl border px-3 py-3 text-sm font-medium transition ${
              active.type === preset.type && active.value === preset.value
                ? 'border-primary/40 bg-primary/10 text-foreground'
                : 'border-border/60 bg-secondary/20 text-foreground hover:bg-secondary/40'
            }`}
          >
            {preset.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-2xl border border-dashed border-border px-3 py-3 text-sm font-medium text-muted-foreground transition hover:bg-secondary/40"
        >
          Upload media
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onloadend = () => {
              const result = reader.result;
              if (typeof result !== 'string') return;
              const type = file.type.startsWith('video/') ? 'video' : 'image';
              setPending({ type, value: result });
            };
            reader.readAsDataURL(file);
          }}
        />
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Current: {formatRoomBackgroundLabel(serializeRoomBackground(active))}
      </p>

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
          onClick={() => {
            onSave(serializeRoomBackground(active));
            onClose();
          }}
          className="flex-1 rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          Apply
        </button>
      </div>
    </RoomSettingsSheet>
  );
}
