import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, AlertCircle } from 'lucide-react';
import { Waveform } from './Waveform';
import { useToast } from '../../lib/ToastContext';

export function VoiceMessagePlayer({ url, color = 'primary' }: { url: string, color?: 'primary' | 'secondary' }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressIntervalRef = useRef<number | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    // Reset if URL changes
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      setProgress(0);
      setIsLoaded(false);
      setHasError(false);
      audioRef.current.load();
    }
  }, [url]);

  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  const updateProgress = () => {
    if (audioRef.current) {
      const p = audioRef.current.currentTime / audioRef.current.duration;
      setProgress(p || 0);
    }
  };

  const handleError = () => {
    if (audioRef.current && audioRef.current.error) {
      console.error('Audio playback error:', audioRef.current.error.code);
      setIsPlaying(false);
      setIsLoaded(true); 
      setHasError(true);
      showToast('Unable to play voice message. The file may have expired or is in an unsupported format.');
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    }
  };

  const handleLoadStart = () => {
    setIsLoaded(false);
    setHasError(false);
  };

  const handleCanPlay = () => {
    setIsLoaded(true);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(0);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
  };

  const togglePlayback = () => {
    if (!url || !audioRef.current || hasError) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    } else {
      setIsPlaying(true);
      progressIntervalRef.current = window.setInterval(updateProgress, 100);
      audioRef.current.play().catch((err) => {
        console.error("Playback failed");
        setIsPlaying(false);
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        if (err && err.name !== 'NotAllowedError') {
          setHasError(true);
        }
      });
    }
  };

  const barColor = color === 'primary' ? 'bg-primary-foreground' : 'bg-primary';

  return (
    <div className="flex items-center gap-3 w-full min-h-[32px]">
      <button 
        type="button" 
        onClick={togglePlayback}
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shrink-0 ${
          color === 'primary' ? 'bg-primary-foreground text-primary' : 'bg-primary text-white'
        } ${!isLoaded && audioRef.current ? 'animate-pulse opacity-70' : ''} ${hasError ? 'bg-red-500/20 text-red-500' : ''}`}
      >
        {hasError ? <AlertCircle className="w-4 h-4" /> : isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 translate-x-0.5" />}
      </button>
      <div className="flex-1">
        <Waveform isPlaying={isPlaying} color={barColor} progress={progress} />
      </div>

      <audio
        ref={audioRef}
        src={url}
        preload="auto"
        onCanPlayThrough={handleCanPlay}
        onLoadStart={handleLoadStart}
        onError={handleError}
        onEnded={handleEnded}
        className="hidden"
      />
    </div>
  );
}
