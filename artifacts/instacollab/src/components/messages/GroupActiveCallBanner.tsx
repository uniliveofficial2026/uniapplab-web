import { Phone, Video } from 'lucide-react';
import type { ChatCallKind } from '../../lib/chat/chatCallKit';
import { callKindLabel } from '../../lib/chat/chatCallKit';

type GroupActiveCallBannerProps = {
  callKind: ChatCallKind;
  groupName: string;
  onJoin: () => void;
};

export function GroupActiveCallBanner({ callKind, groupName, onJoin }: GroupActiveCallBannerProps) {
  const isVideo = callKind === 'video';
  const Icon = isVideo ? Video : Phone;

  return (
    <button
      type="button"
      onClick={onJoin}
      className="flex w-full shrink-0 items-center gap-3 border-b border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-left transition-colors hover:bg-emerald-500/15 active:bg-emerald-500/20"
      aria-label={`Join ${callKindLabel(callKind).toLowerCase()} in ${groupName}`}
    >
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
        <span className="absolute inset-0 rounded-full bg-emerald-400/40 animate-ping" />
        <Icon className="relative h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-emerald-950 dark:text-emerald-50">
          {callKindLabel(callKind)} in progress
        </span>
        <span className="block truncate text-xs text-emerald-800/70 dark:text-emerald-100/70">
          Tap to join {groupName}
        </span>
      </span>
      <span className="shrink-0 rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-white">
        Join
      </span>
    </button>
  );
}
