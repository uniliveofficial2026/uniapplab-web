import React, { useState } from 'react';
import { ArrowLeft, KeyRound, Lock } from 'lucide-react';

type RoomKeyGateProps = {
  roomTitle: string;
  roomDisplayId: string;
  onSubmit: (key: string) => boolean;
  onLeave: () => void;
};

export function RoomKeyGate({
  roomTitle,
  roomDisplayId,
  onSubmit,
  onLeave,
}: RoomKeyGateProps) {
  const [keyInput, setKeyInput] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = keyInput.trim();
    if (!trimmed) {
      setError('Enter the room key to continue.');
      return;
    }
    const accepted = onSubmit(trimmed);
    if (!accepted) {
      setError('Incorrect room key. Nobody can enter without the correct key.');
    }
  };

  return (
    <div className="room-key-gate flex h-full min-h-0 flex-1 flex-col items-center justify-center bg-[#07010a] px-6 py-10 text-gray-100">
      <button
        type="button"
        onClick={onLeave}
        className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-gray-300 transition hover:bg-white/10"
        aria-label="Leave room"
      >
        <ArrowLeft size={18} />
      </button>

      <div className="w-full max-w-sm rounded-[28px] border border-amber-500/25 bg-[#12091f]/95 p-6 shadow-[0_0_40px_rgba(245,158,11,0.12)] backdrop-blur-xl">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400">
            <Lock size={22} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300/80">
              Private Room
            </p>
            <h1 className="truncate text-lg font-black text-white">{roomTitle}</h1>
            <p className="text-xs text-gray-400">ID: {roomDisplayId}</p>
          </div>
        </div>

        <p className="mb-5 text-sm leading-relaxed text-gray-300">
          This room is locked. Enter the room key every time you join. Owner,
          co-owner, admin, and guests all need the key on each visit.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block text-xs font-bold uppercase tracking-wide text-gray-400">
            Room Key
          </label>
          <div className="relative">
            <KeyRound
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
            />
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={keyInput}
              onChange={(event) => {
                setKeyInput(event.target.value);
                if (error) setError('');
              }}
              placeholder="Enter room key"
              className="w-full rounded-2xl border border-white/10 bg-black/40 py-3 pl-10 pr-4 text-center text-lg font-black tracking-[0.35em] text-white outline-none transition focus:border-amber-400/50"
            />
          </div>
          {error ? <p className="text-sm font-medium text-red-400">{error}</p> : null}
          <button
            type="submit"
            className="w-full rounded-2xl bg-amber-500 py-3 text-sm font-black uppercase tracking-wider text-black transition hover:bg-amber-400"
          >
            Enter Room
          </button>
        </form>
      </div>
    </div>
  );
}
