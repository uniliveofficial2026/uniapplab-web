import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Play, Pause, SkipBack, SkipForward, Music, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
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

interface MusicDiscPlayerProps {
  url: string;
  name?: string;
  color?: 'primary' | 'secondary';
  playlistTrackId?: string;
}

export function MusicDiscPlayer({
  url,
  name = 'Audio Track',
  color = 'primary',
  playlistTrackId,
}: MusicDiscPlayerProps) {
  const safeUrl = typeof url === 'string' ? url : '';
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const dragListenersRef = useRef<{ onMove: (event: MouseEvent) => void; onUp: () => void } | null>(null);

  const clearDragListeners = useCallback(() => {
    const active = dragListenersRef.current;
    if (!active) return;
    window.removeEventListener('mousemove', active.onMove);
    window.removeEventListener('mouseup', active.onUp);
    dragListenersRef.current = null;
  }, []);
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
      audioRef.current.load();
    }
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
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      clearDragListeners();
    };
  }, [clearDragListeners]);

  const syncProgress = () => {
    const audio = audioRef.current;
    if (!audio) return;

    const safeDuration = Number.isFinite(audio.duration) ? audio.duration : 0;
    const safeCurrentTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    const nextProgress = safeDuration > 0 ? (safeCurrentTime / safeDuration) * 100 : 0;

    setCurrentTime(safeCurrentTime);
    setDuration(safeDuration);
    setProgress(nextProgress);

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

  const handleError = () => {
    // Only treat as fatal if there is an actual error object on the audio element
    if (audioRef.current && audioRef.current.error) {
      console.error('Audio playback error:', audioRef.current.error.code);
      setIsPlaying(false);
      setIsLoaded(true);
      setHasError(true);
      showToast('Unable to play audio. The file may be unsupported.');
      stopAnimationLoop();
    }
  };

  const handleLoadStart = () => {
    setIsLoaded(false);
    setHasError(false);
  };

  const handleCanPlay = () => {
    setIsLoaded(true);
    if (audioRef.current && Number.isFinite(audioRef.current.duration)) {
      setDuration(audioRef.current.duration);
      syncProgress();
    }
  };

  const startPlayback = useCallback(
    (fromPlaylist = false) => {
      if (!safeUrl || !audioRef.current || hasError) return;
      const session = fromPlaylist ? 0 : beginChatMediaPlayback(pauseSelf);
      audioRef.current.play().catch((err) => {
        console.error('Playback failed');
        setIsPlaying(false);
        stopAnimationLoop();
        if (err && err.name !== 'NotAllowedError') {
          setHasError(true);
        }
      }).then(() => {
        if (!fromPlaylist && !isChatMediaSessionActive(session)) return;
        if (!audioRef.current || audioRef.current.paused) return;
        setIsPlaying(true);
        startAnimationLoop();
      });
    },
    [safeUrl, hasError, pauseSelf]
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

  const handleEnded = () => {
    setIsPlaying(false);
    stopAnimationLoop();
    const endedDuration = audioRef.current?.duration ?? duration;
    setCurrentTime(Number.isFinite(endedDuration) ? endedDuration : 0);
    setProgress(100);
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
    if (!safeUrl || !audioRef.current || hasError) return;

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

  const seekForward = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.min(audioRef.current.currentTime + 10, audioRef.current.duration || 0);
      syncProgress();
    }
  };

  const seekBackward = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(audioRef.current.currentTime - 10, 0);
      syncProgress();
    }
  };

  const formatTime = (time: number) => {
    if (!Number.isFinite(time) || time <= 0) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const [isDragging, setIsDragging] = useState(false);
  const progressContainerRef = useRef<HTMLDivElement>(null);

  const handleSeek = (clientX: number) => {
    if (!progressContainerRef.current || !audioRef.current || !duration) return;
    const rect = progressContainerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const width = rect.width;
    const ratio = Math.max(0, Math.min(1, x / width));
    const newTime = ratio * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    setProgress(ratio * 100);
  };

  const onMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleSeek(e.clientX);
    clearDragListeners();

    const onMouseMove = (moveEvent: MouseEvent) => {
      handleSeek(moveEvent.clientX);
    };

    const onMouseUp = () => {
      setIsDragging(false);
      clearDragListeners();
    };

    dragListenersRef.current = { onMove: onMouseMove, onUp: onMouseUp };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const remainingTime = Math.max(0, duration - currentTime);

  // Clean filename for display (remove "🎵 Sent audio: " if present)
  const displayName = name.replace(/^🎵 Sent audio: /, '');

  return (
    <div className={`flex flex-col gap-3 p-3 sm:p-4 rounded-3xl border bg-white/5 backdrop-blur-xl shadow-2xl transition-all w-full max-w-[400px] ${
      color === 'primary' ? 'border-primary/20' : 'border-white/10'
    }`}>
      <div className="flex items-center gap-4">
        {/* Spinning Disc */}
        <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0">
          <motion.div
            className="w-full h-full rounded-full bg-neutral-900 border-2 sm:border-4 border-neutral-800 flex items-center justify-center relative overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.5)]"
            animate={{ rotate: isPlaying ? 360 : 0 }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "linear"
            }}
          >
            {/* Vinyl grooves */}
            <div className="absolute inset-0 rounded-full border border-white/5" />
            <div className="absolute inset-2 sm:inset-3 rounded-full border border-white/5" />
            <div className="absolute inset-4 sm:inset-6 rounded-full border border-white/5" />
            <div className="absolute inset-6 sm:inset-9 rounded-full border border-white/5" />
            
            {/* Label */}
            <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full ${color === 'primary' ? 'bg-primary' : 'bg-secondary'} flex items-center justify-center shadow-inner relative z-10`}>
              <Music className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
            </div>
            
            {/* Reflections */}
            <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-white/10 to-transparent rounded-full rotate-45 pointer-events-none" />
          </motion.div>
          
          {/* Stylus (Tone arm) */}
          <motion.div 
            className="absolute top-0 right-0 w-8 h-8 pointer-events-none origin-top-right"
            animate={{ rotate: isPlaying ? 5 : -10 }}
            transition={{ type: 'spring', stiffness: 100 }}
          >
             <div className="absolute top-1 right-1 w-0.5 h-10 bg-neutral-500 rounded-full shadow-sm origin-top" />
             <div className="absolute top-10 right-0.5 w-1.5 h-1.5 bg-neutral-400 rounded-full shadow-sm" />
          </motion.div>
        </div>

        {/* Metadata & Controls */}
        <div className="flex-1 flex flex-col gap-1 min-w-0 overflow-hidden">
          <div className="relative w-full overflow-hidden whitespace-nowrap">
            <motion.div
              className="flex gap-10 w-max"
              animate={isPlaying ? { x: ['0%', '-50%'] } : { x: '0%' }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: "linear"
              }}
            >
              <h4 className="text-white font-semibold text-[14px] sm:text-base pr-4">
                {displayName}
              </h4>
              {isPlaying && (
                <h4 className="text-white font-semibold text-[14px] sm:text-base pr-4">
                  {displayName}
                </h4>
              )}
            </motion.div>
            {/* Fade edges */}
            <div className="absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-[#1a1a1a] to-transparent z-10" />
            <div className="absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-[#1a1a1a] to-transparent z-10" />
          </div>
          
          <div className="flex items-center gap-1.5 text-white/40 text-[10px] sm:text-xs">
             <div className="flex items-center gap-1">
               <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse" />
               <span>{isPlaying ? 'Now Playing' : 'Paused'}</span>
             </div>
             <span>•</span>
             <span>Audio Player</span>
          </div>

          <div className="flex items-baseline gap-2 mt-1">
             <span className="text-primary text-xl sm:text-2xl font-mono leading-none tracking-tighter tabular-nums">
               {formatTime(currentTime)}
             </span>
             <span className="text-white/30 text-[10px] sm:text-xs font-mono mb-1 tabular-nums">
               / -{formatTime(remainingTime)}
             </span>
          </div>
        </div>
      </div>

      {/* Progress & Controls Row */}
      <div className="flex flex-col gap-3">
        <div 
          ref={progressContainerRef}
          onMouseDown={onMouseDown}
          className="relative h-2 w-full bg-white/10 rounded-full cursor-pointer group select-none"
        >
          <motion.div 
            className={`absolute left-0 top-0 h-full rounded-full ${color === 'primary' ? 'bg-primary' : 'bg-secondary'}`}
            animate={{ width: `${progress}%` }}
            transition={{ duration: isDragging ? 0 : 0.1, ease: 'linear' }}
          />
          {/* Scrubber Handle */}
          <motion.div
            className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white shadow-lg border-2 ${color === 'primary' ? 'border-primary' : 'border-secondary'} scale-100 transition-transform z-10`}
            animate={{ left: `${progress}%` }}
            style={{ x: '-50%' }}
            transition={{ duration: isDragging ? 0 : 0.1, ease: 'linear' }}
          />
          <div className="absolute inset-0 hover:bg-white/5 transition-colors rounded-full" />
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-4">
            <button 
              onClick={seekBackward}
              className="p-1 text-white/40 hover:text-white transition-colors active:scale-90"
              title="Seek backward 10s"
            >
              <SkipBack className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            <button 
              onClick={togglePlayback}
              disabled={hasError}
              className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all bg-white text-black hover:scale-105 active:scale-95 shadow-xl disabled:opacity-50 ${
                hasError ? 'bg-red-500/20 text-red-500' : ''
              }`}
            >
              {hasError ? <AlertCircle className="w-5 h-5" /> : isPlaying ? <Pause className="w-5 h-5 sm:w-6 sm:h-6 fill-current" /> : <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-current translate-x-0.5" />}
            </button>

            <button 
              onClick={seekForward}
              className="p-1 text-white/40 hover:text-white transition-colors active:scale-90"
              title="Seek forward 10s"
            >
              <SkipForward className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>

          {!isLoaded && audioRef.current && (
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  className="w-1 h-1 rounded-full bg-primary"
                  animate={{ opacity: [0.2, 1, 0.2] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <audio
        ref={audioRef}
        onPlay={handleAudioPlay}
        onPause={handleAudioPause}
        src={safeUrl}
        preload="auto"
        onCanPlay={handleCanPlay}
        onCanPlayThrough={handleCanPlay}
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
