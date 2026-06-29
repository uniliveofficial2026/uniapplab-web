import type { RoomSettings } from './storage';
import { isPlaceholderSetting } from './roomMedia';
import { getAnnouncementDraft } from '../components/RoomAnnouncementEditor';

export type ViewerRoomWelcome = {
  recipientName: string;
  greetingLine: string;
  bodyLines: string[];
};

export function personalizeRoomAnnouncementText(text: string, viewerName: string): string {
  const name = viewerName.trim();
  if (!name) return text.trim();
  return text
    .trim()
    .replace(/\{name\}/gi, name)
    .replace(/\{viewer\}/gi, name)
    .replace(/@viewer\b/gi, `@${name}`);
}

function resolveGreetingTemplate(settings: Pick<RoomSettings, 'greetings'>): string {
  const greetings = settings.greetings?.trim() ?? '';
  if (greetings && !isPlaceholderSetting(greetings)) return greetings;
  return 'Welcome, {name}!';
}

function resolveBulletinTemplate(settings: Pick<RoomSettings, 'bulletin' | 'greetings'>): string {
  const bulletin = settings.bulletin?.trim() ?? '';
  if (bulletin && !isPlaceholderSetting(bulletin)) return bulletin;
  return getAnnouncementDraft(settings);
}

export function buildViewerRoomWelcome(
  settings: Pick<RoomSettings, 'bulletin' | 'greetings'>,
  viewerName: string,
): ViewerRoomWelcome | null {
  const recipientName = viewerName.trim();
  if (!recipientName) return null;

  const greetingLine = personalizeRoomAnnouncementText(
    resolveGreetingTemplate(settings),
    recipientName,
  );
  const bulletin = personalizeRoomAnnouncementText(resolveBulletinTemplate(settings), recipientName);
  const bodyLines = bulletin
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line, index, all) => line.length > 0 || all.length === 1);

  return {
    recipientName,
    greetingLine,
    bodyLines: bodyLines.length > 0 ? bodyLines : [bulletin],
  };
}
