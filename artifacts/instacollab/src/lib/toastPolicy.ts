import { isSilentSyncToast } from './silentRemoteRefresh';
import type { TranslatableMessage } from './i18n/types';
import { isTranslatableMessage } from './i18n/serverMessage';

type ToastLike = string | TranslatableMessage;

/** Translation keys that are pure affirmative status (UI already reflects the change). */
const ROUTINE_TOAST_KEYS = new Set([
  'toast.followed',
  'toast.unfollowed',
  'toast.seatLocked',
  'toast.seatUnlocked',
  'toast.videoSeatCount',
]);

/**
 * Affirmative “you did X” status copy that should not interrupt the UI.
 * Errors / blockers / money / auth failures are not matched here.
 */
export function isRoutineConfirmationToast(message: string): boolean {
  const text = message.trim();
  if (!text) return true;

  // Never suppress messages that look like errors or hard blockers.
  if (
    /\b(fail|failed|error|could not|couldn't|unable|cannot|can't|denied|invalid|required|not enough|unavailable|permission|try again|not configured|not found|missing|blocked by|locked\/muted|must |only (the|room|owner|platform|host|group))\b/i.test(
      text,
    )
  ) {
    return false;
  }

  // Follow / social
  if (/^(Following|Followed|Unfollowed)\b/i.test(text)) return true;
  if (/^Follow request sent\b/i.test(text)) return true;

  // Live seat / mic confirmations
  if (/you (are now seated|left your seat|unmuted your|muted your)/i.test(text)) return true;
  if (/^(Muted|Unmuted) and (locked|unlocked)\b/i.test(text)) return true;
  if (/\bhas been (locked|unlocked)\.?$/i.test(text)) return true;
  if (/^(Video seat count|Seat entry) updated\b/i.test(text)) return true;
  if (/^Join seat request sent\b/i.test(text)) return true;
  if (/^Freed seat held by\b/i.test(text)) return true;
  if (/^Removed .+ from (host |co-owner |boss )?seat/i.test(text)) return true;
  if (/^Left seat: removed\b/i.test(text)) return true;
  if (/^Successfully kicked\b/i.test(text)) return true;
  if (/^Successfully supported\b/i.test(text)) return true;
  if (/^PK (battle started|disconnected)\b/i.test(text)) return true;
  if (/^Room announcement updated\.?$/i.test(text)) return true;
  if (/· Public room saved\.?$/i.test(text)) return true;

  // Clipboard / mention / trivial chrome
  if (/^(Link copied|Invite link copied|Message copied)\b/i.test(text)) return true;
  if (/^Added @.+ mention\b/i.test(text)) return true;
  if (/^Tapped to mention\b/i.test(text)) return true;
  if (/^Added to (favorites|Bookmarks)\b/i.test(text)) return true;
  if (/^Removed from Bookmarks\b/i.test(text)) return true;

  // Feed / reels / profile affirmations
  if (/^(Liked|Passed|Unmatched|Undid|Reported|Blocked|Unblocked)\b/i.test(text)) return true;
  if (/^Reel (deleted|reported)\b/i.test(text)) return true;
  if (/^Post (archived|deleted|reported)\b/i.test(text)) return true;
  if (/^Logged out\.?$/i.test(text)) return true;
  if (/^Avatar updated\b/i.test(text)) return true;
  if (/^Message (updated|deleted for everyone|forwarded|shared)\b/i.test(text)) return true;
  if (/^Selected messages (un)?pinned\b/i.test(text)) return true;
  if (/^(Member|Admin) (added|removed|muted|unmuted)\b/i.test(text)) return true;
  if (/^Group (created|deleted|name updated|profile updated)\b/i.test(text)) return true;
  if (/^You left the group\.?$/i.test(text)) return true;
  if (/^Wallpaper added\b/i.test(text)) return true;
  if (/ wallpaper file/i.test(text)) return true;

  // Dating soft affirmations
  if (/^It'?s a match with\b/i.test(text)) return true;
  if (/^Matched with\b/i.test(text)) return true;

  // Karaoke / playback soft status (emoji-heavy app-toast lines)
  if (
    /^(Playing|Now playing|Now tuning|Resuming draft|Opening Playlist|Viewing |Comment posted|Playlist "|Next up:|Previous track:|First track:|Playing Duet:|Loaded session|Recording options|VIP Premium Unlocked|Profile saved|Draft deleted|K-Star refreshed|Upload removed|Lyrics & recordings)/i.test(
      text,
    )
  ) {
    return true;
  }
  if (/^(Following|Unfollowed) .+[💖💔]/u.test(text)) return true;

  // Money / purchase / wallet success — always show (recharge confirmation matters).
  if (/^Purchased\b/i.test(text)) return false;
  if (/^Coins added to your wallet\b/i.test(text)) return false;
  if (/^\+\d+ coins\b/i.test(text)) return false;
  if (/^\+\$/.test(text)) return false;
  if (/Invite sent · \+\d+ coins/i.test(text)) return false;
  if (/Correct · \+\d+ coins/i.test(text)) return false;

  // Soft commerce (non-money) affirmations
  if (/^Pinned\b/i.test(text)) return true;
  if (/^Sent .+\(/i.test(text)) return true;
  if (/^Order .+ marked as shipped\b/i.test(text)) return true;
  if (/daily bonus/i.test(text) && !/already claimed/i.test(text)) return true;

  // Live tools / watch-together soft status
  if (/^Now playing:/i.test(text)) return true;
  if (/now playing for everyone/i.test(text)) return true;
  if (/^Reset to demo stream\.?$/i.test(text)) return true;
  if (/^Icon image uploaded\.?$/i.test(text)) return true;
  if (/^Builtin gift reset to default\.?$/i.test(text)) return true;
  if (/^Gift removed from catalog\.?$/i.test(text)) return true;
  if (/^Miss — try the next round\.?$/i.test(text)) return true;

  // Games / import soft success
  if (/folder imported — ready to play/i.test(text)) return true;
  if (/^Removed "/i.test(text) && /"\.?$/.test(text)) return true;

  // Auth soft success
  if (/^Account created\b/i.test(text)) return true;
  if (/^Password (reset link sent|updated)\b/i.test(text)) return true;
  if (/^Switched account\b/i.test(text)) return true;

  // Karaoke queue soft status
  if (/^Cancelled "/i.test(text)) return true;
  if (/^Removed "/i.test(text) && /from queue/i.test(text)) return true;
  if (/queued — you're #/i.test(text)) return true;
  if (/Updated your queued song/i.test(text)) return true;
  if (/queued for after your current song/i.test(text)) return true;
  if (/ready — tap SING/i.test(text)) return true;
  if (/^You're up! Singing\b/i.test(text)) return true;
  if (/^Sing "/i.test(text)) return true;

  return false;
}

export function toastInputPreview(msg: ToastLike): string {
  if (typeof msg === 'string') return msg;
  if (isTranslatableMessage(msg)) {
    if (msg.translationKey === '__literal__') {
      return String(msg.params?.text ?? '');
    }
    return msg.translationKey;
  }
  return '';
}

/** True when this toast should never be shown (sync noise or routine status). */
export function shouldSuppressToast(msg: ToastLike): boolean {
  if (typeof msg !== 'string' && isTranslatableMessage(msg)) {
    if (ROUTINE_TOAST_KEYS.has(msg.translationKey)) return true;
  }
  const text = toastInputPreview(msg);
  if (isSilentSyncToast(text)) return true;
  if (ROUTINE_TOAST_KEYS.has(text)) return true;
  return isRoutineConfirmationToast(text);
}
