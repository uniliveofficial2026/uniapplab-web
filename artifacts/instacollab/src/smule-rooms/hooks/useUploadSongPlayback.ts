import { useEffect, useRef, useState } from 'react';
import { loadKaraokeUploadMedia } from '../../lib/karaokeUploads';
import { formatTrackTime } from '../utils/songPerformance';
import { getUploadMetaById, isKaraokeUploadSongId } from '../utils/karaokeUploadBridge';

type UploadSongPlaybackOptions = {
  active: boolean;
  playing: boolean;
  songKey: string | null;
  onComplete?: () => void;
};

/** Plays the user's uploaded karaoke track and drives elapsed time from the audio clock. */
export function useUploadSongPlayback({
  active,
  playing,
  songKey,
  onComplete,
}: UploadSongPlaybackOptions) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const [elapsedSec, setElapsedSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [isReady, setIsReady] = useState(false);

  const isUploadSong = Boolean(songKey && isKaraokeUploadSongId(songKey));

  useEffect(() => {
    if (!songKey || !isUploadSong) {
      setIsReady(false);
      setElapsedSec(0);
      setDurationSec(0);
      return;
    }

    let cancelled = false;
    setIsReady(false);
    setElapsedSec(0);

    const meta = getUploadMetaById(songKey);
    if (meta?.durationSec) {
      setDurationSec(meta.durationSec);
    }

    void loadKaraokeUploadMedia(songKey).then((media) => {
      if (cancelled || !media) return;

      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }

      const url = URL.createObjectURL(media.blob);
      objectUrlRef.current = url;

      const audio = audioRef.current;
      if (!audio) return;

      audio.src = url;
      audio.load();
      setIsReady(true);
    });

    return () => {
      cancelled = true;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      }
      setIsReady(false);
    };
  }, [songKey, isUploadSong]);

  useEffect(() => {
    setElapsedSec(0);
    const audio = audioRef.current;
    if (audio && isReady) {
      audio.currentTime = 0;
    }
  }, [songKey, isReady]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !isReady || !active) return;

    const onLoadedMetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDurationSec(audio.duration);
      }
    };
    const onTimeUpdate = () => setElapsedSec(audio.currentTime);
    const onEnded = () => {
      setElapsedSec(audio.duration || durationSec);
      onCompleteRef.current?.();
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);

    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      setDurationSec(audio.duration);
    }

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, [active, isReady]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !isReady) return;

    if (!active || !playing) {
      audio.pause();
      if (!active) {
        audio.currentTime = 0;
        setElapsedSec(0);
      }
      return;
    }

    void audio.play().catch(() => undefined);
  }, [active, playing, isReady]);

  const safeDuration = durationSec > 0 ? durationSec : 1;
  const progressPercent = Math.min(100, (elapsedSec / safeDuration) * 100);

  return {
    audioRef,
    isUploadSong,
    isReady,
    elapsedSec,
    durationSec,
    progressPercent,
    elapsedLabel: formatTrackTime(elapsedSec),
    totalLabel: formatTrackTime(durationSec),
  };
}
