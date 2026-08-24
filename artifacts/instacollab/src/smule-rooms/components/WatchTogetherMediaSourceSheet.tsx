import React, { useEffect, useRef, useState } from 'react';
import { Link2, Upload, X, Youtube } from 'lucide-react';
import { AppCameraButton } from '../../components/camera/AppCameraButton';
import { cameraCaptureToFile } from '../../lib/camera/cameraCaptureAdapters';
import type { AppCameraCapturePayload } from '../../contexts/AppCameraContext';
import {
  clearWatchTogetherMediaUrl,
  describeWatchTogetherMediaSource,
  inferWatchTogetherMediaKindFromFile,
  normalizeWatchTogetherMediaUrl,
  setWatchTogetherMediaFile,
  setWatchTogetherMediaUrl,
  setWatchTogetherYoutubeVideo,
  type WatchTogetherMedia,
} from '../utils/watchTogetherMedia';
import { YoutubeSearchPanel } from './YoutubeSearchPanel';
import { recordYoutubeHistory, type YoutubeVideoSummary } from '../../services/youtube';

export type WatchTogetherMediaPanel = 'url' | 'youtube' | 'upload';

type WatchTogetherMediaSourceSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  roomDisplayId: string;
  media: WatchTogetherMedia;
  showToast: (message: string) => void;
  onMediaUpdated?: (media: WatchTogetherMedia) => void;
  initialPanel?: WatchTogetherMediaPanel;
  autoPickFileOnOpen?: boolean;
};

export function WatchTogetherMediaSourceSheet({
  isOpen,
  onClose,
  roomDisplayId,
  media,
  showToast,
  onMediaUpdated,
  initialPanel = 'url',
  autoPickFileOnOpen = false,
}: WatchTogetherMediaSourceSheetProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [panel, setPanel] = useState<WatchTogetherMediaPanel>(initialPanel);
  const [urlDraft, setUrlDraft] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const sourceLabel = describeWatchTogetherMediaSource(
    media.streamUrl,
    media.isCustom,
    media.fileName,
  );

  useEffect(() => {
    if (!isOpen) return;
    setPanel(initialPanel);
    setUrlDraft(
      media.isCustom && media.streamUrl.startsWith('http') ? media.streamUrl : '',
    );
    setInlineError(null);
  }, [isOpen, initialPanel, media.isCustom, media.streamUrl]);

  useEffect(() => {
    if (!isOpen || !autoPickFileOnOpen || initialPanel !== 'upload') return undefined;
    const timer = window.setTimeout(() => fileInputRef.current?.click(), 120);
    return () => window.clearTimeout(timer);
  }, [autoPickFileOnOpen, initialPanel, isOpen]);

  if (!isOpen) return null;

  const applyUrl = async () => {
    const normalized = normalizeWatchTogetherMediaUrl(urlDraft);
    if (!normalized) {
      const message = 'Enter a valid http(s) media URL or YouTube link';
      setInlineError(message);
      showToast(message);
      return;
    }

    setIsBusy(true);
    setInlineError(null);
    try {
      const updated = setWatchTogetherMediaUrl(roomDisplayId, normalized);
      onMediaUpdated?.(updated);
      showToast(`Now playing: ${describeWatchTogetherMediaSource(updated.streamUrl, updated.isCustom, updated.fileName)}`);
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not apply URL';
      setInlineError(message);
      showToast(message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    await applyUploadedFile(file);
  };

  const applyUploadedFile = async (file: File) => {
    setIsBusy(true);
    setInlineError(null);
    try {
      const updated = await setWatchTogetherMediaFile(roomDisplayId, file);
      const kind = inferWatchTogetherMediaKindFromFile(file);
      onMediaUpdated?.(updated);
      showToast(`${kind === 'audio' ? 'Audio' : 'Video'} uploaded — now playing for everyone`);
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      setInlineError(message);
      showToast(message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleCameraCaptured = async (payload: AppCameraCapturePayload) => {
    try {
      const file = await cameraCaptureToFile(payload);
      await applyUploadedFile(file);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Camera capture failed';
      setInlineError(message);
      showToast(message);
    }
  };

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    if (isBusy) return;
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/') && !file.type.startsWith('audio/')) {
      const message = 'Drop a video or audio file';
      setInlineError(message);
      showToast(message);
      return;
    }

    setIsBusy(true);
    setInlineError(null);
    try {
      const updated = await setWatchTogetherMediaFile(roomDisplayId, file);
      onMediaUpdated?.(updated);
      showToast('Uploaded file is now playing for everyone');
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      setInlineError(message);
      showToast(message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleReset = () => {
    const updated = clearWatchTogetherMediaUrl(roomDisplayId);
    onMediaUpdated?.(updated);
    showToast('Reset to demo stream');
    onClose();
  };

  const handleSelectYoutubeVideo = async (video: YoutubeVideoSummary) => {
    setIsBusy(true);
    setInlineError(null);
    try {
      const updated = setWatchTogetherYoutubeVideo(roomDisplayId, video);
      await recordYoutubeHistory(video);
      onMediaUpdated?.(updated);
      showToast(`Now playing: ${video.title}`);
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not apply YouTube video';
      setInlineError(message);
      showToast(message);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 p-3 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0c0c20] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.65)]"
        role="dialog"
        aria-labelledby="wt-media-source-title"
        onClick={(event) => event.stopPropagation()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 id="wt-media-source-title" className="text-sm font-black text-white">
              Room media
            </h2>
            <p className="mt-0.5 text-[11px] text-white/50">
              Saved to this room — all viewers load the same source.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mb-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Now playing</p>
          <p className="text-xs font-bold text-cyan-200">{sourceLabel}</p>
          <p className="mt-1 truncate text-[10px] font-mono text-white/45">
            {media.fileName
              ?? (media.kind === 'youtube' && media.youtubeVideoId
                ? `https://www.youtube.com/embed/${media.youtubeVideoId}`
                : media.streamUrl.startsWith('http')
                ? media.streamUrl
                : media.kind === 'audio'
                  ? 'Audio stream'
                  : 'Video stream')}
          </p>
        </div>

        <div className="mb-3 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setPanel('url')}
            className={`inline-flex items-center justify-center gap-1 rounded-xl border px-2 py-2 text-[11px] font-black ${
              panel === 'url'
                ? 'border-pink-500/50 bg-pink-500/15 text-pink-100'
                : 'border-white/10 bg-white/5 text-white/60'
            }`}
          >
            <Link2 size={13} />
            URL
          </button>
          <button
            type="button"
            onClick={() => setPanel('youtube')}
            className={`inline-flex items-center justify-center gap-1 rounded-xl border px-2 py-2 text-[11px] font-black ${
              panel === 'youtube'
                ? 'border-red-500/50 bg-red-500/15 text-red-100'
                : 'border-white/10 bg-white/5 text-white/60'
            }`}
          >
            <Youtube size={13} />
            YouTube
          </button>
          <button
            type="button"
            onClick={() => {
              setPanel('upload');
              fileInputRef.current?.click();
            }}
            className={`inline-flex items-center justify-center gap-1 rounded-xl border px-2 py-2 text-[11px] font-black ${
              panel === 'upload'
                ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-100'
                : 'border-white/10 bg-white/5 text-white/60'
            }`}
          >
            <Upload size={13} />
            Upload
          </button>
        </div>

        {panel === 'youtube' ? (
          <YoutubeSearchPanel
            compact
            selectLabel="Play in room"
            onSelectVideo={(video) => {
              void handleSelectYoutubeVideo(video);
            }}
          />
        ) : panel === 'upload' ? (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,audio/*,.mp4,.webm,.mov,.m4v,.mp3,.m4a,.aac,.ogg,.wav"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isBusy}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/5 py-4 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-50"
            >
              <Upload size={16} />
              {isBusy ? 'Uploading…' : 'Choose video or audio file'}
            </button>
            <AppCameraButton
              title="Watch together camera"
              label="Record video"
              onCaptured={handleCameraCaptured}
              disabled={isBusy}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 py-3 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-50"
              iconClassName="h-4 w-4"
            />
            <p className="mt-2 text-center text-[10px] text-white/35">
              Or drag and drop a file onto this panel
            </p>
            {inlineError ? (
              <p className="mt-2 text-[11px] font-bold text-red-400" role="alert">
                {inlineError}
              </p>
            ) : null}
          </>
        ) : (
          <>
        <form
          className="mb-2"
          onSubmit={(event) => {
            event.preventDefault();
            void applyUrl();
          }}
        >
          <label className="mb-2 block text-[11px] font-bold text-white/70" htmlFor="wt-media-url">
            Media URL
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Link2 size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35" />
              <input
                id="wt-media-url"
                type="url"
                inputMode="url"
                placeholder="https://example.com/video.mp4 or YouTube URL"
                value={urlDraft}
                onChange={(event) => {
                  setUrlDraft(event.target.value);
                  if (inlineError) setInlineError(null);
                }}
                disabled={isBusy}
                className="w-full rounded-xl border border-white/10 bg-black/40 py-2.5 pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-pink-500/50 disabled:opacity-50"
              />
            </div>
            <button
              type="submit"
              disabled={isBusy || !urlDraft.trim()}
              className="shrink-0 rounded-xl bg-pink-600 px-4 text-xs font-black text-white hover:bg-pink-500 disabled:opacity-50"
            >
              {isBusy ? '…' : 'Apply'}
            </button>
          </div>
        </form>

        {inlineError ? (
          <p className="mb-2 text-[11px] font-bold text-red-400" role="alert">
            {inlineError}
          </p>
        ) : null}
          </>
        )}

        {media.isCustom && panel !== 'youtube' ? (
          <button
            type="button"
            onClick={handleReset}
            disabled={isBusy}
            className="mt-3 w-full rounded-xl border border-white/10 py-2 text-xs font-bold text-white/60 hover:bg-white/5 hover:text-white disabled:opacity-50"
          >
            Reset to demo stream
          </button>
        ) : null}
      </div>
    </div>
  );
}
