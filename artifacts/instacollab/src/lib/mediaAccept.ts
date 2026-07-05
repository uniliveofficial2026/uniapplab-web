/** Broad accept strings for mobile gallery / file pickers (iOS, Android, desktop). */
export const PHOTO_VIDEO_ACCEPT =
  'image/*,video/*,.mp4,.mov,.webm,.m4v,.3gp,.heic,.heif,.mkv,.avi,.mpeg,.mpg';

export const AUDIO_ACCEPT =
  'audio/*,.mp3,.wav,.ogg,.aac,.m4a,.flac,.webm,.opus,.aiff,.caf,.wma';

export const DOCUMENT_ACCEPT =
  '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z,.json,.xml,application/*,text/*';

export const ALL_MEDIA_ACCEPT = `${PHOTO_VIDEO_ACCEPT},${AUDIO_ACCEPT}`;
