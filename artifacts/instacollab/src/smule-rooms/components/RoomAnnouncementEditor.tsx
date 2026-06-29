import type { RoomSettings } from '../utils/storage';
import { saveRoomSettings } from '../utils/storage';
import { isPlaceholderSetting } from '../utils/roomMedia';
import { RoomSettingsTextEditor } from './RoomSettingsEditors';

export function getAnnouncementDraft(
  settings: Pick<RoomSettings, 'bulletin' | 'greetings'>,
): string {
  const bulletin = settings.bulletin?.trim() ?? '';
  if (bulletin && !isPlaceholderSetting(bulletin)) return bulletin;
  const greetings = settings.greetings?.trim() ?? '';
  if (greetings && !isPlaceholderSetting(greetings)) return greetings;
  return 'Welcome to the room!';
}

type RoomAnnouncementEditorProps = {
  open: boolean;
  onClose: () => void;
  roomId: string;
  settings: Pick<RoomSettings, 'bulletin' | 'greetings'>;
  onSaved?: (text: string) => void;
};

export function RoomAnnouncementEditor({
  open,
  onClose,
  roomId,
  settings,
  onSaved,
}: RoomAnnouncementEditorProps) {
  return (
    <RoomSettingsTextEditor
      open={open}
      title="Room Announcement"
      value={getAnnouncementDraft(settings)}
      multiline
      placeholder="Room announcement shown to guests. Use {name} for each viewer's name."
      onClose={onClose}
      onSave={(next) => {
        const text = next.trim() || 'Welcome to the room!';
        saveRoomSettings(roomId, { bulletin: text });
        onSaved?.(text);
        onClose();
      }}
    />
  );
}
