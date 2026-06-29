import type { MessageMediaAttachment, FullscreenMediaItem } from './types';

export function toFullscreenMediaItems(media: MessageMediaAttachment[]): FullscreenMediaItem[] {
  return media
    .filter(
      (item): item is MessageMediaAttachment & { url: string } =>
        typeof item.url === 'string' && !item.isFile
    )
    .map((item) => ({
      url: item.url,
      isVideo: !!item.isVideo,
      isAudio: item.isAudio,
      name: item.name,
    }));
}
