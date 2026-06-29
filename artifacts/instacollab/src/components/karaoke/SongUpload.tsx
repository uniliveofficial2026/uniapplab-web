import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Upload, FileText, Music, Check, X, ArrowRight, ArrowLeft, Play, Pause, FastForward, Info, Timer, Undo, Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { KaraokeUploadInput } from '../../lib/karaokeUploads';

type UploadStep = 'audio' | 'details' | 'lyrics' | 'timing' | 'review';

export const SongUpload = ({
  onClose,
  onUpload,
}: {
  onClose: () => void;
  onUpload?: (song: KaraokeUploadInput) => void | Promise<void>;
}) => {
  const [step, setStep] = useState<UploadStep>('audio');
  const [isDark, setIsDark] = useState(document.documentElement.classList.contains('dark'));
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverUrl, setCoverUrl] = useState<string>('');
  const [isVideo, setIsVideo] = useState(false);
  const [songDetails, setSongDetails] = useState({
    title: '',
    artist: '',
    tags: '',
    credits: '',
    type: 'solo' as 'solo' | 'duet' | 'group',
  });
  const [lyrics, setLyrics] = useState('');
  const [timedLyrics, setTimedLyrics] = useState<{ text: string; time: number; words?: { text: string; time: number }[] }[]>([]);
  const [syncingIndex, setSyncingIndex] = useState(0);
  const [frequencies, setFrequencies] = useState<number[]>(new Array(80).fill(0));
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const audioRef = useRef<HTMLVideoElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (audioRef.current && isPlaying) {
      if (!audioContextRef.current) {
        const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
        audioContextRef.current = new AudioContextClass();
        const source = audioContextRef.current.createMediaElementSource(audioRef.current);
        const analyser = audioContextRef.current.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyser.connect(audioContextRef.current.destination);
        analyserRef.current = analyser;
        dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
      } else if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }

      const updateWaveform = () => {
        if (analyserRef.current && dataArrayRef.current) {
          analyserRef.current.getByteFrequencyData(dataArrayRef.current as Uint8Array<ArrayBuffer>);
          const newFrequencies = [];
          const step = Math.floor(dataArrayRef.current.length / 80);
          for (let i = 0; i < 80; i++) {
            newFrequencies.push(dataArrayRef.current[i * step] || 0);
          }
          setFrequencies(newFrequencies);
        }
        animationFrameRef.current = requestAnimationFrame(updateWaveform);
      };

      animationFrameRef.current = requestAnimationFrame(updateWaveform);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (!isPlaying) {
        setFrequencies(new Array(80).fill(0));
      }
    }

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying]);

  useEffect(() => {
    if (audioFile) {
      const url = URL.createObjectURL(audioFile);
      setAudioUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [audioFile]);

  useEffect(() => {
    if (coverFile) {
      const url = URL.createObjectURL(coverFile);
      setCoverUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [coverFile]);

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAudioFile(file);
      setIsVideo(file.type.startsWith('video/'));
      setStep('details');
    }
  };

  const lyricsLines = lyrics.split('\n').filter(l => l.trim() !== '');
  const lyricWordUnits = useMemo(
    () =>
      lyricsLines.flatMap((line, lineIdx) =>
        line.split(/\s+/).filter(Boolean).map((word, wordIdx) => ({
          lineIdx,
          wordIdx,
          word,
        })),
      ),
    [lyricsLines],
  );
  const totalWords = lyricWordUnits.length;
  const syncedWordsCount = syncingIndex;
  const isPlayingRef = useRef(isPlaying);
  const syncingIndexRef = useRef(syncingIndex);
  const totalWordsRef = useRef(totalWords);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    syncingIndexRef.current = syncingIndex;
  }, [syncingIndex]);

  useEffect(() => {
    totalWordsRef.current = totalWords;
  }, [totalWords]);

  const handleSyncWord = useCallback(() => {
    if (!audioRef.current) return;
    const unit = lyricWordUnits[syncingIndexRef.current];
    if (!unit) return;

    const time = audioRef.current.currentTime;
    setTimedLyrics((prev) => {
      const next = [...prev];
      const existing = next[unit.lineIdx];
      const syncedWords = [...(existing?.words ?? []), { text: unit.word, time }];

      next[unit.lineIdx] = {
        text: lyricsLines[unit.lineIdx]!,
        time: existing?.time ?? time,
        words: syncedWords,
      };
      return next;
    });
    setSyncingIndex((prev) => prev + 1);
  }, [lyricWordUnits, lyricsLines]);

  const handleSyncWordRef = useRef(handleSyncWord);
  useEffect(() => {
    handleSyncWordRef.current = handleSyncWord;
  }, [handleSyncWord]);

  const handleUndoSync = () => {
    if (syncingIndex === 0) return;
    const unit = lyricWordUnits[syncingIndex - 1];
    if (!unit) return;

    setTimedLyrics((prev) => {
      const next = [...prev];
      const line = next[unit.lineIdx];
      if (!line?.words?.length) return prev;

      const words = line.words.slice(0, -1);
      if (words.length === 0) {
        next.splice(unit.lineIdx, 1);
      } else {
        next[unit.lineIdx] = {
          ...line,
          time: words[0]!.time,
          words,
        };
      }
      return next;
    });
    setSyncingIndex((prev) => prev - 1);
  };

  useEffect(() => {
    if (step !== 'timing') return;

    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      return Boolean(
        target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]'),
      );
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.key !== ' ') return;
      if (isEditableTarget(e.target)) return;
      if (!isPlayingRef.current) return;
      if (syncingIndexRef.current >= totalWordsRef.current) return;

      e.preventDefault();
      e.stopImmediatePropagation();
      handleSyncWordRef.current();
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [step]);

  useEffect(() => {
    if (step === 'timing') {
      const container = document.getElementById('sync-scroll-container');
      if (container) {
        const activeLineIdx = lyricWordUnits[syncingIndex]?.lineIdx ?? Math.max(0, lyricsLines.length - 1);
        const activeElement = container.children[activeLineIdx] as HTMLElement;
        if (activeElement) {
          container.scrollTo({
            top: activeElement.offsetTop - container.offsetHeight / 2 + activeElement.offsetHeight / 2,
            behavior: 'smooth'
          });
        }
      }
    }
  }, [syncingIndex, step, lyricWordUnits, lyricsLines.length]);

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="bg-card w-full max-w-2xl rounded-[2.5rem] overflow-hidden shadow-2xl border border-border flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-8 py-6 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Upload to K-Star</h2>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex gap-1">
                {['audio', 'details', 'lyrics', 'timing', 'review'].map((s, i) => (
                  <div 
                    key={s} 
                    className={`h-1 w-6 rounded-full ${(['audio', 'details', 'lyrics', 'timing', 'review'].indexOf(step) >= i) ? 'bg-primary' : 'bg-muted'}`} 
                  />
                ))}
              </div>
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest ml-2">Step {['audio', 'details', 'lyrics', 'timing', 'review'].indexOf(step) + 1} of 5</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                const newDark = !isDark;
                setIsDark(newDark);
                document.documentElement.classList.toggle('dark', newDark);
              }}
              className="w-10 h-10 flex items-center justify-center bg-muted/50 hover:bg-muted rounded-full transition-all active:scale-90 text-muted-foreground hover:text-foreground border border-border"
              title="Toggle Theme"
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button 
              onClick={onClose} 
              className="w-10 h-10 flex items-center justify-center hover:bg-muted rounded-full transition-colors text-muted-foreground"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <AnimatePresence mode="wait">
            {step === 'audio' && (
              <motion.div 
                key="audio"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.1 }}
                className="space-y-8 py-12 text-center"
              >
                <div className="w-32 h-32 bg-primary/20 rounded-[2rem] flex items-center justify-center mx-auto mb-6 border-2 border-dashed border-primary/40 group relative overflow-hidden">
                  <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <Music className="w-12 h-12 text-primary" />
                </div>
                <div className="space-y-4">
                  <h3 className="text-3xl font-black tracking-tight">Drop your backing track</h3>
                  <p className="text-muted-foreground max-w-sm mx-auto text-lg">
                    Upload an MP3, M4A, or Video backing track. We'll handle the rest.
                  </p>
                </div>
                <label className="inline-flex items-center gap-3 px-10 py-5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl font-black text-lg cursor-pointer transition-all shadow-xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98]">
                  <Upload className="w-6 h-6" />
                  <span>CHOOSE BACKING FILE</span>
                  <input type="file" accept="audio/*,video/*" className="hidden" onChange={handleAudioUpload} />
                </label>
                <p className="text-xs text-muted-foreground font-medium">Recommended: Constant bitrate, 44.1kHz</p>
              </motion.div>
            )}

            {step === 'details' && (
              <motion.div 
                key="details"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div className="flex flex-col md:flex-row gap-8">
                  {/* Cover Upload Area */}
                  <div className="w-full md:w-48 space-y-2">
                    <label className="text-[11px] font-black tracking-widest text-muted-foreground ml-1">COVER ART</label>
                    <label className="block w-full aspect-square bg-muted border-2 border-dashed border-border rounded-[2.5rem] overflow-hidden cursor-pointer hover:border-primary/40 transition-all group relative">
                      {coverUrl ? (
                        <img src={coverUrl} alt="Cover Preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
                          <Upload className="w-8 h-8 opacity-40 group-hover:opacity-80 transition-opacity" />
                          <span className="text-[10px] font-black uppercase tracking-tighter">Choose Image</span>
                        </div>
                      )}
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setCoverFile(e.target.files[0]);
                          }
                        }} 
                      />
                      {coverUrl && (
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Upload className="w-8 h-8 text-white" />
                        </div>
                      )}
                    </label>
                  </div>

                  <div className="flex-1 space-y-6">
                    <div className="space-y-2">
                      <label className="text-[11px] font-black tracking-widest text-muted-foreground ml-1">SONG TITLE</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Someone Like You" 
                        className="w-full p-5 bg-muted border border-border rounded-2xl focus:border-primary/50 outline-none text-base transition-all font-bold"
                        value={songDetails.title}
                        onChange={(e) => setSongDetails({ ...songDetails, title: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-black tracking-widest text-muted-foreground ml-1">ARTIST NAME</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Adele" 
                        className="w-full p-5 bg-muted border border-border rounded-2xl focus:border-primary/50 outline-none text-base transition-all font-bold"
                        value={songDetails.artist}
                        onChange={(e) => setSongDetails({ ...songDetails, artist: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[11px] font-black tracking-widest text-muted-foreground ml-1">SONG TYPE</label>
                       <div className="flex gap-2">
                         {(['solo', 'duet', 'group'] as const).map((t) => (
                           <button
                             key={t}
                             onClick={() => setSongDetails({ ...songDetails, type: t })}
                             type="button"
                             className={`flex-1 py-3 rounded-xl font-bold border transition-all ${
                               songDetails.type === t 
                                 ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20' 
                                 : 'bg-muted border-border text-muted-foreground hover:border-primary/50'
                             }`}
                           >
                             <span className="capitalize">{t}</span>
                           </button>
                         ))}
                       </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-black tracking-widest text-muted-foreground ml-1">TAGS</label>
                  <input 
                    type="text" 
                    placeholder="pop, ballad, soul" 
                    className="w-full p-5 bg-muted border border-border rounded-2xl focus:border-primary/50 outline-none text-base transition-all font-bold"
                    value={songDetails.tags}
                    onChange={(e) => setSongDetails({ ...songDetails, tags: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black tracking-widest text-muted-foreground ml-1">ADDITIONAL CREDITS</label>
                  <textarea 
                    placeholder="Track producers, instrumentalists, etc..." 
                    className="w-full h-32 p-5 bg-muted border border-border rounded-2xl focus:border-primary/50 outline-none text-base resize-none font-bold"
                    value={songDetails.credits}
                    onChange={(e) => setSongDetails({ ...songDetails, credits: e.target.value })}
                  />
                </div>
                <div className="pt-6 flex gap-4">
                  <button onClick={() => setStep('audio')} className="flex-1 py-5 bg-muted hover:bg-muted/80 rounded-2xl font-black text-sm transition-all">BACK</button>
                  <button 
                    disabled={!songDetails.title || !songDetails.artist}
                    onClick={() => setStep('lyrics')} 
                    className="flex-[2] py-5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl font-black text-sm transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    CONTINUE <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 'lyrics' && (
              <motion.div 
                key="lyrics"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-black tracking-widest text-muted-foreground ml-1 uppercase">Enter Lyrics Text</label>
                  <span className="text-[10px] font-black bg-primary/10 text-primary px-3 py-1 rounded-full">{lyricsLines.length} LINES FOUND</span>
                </div>
                <div className="relative">
                  <textarea 
                    placeholder="Type or paste lyrics here.
Each line will be timed separately." 
                    className="w-full h-[350px] p-6 bg-muted border border-border rounded-[2rem] focus:border-primary/50 outline-none text-lg font-bold leading-relaxed resize-none scrollbar-hide"
                    value={lyrics}
                    onChange={(e) => setLyrics(e.target.value)}
                  />
                  <div className="absolute bottom-6 right-6 p-2 bg-card/80 rounded-xl border border-border">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                  </div>
                </div>
                <div className="pt-4 flex gap-4">
                  <button onClick={() => setStep('details')} className="flex-1 py-5 bg-muted hover:bg-muted/80 rounded-2xl font-black text-sm transition-all">BACK</button>
                  <button 
                    disabled={!lyrics.trim()}
                    onClick={() => setStep('timing')} 
                    className="flex-[2] py-5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl font-black text-sm transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    START TIMING <Timer className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 'timing' && (
              <motion.div 
                key="timing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col h-[600px] -mx-8 -mt-8 -mb-8 overflow-hidden"
              >
                <div className="flex-1 flex flex-col overflow-hidden bg-background">
                  {/* Studio Waveform Display - Top edge-to-edge */}
                  <div className="h-[220px] bg-card border-b border-border relative overflow-hidden flex items-end justify-center px-0 shadow-lg transition-all group shrink-0 -mt-[30px] mb-0">
                    {isVideo && (
                      <video 
                        src={audioUrl}
                        className="absolute inset-0 w-full h-full object-cover opacity-30 grayscale"
                        muted
                        autoPlay
                        loop
                        playsInline
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-primary/10 via-transparent to-transparent pointer-events-none" />
                    <div className="absolute top-10 left-10 flex items-center gap-3 z-20 bg-background/80 backdrop-blur-xl px-6 py-3 rounded-full border border-border shadow-2xl">
                      <div className={`w-3 h-3 rounded-full ${isPlaying ? 'bg-emerald-500 animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.7)]' : 'bg-muted-foreground/30'}`} />
                      <span className="text-[12px] font-black text-foreground tracking-[0.4em] uppercase opacity-90">Studio Signal</span>
                    </div>
                    
                    <div className="flex items-end justify-center h-[190px] w-full gap-1 px-8 pb-4">
                      {frequencies.map((freq, i) => (
                        <motion.div 
                          key={i}
                          animate={{ 
                            height: isPlaying ? Math.max(12, (freq / 255) * 160) : 12,
                            opacity: isPlaying ? Math.max(0.4, freq / 255) : 0.15,
                            backgroundColor: isPlaying 
                              ? (freq < 85 ? '#eab308' : freq < 185 ? '#22c55e' : '#ef4444')
                              : '#9ca3af'
                          }}
                          transition={{ 
                            type: "spring",
                            stiffness: 300,
                            damping: 20,
                            backgroundColor: { duration: 0.1 }
                          }}
                          className="flex-1 min-w-[2px] rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.1)]"
                        />
                      ))}
                    </div>
                  </div>
                  
                  {/* Lyrics Syncing Area */}
                  <div className="flex-1 bg-muted/10 overflow-hidden flex flex-col relative">
                    <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-background via-background/20 to-transparent z-10 pointer-events-none" />
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-background/90 backdrop-blur-xl px-5 py-2 rounded-full border border-border text-[11px] font-black uppercase tracking-[0.25em] text-muted-foreground">
                      Word sync {Math.min(syncedWordsCount, totalWords)} / {totalWords}
                    </div>
                    <div className="flex-1 overflow-y-auto p-10 pt-20 pb-32 scroll-smooth" id="sync-scroll-container">
                      {lyricsLines.map((line, i) => {
                        const lineWords = line.split(/\s+/).filter(Boolean);
                        const syncedForLine = timedLyrics[i]?.words?.length ?? 0;
                        const isLineComplete = syncedForLine >= lineWords.length && lineWords.length > 0;
                        const isLineActive = lyricWordUnits[syncingIndex]?.lineIdx === i;

                        return (
                        <div 
                          key={i} 
                          className={`py-7 px-10 rounded-[2.5rem] text-2xl transition-all duration-700 mb-5 flex items-center justify-between border border-transparent ${
                            isLineComplete ? 'opacity-25 scale-[0.98] blur-[0.5px]' : 
                            isLineActive ? 'bg-primary text-primary-foreground font-black shadow-[0_30px_70px_rgba(239,68,68,0.4)] scale-105 z-20 relative border-primary shadow-2xl animate-pulse-subtle' : 
                            'bg-background/40 text-foreground/30 font-bold border-border/5'
                          }`}
                        >
                          <span className="flex-1 break-words leading-relaxed mr-10">
                            {lineWords.map((word, wIdx) => {
                              const isSynced = wIdx < syncedForLine;
                              const isCurrent = isLineActive && lyricWordUnits[syncingIndex]?.wordIdx === wIdx;
                              return (
                                <span
                                  key={`${i}-${wIdx}`}
                                  className={`mr-2 inline-block transition-all duration-200 ${
                                    isCurrent
                                      ? 'underline decoration-2 underline-offset-4 scale-110'
                                      : isSynced
                                        ? 'opacity-70'
                                        : ''
                                  }`}
                                >
                                  {word}
                                </span>
                              );
                            })}
                          </span>
                          <div className="shrink-0">
                            {isLineComplete ? (
                              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                                <Check className="w-6 h-6 text-emerald-500" />
                              </div>
                            ) : isLineActive ? (
                              <ArrowRight className="w-10 h-10 animate-pulse" />
                            ) : null}
                          </div>
                        </div>
                        );
                      })}
                      {syncingIndex >= totalWords && totalWords > 0 && (
                        <div className="py-24 flex flex-col items-center justify-center gap-6 text-center animate-in fade-in zoom-in duration-1000">
                          <motion.div 
                             initial={{ scale: 0, rotate: -45 }}
                             animate={{ scale: 1, rotate: 0 }}
                             className="w-28 h-28 bg-emerald-500/20 rounded-[2.5rem] flex items-center justify-center border-4 border-emerald-500 shadow-[0_0_40px_rgba(16,185,129,0.3)]"
                          >
                              <Check className="w-14 h-14 text-emerald-500" />
                          </motion.div>
                          <div className="space-y-2">
                            <h4 className="text-4xl font-black tracking-tight">Vocal Sync Complete!</h4>
                            <p className="text-muted-foreground font-bold uppercase text-xs tracking-[0.4em]">Performance looks professional</p>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-background via-background/80 to-transparent z-10 pointer-events-none" />
                  </div>
                </div>

                {/* Fixed Control Bar - Bottom edge-to-edge */}
                <div className="flex items-center justify-center gap-8 pt-[15px] mt-0 border-t border-border pr-10 pl-10 bg-card/90 backdrop-blur-2xl pb-[15px] shadow-[0_-20px_40px_rgba(0,0,0,0.1)] mb-0">
                  <button 
                    onClick={() => {
                      if (audioRef.current) audioRef.current.pause();
                      setStep('lyrics');
                    }} 
                    className="w-16 h-16 flex items-center justify-center bg-muted rounded-full hover:bg-muted/80 transition-all border border-border group shrink-0 active:scale-90"
                    title="Back to Lyrics"
                  >
                    <ArrowLeft className="w-7 h-7 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </button>

                  <button 
                    onClick={() => {
                        if (audioRef.current) {
                          if (isPlaying) {
                            audioRef.current.pause();
                          } else {
                            audioRef.current.play().catch(console.error);
                          }
                        }
                    }}
                    className={`w-20 h-20 flex items-center justify-center border-2 rounded-full transition-all duration-300 shrink-0 shadow-xl ${
                      isPlaying 
                        ? 'bg-primary/20 border-primary text-primary shadow-primary/20' 
                        : 'bg-muted border-border text-foreground hover:border-primary/50'
                    }`}
                  >
                    {isPlaying ? <Pause className="w-9 h-9 fill-current" /> : <Play className="w-9 h-9 fill-primary text-primary ml-1.5" />}
                  </button>

                  <button 
                    disabled={syncingIndex === 0}
                    onClick={handleUndoSync}
                    className="w-16 h-16 flex items-center justify-center bg-muted rounded-full hover:bg-muted/80 transition-all border border-border group shrink-0 active:scale-95 disabled:opacity-30"
                    title="Undo Last Sync"
                  >
                    <Undo className="w-7 h-7 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </button>

                  <motion.button 
                    disabled={!isPlaying || syncingIndex >= totalWords}
                    onClick={handleSyncWord}
                    whileTap={{ scale: 0.8 }}
                    className={`w-20 h-20 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full font-black transition-all shadow-2xl shadow-primary/40 active:scale-95 disabled:opacity-30 disabled:grayscale flex flex-col items-center justify-center gap-0.5 shrink-0 ${isPlaying ? 'ring-8 ring-primary/20 scale-105' : ''}`}
                  >
                    <div className="relative">
                      <Timer className={`w-9 h-9 ${isPlaying ? 'animate-pulse' : ''}`} />
                      {isPlaying && (
                        <motion.div 
                          className="absolute inset-0 rounded-full bg-white/20"
                          initial={{ scale: 1, opacity: 0.5 }}
                          animate={{ scale: 2, opacity: 0 }}
                          transition={{ repeat: Infinity, duration: 1 }}
                        />
                      )}
                    </div>
                    <span className="text-[9px] font-black tracking-[0.2em] opacity-90 uppercase mt-0.5">Sync</span>
                    <span className="text-[7px] font-bold tracking-widest opacity-70 uppercase">Space</span>
                  </motion.button>

                  <button 
                    disabled={syncingIndex < totalWords}
                    onClick={() => {
                      if (audioRef.current) audioRef.current.pause();
                      setStep('review');
                    }} 
                    className="w-16 h-16 flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 text-white rounded-full transition-all shadow-2xl shadow-indigo-600/40 disabled:opacity-30 disabled:grayscale active:scale-95 shrink-0"
                    title="Review & Publish"
                  >
                    <Check className="w-8 h-8" />
                  </button>
                </div>

                <video 
                  ref={audioRef}
                  src={audioUrl || ''} 
                  crossOrigin="anonymous"
                  className="hidden"
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                />
              </motion.div>
            )}

            {step === 'review' && (
              <motion.div 
                key="review"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-8 py-4"
              >
                <div className="bg-muted rounded-[3rem] p-8 border border-border space-y-8 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8">
                    <div className="bg-primary/20 text-primary text-[10px] font-black px-4 py-1.5 rounded-full border border-primary/30 uppercase tracking-[0.2em]">Ready to sing</div>
                  </div>
                  
                  <div className="flex flex-col md:flex-row gap-8 items-center md:items-start text-center md:text-left">
                    <div className="w-40 h-40 bg-card rounded-[2.5rem] flex items-center justify-center border border-border shadow-2xl shrink-0 group relative overflow-hidden">
                      {coverUrl ? (
                         <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
                      ) : (
                        <Music className="w-12 h-12 text-muted-foreground/40" />
                      )}
                      <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Upload className="w-8 h-8 text-primary-foreground" />
                      </div>
                    </div>
                    <div className="flex-1 space-y-4">
                      <div>
                        <h3 className="text-4xl font-black leading-tight tracking-tight text-foreground">{songDetails.title || 'Classic Rock Track'}</h3>
                        <p className="text-primary text-xl font-black mt-1 italic">{songDetails.artist || 'Legendary Artist'}</p>
                      </div>
                      
                      <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                        {(songDetails.tags || 'karaoke, studio, hd').split(',').map((tag, i) => (
                          <span key={i} className="text-[10px] font-black bg-background/50 px-4 py-1.5 rounded-full text-muted-foreground border border-border uppercase tracking-wider">#{tag.trim()}</span>
                        ))}
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                        <div className="bg-card p-4 rounded-2xl border border-border">
                          <span className="text-[10px] font-black text-muted-foreground block uppercase mb-1">Duration</span>
                          <span className="text-sm font-bold">3:42</span>
                        </div>
                        <div className="bg-card p-4 rounded-2xl border border-border">
                          <span className="text-[10px] font-black text-muted-foreground block uppercase mb-1">Lyrics</span>
                          <span className="text-sm font-bold">{lyricsLines.length} lines</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button onClick={() => setStep('timing')} className="flex-1 py-6 bg-muted hover:bg-muted/80 rounded-2xl font-black text-sm border border-border transition-all uppercase tracking-widest">Adjust Timing</button>
                  <button 
                    onClick={() => {
                      void (async () => {
                        const payload: KaraokeUploadInput = {
                          id: `u_${Date.now()}`,
                          title: songDetails.title || 'Untitled',
                          artist: songDetails.artist || 'Unknown Artist',
                          type: songDetails.type,
                          tags: songDetails.tags,
                          lyrics,
                          timedLyrics,
                          img: coverUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=60',
                          audioFile,
                          coverFile,
                          mediaKind: isVideo ? 'video' : 'audio',
                        };
                        if (onUpload) {
                          await onUpload(payload);
                        }
                        window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Song saved to My Uploads! 🚀' }));
                        onClose();
                      })();
                    }}
                    className="flex-[2] py-6 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-lg transition-all shadow-2xl shadow-emerald-600/40 hover:scale-[1.02] active:scale-[0.98] uppercase tracking-widest"
                  >
                    Publish Song
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};
