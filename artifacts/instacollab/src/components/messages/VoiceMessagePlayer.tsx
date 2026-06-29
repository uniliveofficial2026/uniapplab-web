import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Play, Pause, AlertCircle } from 'lucide-react';
import { Waveform } from './Waveform';
import { useToast } from '../../lib/ToastContext';
import {
  beginChatMediaPlayback,
  isChatMediaSessionActive,
  registerChatMediaPlayer,
} from '../../lib/chatMediaPlayback';
import {
  mediaReachedEnd,
  useMessageMediaPlaylist,
  useRegisterMessagePlaylistTrack,
} from './MessageMediaPlaylist';

function normalizeAudioDataUrl(url: string): string {
  if (!url.startsWith('data:audio/')) return url;
  const commaIndex = url.indexOf(',');
  if (commaIndex === -1) return url;
  const header = url.slice(5, commaIndex); // strip `data:`
  const payload = url.slice(commaIndex + 1);
  const [mime] = header.split(';');
  if (!mime) return url;
  // Some browsers fail on data URLs containing codec params in MIME header.
  return `data:${mime};base64,${payload}`;
}

function buildSourceCandidates(url: string): string[] {
  if (!url) return [];
  const candidates = [url];
  const normalized = normalizeAudioDataUrl(url);
  if (normalized !== url) candidates.push(normalized);

  return [...new Set(candidates)];
}

export function VoiceMessagePlayer({
  url,
  color = 'primary',
  onReRecord,
  playlistTrackId,
}: {
  url: string,
  color?: 'primary' | 'secondary',
  onReRecord?: () => void,
  playlistTrackId?: string,
}) {
  const safeUrl = typeof url === 'string' ? url : '';
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [sourceCandidates, setSourceCandidates] = useState<string[]>(buildSourceCandidates(safeUrl));
  const [sourceIndex, setSourceIndex] = useState(0);
  const [hasTriedPlay, setHasTriedPlay] = useState(false);
  const [audioSrc, setAudioSrc] = useState(safeUrl);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const { showToast } = useToast();
  const playlist = useMessageMediaPlaylist();

  useEffect(() => {
    // Reset if URL changes
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
      setDuration(0);
      setIsLoaded(false);
      setHasError(false);
      setHasTriedPlay(false);
      audioRef.current.load();
    }
    const nextCandidates = buildSourceCandidates(safeUrl);
    setSourceCandidates(nextCandidates);
    setSourceIndex(0);
    setAudioSrc(nextCandidates[0] || '');
  }, [safeUrl]);

  const pauseSelf = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const syncProgress = () => {
    if (audioRef.current) {
      const audio = audioRef.current;
      const safeDuration = audio.duration || 0;
      const p = safeDuration > 0 ? audio.currentTime / safeDuration : 0;
      setProgress(p || 0);
      setCurrentTime(audio.currentTime || 0);
      setDuration(safeDuration);
    }
  };

  const stopAnimationLoop = () => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };

  const runAnimationLoop = () => {
    syncProgress();
    const audio = audioRef.current;
    if (audio && !audio.paused && !audio.ended) {
      animationFrameRef.current = requestAnimationFrame(runAnimationLoop);
    } else {
      animationFrameRef.current = null;
    }
  };

  const startAnimationLoop = () => {
    if (animationFrameRef.current !== null) return;
    animationFrameRef.current = requestAnimationFrame(runAnimationLoop);
  };

  const startPlayback = useCallback(
    (fromPlaylist = false) => {
      if (!audioSrc || !audioRef.current || hasError) return;
      setHasTriedPlay(true);
      if (
        audioRef.current.ended ||
        audioRef.current.currentTime >= (audioRef.current.duration || 0)
      ) {
        audioRef.current.currentTime = 0;
      }
      const session = fromPlaylist ? 0 : beginChatMediaPlayback(pauseSelf);
      audioRef.current.play().catch((err) => {
        console.error('Playback failed', err);
        setIsPlaying(false);
        stopAnimationLoop();
        if (err && err.name !== 'NotAllowedError' && err.name !== 'AbortError') {
          setHasError(false);
        }
      }).then(() => {
        if (!fromPlaylist && !isChatMediaSessionActive(session)) return;
        if (!audioRef.current || audioRef.current.paused) return;
        // UI sync is driven by onPlay; keep as fallback if onPlay was skipped
        setIsPlaying(true);
        startAnimationLoop();
      });
    },
    [audioSrc, hasError, pauseSelf]
  );

  const playFromPlaylist = useCallback(() => startPlayback(true), [startPlayback]);

  const playlistHandlers = useMemo(
    () =>
      playlistTrackId && playlist
        ? { pause: pauseSelf, playFromPlaylist }
        : null,
    [playlistTrackId, playlist, pauseSelf, playFromPlaylist]
  );

  useRegisterMessagePlaylistTrack(playlistTrackId, playlistHandlers);

  useEffect(() => {
    return registerChatMediaPlayer(pauseSelf);
  }, [pauseSelf]);

  const handleError = () => {
    if (!audioRef.current || !audioRef.current.error) return;
    console.error('Audio playback error:', audioRef.current.error.code);
    setIsPlaying(false);
    stopAnimationLoop();

    const nextIndex = sourceIndex + 1;
    if (nextIndex < sourceCandidates.length) {
      setSourceIndex(nextIndex);
      setAudioSrc(sourceCandidates[nextIndex]);
      setHasError(false);
      setIsLoaded(false);
      return;
    }

    // Only escalate preload/decode failures to UI after user has attempted playback.
    if (hasTriedPlay) {
      setIsLoaded(true);
      setHasError(true);
      showToast('Unable to play voice message. This file is not playable in this browser.');
    } else {
      setHasError(false);
      setIsLoaded(false);
    }
  };

  const handleLoadStart = () => {
    setIsLoaded(false);
    setHasError(false);
  };

  const handleCanPlay = () => {
    setIsLoaded(true);
    if (audioRef.current) {
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    stopAnimationLoop();
    setProgress(1);
    setCurrentTime(audioRef.current?.duration || 0);
    if (playlistTrackId && playlist) {
      playlist.onEnded(playlistTrackId);
    }
  };

  const handleAudioPlay = () => {
    if (playlistTrackId && playlist) {
      if (playlist.consumePlayEvent(playlistTrackId)) {
        playlist.play(playlistTrackId);
        return;
      }
    }
    setIsPlaying(true);
    startAnimationLoop();
  };

  const handleAudioPause = () => {
    if (playlistTrackId && playlist && audioRef.current) {
      if (audioRef.current.ended || mediaReachedEnd(audioRef.current)) return;
      playlist.notifyPaused(playlistTrackId);
      return;
    }
    setIsPlaying(false);
    stopAnimationLoop();
  };

  const togglePlayback = () => {
    if (!audioSrc || !audioRef.current || hasError) return;

    const playing = isPlaying || (audioRef.current && !audioRef.current.paused);
    if (playing) {
      audioRef.current.pause();
      if (playlistTrackId && playlist) {
        playlist.notifyPaused(playlistTrackId);
      }
    } else if (playlistTrackId && playlist) {
      playlist.play(playlistTrackId);
    } else {
      startPlayback();
    }
  };

  const seekPlayback = (nextProgress: number) => {
    if (!audioRef.current || hasError) return;
    const safeDuration = audioRef.current.duration || 0;
    if (safeDuration <= 0) return;
    audioRef.current.currentTime = safeDuration * nextProgress;
    setProgress(nextProgress);
    setCurrentTime(audioRef.current.currentTime);
  };

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const activeBarColor = 'bg-red-500';
  const inactiveBarColor = 'bg-black/35 dark:bg-zinc-500/45';

  return (
    <div className="w-full min-w-0">
      <div className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-2 w-full min-h-[32px] min-w-0">
        <button 
          type="button" 
          onClick={togglePlayback}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shrink-0 ${
            color === 'primary' ? 'bg-primary-foreground text-primary' : 'bg-primary text-white'
          } ${!isLoaded && audioRef.current ? 'animate-pulse opacity-70' : ''} ${hasError ? 'bg-red-500/20 text-red-500' : ''}`}
        >
          {hasError ? <AlertCircle className="w-4 h-4" /> : isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 translate-x-0.5" />}
        </button>
        <div className="min-w-0">
          <Waveform
            isPlaying={isPlaying}
            color={activeBarColor}
            inactiveColor={inactiveBarColor}
            progress={progress}
            onSeek={seekPlayback}
          />
        </div>
        <div className={`text-[10px] font-bold tabular-nums shrink-0 whitespace-nowrap ${color === 'primary' ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
          {formatTime(currentTime)}/{formatTime(duration)}
        </div>
      </div>

      {hasError && (
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <p className="text-[10px] text-red-500 font-medium">
            Unable to play this voice message.
          </p>
          {onReRecord && (
            <button
              type="button"
              onClick={onReRecord}
              className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-500 hover:bg-red-500/25 transition-colors font-semibold"
            >
              Re-record
            </button>
          )}
        </div>
      )}

      <audio
        ref={audioRef}
        onPlay={handleAudioPlay}
        onPause={handleAudioPause}
        src={audioSrc}
        preload="auto"
        onCanPlay={handleCanPlay}
        onLoadedMetadata={handleCanPlay}
        onTimeUpdate={syncProgress}
        onLoadStart={handleLoadStart}
        onError={handleError}
        onEnded={handleEnded}
        className="hidden"
      />
    </div>
  );
}
