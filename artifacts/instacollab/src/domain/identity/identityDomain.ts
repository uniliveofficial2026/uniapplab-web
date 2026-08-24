import type { UserSummaryViewModel } from '../../presentation/view-models/types';

/** Session identity is always the authenticated internal user_id — never a client-claimed role. */
export function toUserSummary(input: {
  userId: string;
  displayName?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
}): UserSummaryViewModel {
  return {
    userId: input.userId,
    displayName: input.displayName || '',
    username: input.username || '',
    avatarUrl: input.avatarUrl || '',
  };
}
