import React from 'react';
import { UserCheck, UserX } from 'lucide-react';
import { useDB } from '../../lib/useDB';
import { useToast } from '../../lib/ToastContext';
import { resolveUser } from '../../lib/safe';
import { Avatar } from '../common/Avatar';
import { ProfileNameLines } from '../common/ProfileNameLines';
import { getProfileDisplayName } from '../../lib/profileDisplay';
import { openProfilePreview } from '../../lib/utils';

type Props = {
  profileUserId: string;
};

export function ProfileFollowRequestsPanel({ profileUserId }: Props) {
  const db = useDB();
  const { showToast } = useToast();
  const requesterIds = db.getPendingFollowRequesterIds(profileUserId);
  if (requesterIds.length === 0) return null;

  return (
    <div className="mb-6 rounded-2xl border border-border bg-secondary/30 p-4">
      <p className="text-sm font-bold mb-3">
        Follow requests ({requesterIds.length})
      </p>
      <ul className="space-y-3">
        {requesterIds.map((requesterId) => {
          const user = resolveUser(db.users, db.users.find((u) => u.id === requesterId));
          return (
            <li key={requesterId} className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => openProfilePreview(user)}
                className="shrink-0"
              >
                <Avatar user={user} className="w-10 h-10" />
              </button>
              <div className="min-w-0 flex-1">
                <ProfileNameLines
                  user={user}
                  primaryClassName="text-sm font-bold truncate w-full"
                  secondaryClassName="text-xs text-muted-foreground truncate w-full"
                />
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (db.approveFollowRequest(requesterId)) {
                      showToast(`Approved ${getProfileDisplayName(user)}`);
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90"
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (db.rejectFollowRequest(requesterId)) {
                      showToast(`Declined ${getProfileDisplayName(user)}`);
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-bold hover:bg-secondary"
                >
                  <UserX className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
