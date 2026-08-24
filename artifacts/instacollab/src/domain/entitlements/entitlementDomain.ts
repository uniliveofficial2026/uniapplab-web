import { fetchUserEntitlements } from '../../lib/entitlements/entitlementService';
import { resolveUserDecorations } from '../../lib/entitlements/userDecorations';
import type { ProfileHeaderViewModel } from '../../presentation/view-models/types';

export async function loadProfileDecorations(userId: string): Promise<Pick<ProfileHeaderViewModel, 'decorations'>> {
  const result = await fetchUserEntitlements(userId);
  const rows = result.ok ? result.data.entitlements : [];
  const now = Date.now();
  const byUser: Record<string, Record<string, unknown>> = { [userId]: {} };
  for (const row of rows) {
    if (row.status !== 'active') continue;
    if (row.expires_at && Date.parse(row.expires_at) <= now) continue;
    byUser[userId][row.entitlement_type] = row.entitlement_id || true;
  }
  const decorations = resolveUserDecorations({ userId, entitlements: byUser });
  return {
    decorations: {
      vip: decorations.vipTier === 'vip' || decorations.vipTier === 'svip',
      svip: decorations.vipTier === 'svip',
      badgeAssetIds: decorations.avatarFrame ? [`frame.profile.${decorations.avatarFrame}`] : [],
    },
  };
}
