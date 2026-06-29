export type KaraokeLibrarySong = {
  id: string;
  title: string;
  artist: string;
  plays?: string;
  category?: string;
  type?: string;
  img?: string;
  isUploaded?: boolean;
  lyrics?: string;
  timedLyrics?: { text: string; time: number; words?: { text: string; time: number }[] }[];
  durationSec?: number;
  mediaKind?: 'audio' | 'video';
  isVideo?: boolean;
  mimeType?: string;
  audioUrl?: string;
};

export type KaraokeDuetPost = {
  id: string;
  users: string[];
  song: string;
  likesCount: number;
  commentCount: number;
  isLiked: boolean;
  videoUrl: string;
  img: string;
  songId?: string;
  recordingId?: string;
  isPublishedCover?: boolean;
};
