import React from 'react';
import { Lock } from 'lucide-react';

type Props = {
  username: string;
  compact?: boolean;
};

export function ProfilePrivateContentGate({ username, compact }: Props) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center border border-border rounded-2xl bg-secondary/20 ${
        compact ? 'py-10 px-4' : 'py-16 px-6'
      }`}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-border bg-background">
        <Lock className="h-7 w-7 text-muted-foreground" />
      </div>
      <p className="text-sm font-bold">This account is private</p>
      <p className="mt-2 max-w-xs text-xs text-muted-foreground leading-relaxed">
        Follow {username} to see their photos and videos.
      </p>
    </div>
  );
}
