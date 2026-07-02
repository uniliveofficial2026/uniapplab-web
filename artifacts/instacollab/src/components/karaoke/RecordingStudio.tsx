import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { 
  Mic, 
  Video, 
  Settings2, 
  Play, 
  Pause, 
  X, 
  Wand2, 
  Users, 
  Volume2, 
  Disc, 
  ChevronLeft,
  Sparkles,
  Camera,
  Activity,
  Smile,
  Layers,
  Upload,
  Type,
  Music,
  MoreVertical,
  Maximize2,
  Minimize2,
  Eye,
  EyeOff,
  RotateCcw,
  Square,
  Loader2,
} from 'lucide-react';
import {
  activeLyricIndexForTime,
  activeWordIndexForLine,
  activeWordSpikeAtTime,
  buildStudioWordSpikes,
  spikeLaneCenterY,
  enrichUploadedKaraokeSong,
  firstVisibleSpikeIndex,
  hasPreciseTimedLyrics,
  isUploadedVideoTrack,
  lyricLineProgressPercent,
  studioLyricsFromUpload,
  usesTimedLyricSync,
  wordIndexOnLineFromSpikes,
} from '../../lib/karaokeUploadSession';
import {
  computeRmsVolume,
  detectPitchHz,
  pitchDeltaLane,
  smoothLanePitch,
  vocalHzToLanePitch,
} from '../../lib/karaokePitchDetection';
import {
  VOICE_PRESET_DEFINITIONS,
  VIDEO_BEAUTY_FILTERS,
  VIDEO_BACKGROUNDS,
  CUSTOM_VIDEO_BACKGROUND,
  backgroundPickerThumbUrl,
  applyStudioFilterToEq,
  buildAiSuggestions,
  computeLiveVocalMetrics,
  type VoicePresetName,
} from '../../lib/karaokeStudioPresets';
import {
  closePersonSegmenter,
  ensurePersonSegmenter,
  nextSegmentTimestamp,
  resetPersonSegmentState,
} from '../../lib/karaokePersonSegmentation';
import {
  buildCompositorCaptureStream,
  cancelVideoCompositorFrame,
  composeKaraokeVideoFrame,
  createCompositorScratch,
  disposeCompositorScratch,
  loadCompositorBackground,
  paintStudioVideoTabPreviews,
  scheduleVideoCompositorFrame,
  VIRTUAL_BACKGROUND_MIN_SHORT_EDGE,
  VIRTUAL_BACKGROUND_IDEAL_SHORT_EDGE,
  backgroundSourceSize,
  decodeBackgroundFile,
  type CompositorBackgroundSource,
  type RgbColor,
} from '../../lib/karaokeVideoCompositor';
import { saveKaraokeCoverRecording, type KaraokeCoverRecordingMeta } from '../../lib/karaokeRecordings';
import { VirtualBackgroundLayer } from './VirtualBackgroundLayer';
import { BackgroundPickerImage } from './BackgroundPickerImage';
import { DeepAREffectPicker } from '../deepar/DeepAREffectPicker';
import { isDeepARConfigured } from '../../lib/deepar/deeparConfig';
import { useDeepAR } from '../../lib/deepar/useDeepAR';
import { useCurrentUser } from '../../lib/useCurrentUser';
import { useDB } from '../../lib/useDB';
import { safeAvatarUrl } from '../../lib/safe';
import { handleAvatarError } from '../../lib/utils';

const STUDIO_CAPTION_HASHTAGS = ['#karaoke', '#cover', '#singing', '#fyp', '#music', '#vocals'];

const DEFAULT_STUDIO_LYRICS = [
  { time: 0, text: "There goes my heart", singer: 'both', part: 1, chord: "C Maj" },
  { time: 3, text: "beating", singer: 'both', part: 1, chord: "G Maj" },
  { time: 6, text: "Cause you are the reason", singer: 'singer1', part: 1, chord: "A Min" },
  { time: 10, text: "I'm losing my sleep", singer: 'singer1', part: 1, chord: "F Maj" },
  { time: 14, text: "Please come back now", singer: 'singer1', part: 1, chord: "G Maj" },
  { time: 18, text: "There goes my mind", singer: 'singer1', part: 2, chord: "C Maj" },
  { time: 21, text: "racing", singer: 'singer1', part: 2, chord: "E Min" },
  { time: 24, text: "And you are the reason", singer: 'singer2', part: 2, chord: "A Min" },
  { time: 28, text: "That I'm still breathing", singer: 'singer2', part: 2, chord: "F Maj" },
  { time: 32, text: "I'm hopeless now", singer: 'singer2', part: 2, chord: "G Maj" },
  { time: 36, text: "I'd climb every mountain", singer: 'singer1', part: 2, chord: "A Min" },
  { time: 40, text: "And swim every ocean", singer: 'singer2', part: 2, chord: "F Maj" },
  { time: 44, text: "Just to be with you", singer: 'both', part: 2, chord: "C Maj" },
  { time: 48, text: "And fix what I've broken", singer: 'both', part: 3, chord: "G Maj" },
  { time: 52, text: "Cause I need you to see", singer: 'singer1', part: 4, chord: "A Min" },
  { time: 56, text: "That you are the reason", singer: 'both', part: 1, chord: "F Maj" }
];

function formatMediaClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function finiteMediaDuration(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

interface RecordingStudioProps {
  song: any;
  onClose: () => void;
  onPublished?: (meta: KaraokeCoverRecordingMeta) => void;
}

export function RecordingStudio({ song, onClose, onPublished }: RecordingStudioProps) {
  const appUser = useCurrentUser();
  const db = useDB();
  const [resolvedAudioUrl, setResolvedAudioUrl] = useState<string | null>(song?.audioUrl ?? null);
  const [sessionDurationSec, setSessionDurationSec] = useState<number>(song?.durationSec ?? 120);
  const [isVideoBacking, setIsVideoBacking] = useState(() => isUploadedVideoTrack(song ?? {}));
  const [playbackSec, setPlaybackSec] = useState(0);
  const backingMediaRef = useRef<HTMLMediaElement | null>(null);

  const sessionLyrics = useMemo(() => {
    if (song?.isUploaded || song?.timedLyrics?.length || song?.lyrics) {
      return studioLyricsFromUpload(song);
    }
    return DEFAULT_STUDIO_LYRICS;
  }, [song]);

  const hasBackingAudio = Boolean(resolvedAudioUrl);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeTab, setActiveTab] = useState<'effects' | 'mix' | 'video' | 'duet' | 'analysis'>('effects');
  const activeTabRef = useRef(activeTab);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [duetMode, setDuetMode] = useState(false);
  const [groupMode, setGroupMode] = useState(false);
  const [groupModeType, setGroupModeType] = useState<'default' | 'just_sing'>('default');
  const [selectedPart, setSelectedPart] = useState<number>(1);
  const [score, setScore] = useState(0);
  const [lyricsSize, setLyricsSize] = useState<'sm' | 'md' | 'lg'>('md');
  const [micVolume, setMicVolume] = useState<number>(0);
  const [micPitch, setMicPitch] = useState<number>(0);
  const [isFullScreenLyrics, setIsFullScreenLyrics] = useState(true);
  const lyricsViewportRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const compositorCanvasRef = useRef<HTMLCanvasElement>(null);
  const recorderCanvasRef = useRef<HTMLCanvasElement>(null);
  const compositorScratchRef = useRef<ReturnType<typeof createCompositorScratch> | null>(null);
  const videoBgImageRef = useRef<CompositorBackgroundSource | null>(null);
  const compositorRecorderStartedRef = useRef(false);
  const deeparRecorderStartedRef = useRef(false);
  const filterPreviewCanvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});
  const noneBgPreviewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const backgroundImagesCacheRef = useRef<Record<string, CompositorBackgroundSource>>({});
  const sharedMattingBgRef = useRef<RgbColor | null>(null);

  const syncLyricsToUpload = usesTimedLyricSync(song ?? {}, sessionLyrics);
  const preciseTimedLyrics = hasPreciseTimedLyrics(song ?? {});
  const wordSpikes = useMemo(
    () => buildStudioWordSpikes(sessionLyrics, sessionDurationSec),
    [sessionLyrics, sessionDurationSec],
  );
  const activeWordSpikeRef = useRef<ReturnType<typeof activeWordSpikeAtTime>>(null);
  const isTrackLockedRef = useRef(false);
  const hasBackingAudioRef = useRef(hasBackingAudio);

  const lyricLineHeight = useMemo(() => {
    const base = isFullScreenLyrics ? (syncLyricsToUpload ? 72 : 64) : (syncLyricsToUpload ? 52 : 42);
    if (lyricsSize === 'sm') return Math.max(36, base - 12);
    if (lyricsSize === 'lg') return base + 16;
    return base;
  }, [isFullScreenLyrics, lyricsSize, syncLyricsToUpload]);

  // Advanced Real-time Audio Editing & Sync States
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [editingTab, setEditingTab] = useState<'mixer' | 'tuning' | 'effects' | 'trimming'>('mixer');
  const [vocalVolume, setVocalVolume] = useState<number>(100);
  const [reverbValue, setReverbValue] = useState<number>(30);
  const [autoTuneStrength, setAutoTuneStrength] = useState<number>(45);
  const [recordedVocalTrim, setRecordedVocalTrim] = useState<{ start: number; end: number }>({ start: 5, end: 95 });
  const [vocalDelayMs, setVocalDelayMs] = useState<number>(0);
  const [selectedSoundFX, setSelectedSoundFX] = useState<string | null>(null);
  const [selectedStudioFilter, setSelectedStudioFilter] = useState<string>('Studio Room');
  const [activeVoicePreset, setActiveVoicePreset] = useState<VoicePresetName>('Studio');
  const [videoBeautyFilter, setVideoBeautyFilter] = useState<string>('None');
  const [deeparEffectId, setDeeparEffectId] = useState('none');
  const deeparPreviewRef = useRef<HTMLDivElement>(null);
  const deeparActiveRef = useRef(false);
  const [videoBackground, setVideoBackground] = useState<string | null>(null);
  const [customBackgroundUrl, setCustomBackgroundUrl] = useState<string | null>(null);
  const [customBackgroundLabel, setCustomBackgroundLabel] = useState('My Photo');
  const customBgInputRef = useRef<HTMLInputElement>(null);
  const [vocalPitchShift, setVocalPitchShift] = useState<number>(0);
  const [noiseReduction, setNoiseReduction] = useState<number>(50);
  const [vocalPresence, setVocalPresence] = useState<number>(62);
  const [backingVolume, setBackingVolume] = useState<number>(80);
  const [vibratoPresence, setVibratoPresence] = useState<number>(40);
  const [isWorkspacePlaying, setIsWorkspacePlaying] = useState(false);
  const [workspaceTime, setWorkspaceTime] = useState(0);
  const [workspaceDuration, setWorkspaceDuration] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [isPublishing, setIsPublishing] = useState(false);
  const [studioPublishStep, setStudioPublishStep] = useState<'workstation' | 'caption'>('workstation');
  const [publishCaption, setPublishCaption] = useState('');
  const [showCaptionHashtagList, setShowCaptionHashtagList] = useState(false);
  const [showCaptionMentionList, setShowCaptionMentionList] = useState(false);
  const [captionMentionSearch, setCaptionMentionSearch] = useState('');
  const [videoBgReady, setVideoBgReady] = useState(false);

  const virtualBgDisplayUrl = useMemo(() => {
    if (!videoBackground) return null;
    if (videoBackground === CUSTOM_VIDEO_BACKGROUND) return customBackgroundUrl;
    return VIDEO_BACKGROUNDS[videoBackground] ?? null;
  }, [videoBackground, customBackgroundUrl]);

  const reportBackgroundDisplaySize = useCallback((width: number, height: number) => {
    const shortEdge = Math.min(width, height);
    if (shortEdge < VIRTUAL_BACKGROUND_MIN_SHORT_EDGE) {
      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: `Background displaying at ${width}×${height} — file is too small. Use 3840×2160 or 7680×4320 for a clear image.`,
      }));
    }
  }, []);

  // Real-time Track Detection / Pitch State
  const [isTrackLocked, setIsTrackLocked] = useState(false);
  const [showChords, setShowChords] = useState(true);
  const [showPitchHUD, setShowPitchHUD] = useState(true);
  const [vocalBlobUrl, setVocalBlobUrl] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Array<{ x: number; y: number; vx: number; vy: number; size: number; alpha: number; color: string }>>([]);
  const playbackSecRef = useRef(0);
  const wordSpikesRef = useRef<ReturnType<typeof buildStudioWordSpikes>>([]);
  const micVolumeRef = useRef(0);
  const micPitchRef = useRef(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const isPlayingRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const isAcquiringStreamRef = useRef(false);
  const cameraEnabledRef = useRef(cameraEnabled);
  const exportIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const vocalBlobRevokeRef = useRef<string | null>(null);
  const autoTuneStrengthRef = useRef(autoTuneStrength);
  const lastScoreBumpRef = useRef(0);
  const videoBeautyFilterRef = useRef(videoBeautyFilter);
  const videoBackgroundRef = useRef(videoBackground);
  const videoBgReadyRef = useRef(videoBgReady);

  useEffect(() => {
    videoBeautyFilterRef.current = videoBeautyFilter;
  }, [videoBeautyFilter]);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    videoBackgroundRef.current = videoBackground;
  }, [videoBackground]);

  useEffect(() => {
    videoBgReadyRef.current = videoBgReady;
  }, [videoBgReady]);

  const deeparActive = deeparEffectId !== 'none' && isDeepARConfigured();
  useEffect(() => {
    deeparActiveRef.current = deeparActive;
  }, [deeparActive]);

  const deepar = useDeepAR({
    previewRef: deeparPreviewRef,
    videoElementRef: videoRef,
    enabled: cameraEnabled && deeparActive,
    initialEffectId: deeparEffectId,
  });

  useEffect(() => {
    if (!deepar.ready || !deeparActive) return;
    void deepar.switchEffect(deeparEffectId);
  }, [deepar.ready, deeparActive, deeparEffectId, deepar]);

  useEffect(() => {
    cameraEnabledRef.current = cameraEnabled;
  }, [cameraEnabled]);

  useEffect(() => {
    return () => {
      if (vocalBlobRevokeRef.current) {
        URL.revokeObjectURL(vocalBlobRevokeRef.current);
        vocalBlobRevokeRef.current = null;
      }
    };
  }, [vocalBlobUrl]);

  // Live session headphone monitor graph (mic → FX → speakers)
  const liveMonitorGainRef = useRef<GainNode | null>(null);
  const liveMonitorEqRef = useRef<BiquadFilterNode | null>(null);
  const liveMonitorLpRef = useRef<BiquadFilterNode | null>(null);
  const liveMonitorDelayRef = useRef<DelayNode | null>(null);
  const liveMonitorReverbFbRef = useRef<GainNode | null>(null);

  const applyVoicePreset = useCallback((name: VoicePresetName) => {
    const def = VOICE_PRESET_DEFINITIONS[name];
    if (!def) return;
    setActiveVoicePreset(name);
    setSelectedStudioFilter(def.filter);
    setReverbValue(def.reverb);
    setNoiseReduction(def.noise);
    setVocalPresence(def.presence);
    setAutoTuneStrength(def.autoTune);
    setVocalPitchShift(def.pitchShift ?? 0);
  }, []);

  // Workstation Real-time Audio Node Preview Graph reference pointers
  const workspaceAudioRef = useRef<HTMLAudioElement | null>(null);
  const workspaceAudioCtxRef = useRef<AudioContext | null>(null);
  const workspaceSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const workspaceGainRef = useRef<GainNode | null>(null);
  const workspaceBiquadRef = useRef<BiquadFilterNode | null>(null);
  const workspaceDelayRef = useRef<DelayNode | null>(null);
  const workspaceFeedbackRef = useRef<GainNode | null>(null);
  const workspaceNoiseRef = useRef<BiquadFilterNode | null>(null);

  // Real-Time 0-Latency Interactive Backing Audio Track Synthesizer
  const triggerSynthChord = (chordName: string) => {
    try {
      const audioContext = audioCtxRef.current;
      if (!audioContext || audioContext.state === 'suspended') return;
      
      const notesMap: Record<string, number[]> = {
        "C Maj": [130.81, 164.81, 196.00, 261.63], // C3, E3, G3, C4
        "G Maj": [98.00, 146.83, 196.00, 246.94],  // G2, D3, G3, B3
        "A Min": [110.00, 130.81, 220.00, 261.63], // A2, C3, A3, C4
        "F Maj": [87.31, 130.81, 174.61, 220.00],  // F2, C3, F3, A3
        "E Min": [82.41, 123.47, 164.81, 196.00],  // E2, B2, E3, G3
      };
      
      const freqs = notesMap[chordName] || notesMap["C Maj"];
      const now = audioContext.currentTime;
      
      freqs.forEach((freq) => {
        const osc = audioContext.createOscillator();
        const filter = audioContext.createBiquadFilter();
        const gain = audioContext.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        // Slightly detune to give a warm chorus feel
        osc.detune.setValueAtTime((Math.random() - 0.5) * 15, now);
        
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(600, now);
        filter.frequency.exponentialRampToValueAtTime(1400, now + 1.2);
        
        gain.gain.setValueAtTime(0.0, now);
        gain.gain.linearRampToValueAtTime(0.06, now + 0.1); 
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4); 
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(audioContext.destination);
        
        osc.start(now);
        osc.stop(now + 1.5);
      });

      // Rhythmic click beat
      const bufferSize = audioContext.sampleRate * 0.05;
      const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      
      const noise = audioContext.createBufferSource();
      noise.buffer = buffer;
      
      const clickFilter = audioContext.createBiquadFilter();
      clickFilter.type = 'highpass';
      clickFilter.frequency.setValueAtTime(8000, now);
      
      const clickGain = audioContext.createGain();
      clickGain.gain.setValueAtTime(0.012, now);
      clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
      
      noise.connect(clickFilter);
      clickFilter.connect(clickGain);
      clickGain.connect(audioContext.destination);
      
      noise.start(now);
      noise.stop(now + 0.05);
    } catch (e) {
      console.warn("Synth trigger warning:", e);
    }
  };

  const handleRestart = () => {
    setProgress(0);
    setPlaybackSec(0);
    setScore(0);
    setVocalBlobUrl(null);
    if (backingMediaRef.current) {
      backingMediaRef.current.currentTime = 0;
    }
    audioChunksRef.current = [];
    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
        setTimeout(() => {
          audioChunksRef.current = [];
          if (isPlayingRef.current && mediaRecorderRef.current && mediaRecorderRef.current.state === 'inactive') {
            mediaRecorderRef.current.start(100);
          }
        }, 150);
      } catch (e) {
        console.warn("Restart MediaRecorder error:", e);
      }
    }
    window.dispatchEvent(new CustomEvent('app-toast', { detail: '🔄 Session restarted! Sing from the beginning.' }));
    if (isPlaying) {
      triggerSynthChord(sessionLyrics[0]?.chord || "C Maj");
    }
  };

  const handleEndEarly = () => {
    setIsPlaying(false);
    setIsRecording(false);
    setProgress(100);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.warn("MediaRecorder stop error:", e);
      }
    }
    setIsEditingMode(true);
    window.dispatchEvent(new CustomEvent('app-toast', { detail: '✨ Session ended early! Transitioning to Post-Recording Editing Studio.' }));
  };

  const targetMelodyArray = [
    { time: 0, pitch: 40 },
    { time: 3, pitch: 40 },
    { time: 6, pitch: 60 },
    { time: 10, pitch: 50 },
    { time: 14, pitch: 70 },
    { time: 18, pitch: 60 },
    { time: 21, pitch: 55 },
    { time: 24, pitch: 65 },
    { time: 28, pitch: 45 },
    { time: 32, pitch: 50 },
    { time: 36, pitch: 70 },
    { time: 40, pitch: 75 },
    { time: 44, pitch: 55 },
    { time: 48, pitch: 60 },
    { time: 52, pitch: 70 },
    { time: 56, pitch: 50 },
  ];

  // Keep isPlayingRef synchronized on changes
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    playbackSecRef.current = playbackSec;
  }, [playbackSec]);

  useEffect(() => {
    micVolumeRef.current = micVolume;
  }, [micVolume]);

  useEffect(() => {
    micPitchRef.current = micPitch;
  }, [micPitch]);

  useEffect(() => {
    wordSpikesRef.current = wordSpikes;
  }, [wordSpikes]);

  useEffect(() => {
    hasBackingAudioRef.current = hasBackingAudio;
  }, [hasBackingAudio]);

  // Session-wide final cleanup on unmount
  useEffect(() => {
    return () => {
      if (exportIntervalRef.current) {
        clearInterval(exportIntervalRef.current);
        exportIntervalRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
      }
      if (videoRecorderRef.current && videoRecorderRef.current.state !== 'inactive') {
        try {
          videoRecorderRef.current.stop();
        } catch {
          /* ignore */
        }
      }
      videoRecorderRef.current = null;
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          /* ignore */
        }
      }
      if (vocalBlobRevokeRef.current) {
        URL.revokeObjectURL(vocalBlobRevokeRef.current);
        vocalBlobRevokeRef.current = null;
      }
      closePersonSegmenter();
    };
  }, []);

  // Synchronize Workstation Playing State and custom Web Audio Nodes
  useEffect(() => {
    if (!vocalBlobUrl || !workspaceAudioRef.current) return;
    
    const audioEl = workspaceAudioRef.current;
    
    const onTimeUpdate = () => {
      setWorkspaceTime(audioEl.currentTime);
    };
    const syncDuration = () => {
      setWorkspaceDuration(finiteMediaDuration(audioEl.duration));
    };
    const onEnded = () => {
      setIsWorkspacePlaying(false);
    };
    
    audioEl.addEventListener('timeupdate', onTimeUpdate);
    audioEl.addEventListener('loadedmetadata', syncDuration);
    audioEl.addEventListener('durationchange', syncDuration);
    audioEl.addEventListener('ended', onEnded);
    syncDuration();
    
    return () => {
      audioEl.removeEventListener('timeupdate', onTimeUpdate);
      audioEl.removeEventListener('loadedmetadata', syncDuration);
      audioEl.removeEventListener('durationchange', syncDuration);
      audioEl.removeEventListener('ended', onEnded);
    };
  }, [vocalBlobUrl, isEditingMode]);

  const toggleWorkspacePlay = async () => {
    if (!vocalBlobUrl || !workspaceAudioRef.current) return;
    const audioEl = workspaceAudioRef.current;
    
    if (isWorkspacePlaying) {
      audioEl.pause();
      setIsWorkspacePlaying(false);
    } else {
      try {
        if (!workspaceAudioCtxRef.current) {
          const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioCtxClass) {
            const ctx = new AudioCtxClass();
            workspaceAudioCtxRef.current = ctx;
            
            const source = ctx.createMediaElementSource(audioEl);
            workspaceSourceRef.current = source;
            
            // 1. EQ
            const eqFilter = ctx.createBiquadFilter();
            eqFilter.type = 'highshelf';
            eqFilter.frequency.value = 3500;
            eqFilter.gain.value = (vocalPresence - 50) / 4;
            workspaceBiquadRef.current = eqFilter;
            
            // 2. Low pass for noise
            const lpFilter = ctx.createBiquadFilter();
            lpFilter.type = 'lowpass';
            lpFilter.frequency.value = 16000 - (noiseReduction * 105);
            workspaceNoiseRef.current = lpFilter;
            
            // 3. Delay & Feedback reverb representation
            const delayNode = ctx.createDelay(1.0);
            delayNode.delayTime.value = 0.25;
            const feedbackNode = ctx.createGain();
            feedbackNode.gain.value = reverbValue / 220;
            
            workspaceDelayRef.current = delayNode;
            workspaceFeedbackRef.current = feedbackNode;
            
            // 4. Vocal Gain node
            const vocalGain = ctx.createGain();
            vocalGain.gain.value = vocalVolume / 100;
            workspaceGainRef.current = vocalGain;
            
            // Connect chains
            source.connect(eqFilter);
            eqFilter.connect(lpFilter);
            lpFilter.connect(vocalGain);
            vocalGain.connect(ctx.destination);
            
            vocalGain.connect(delayNode);
            delayNode.connect(feedbackNode);
            feedbackNode.connect(ctx.destination);
            feedbackNode.connect(delayNode); // feedback loop
          }
        }
        
        if (workspaceAudioCtxRef.current && workspaceAudioCtxRef.current.state === 'suspended') {
          await workspaceAudioCtxRef.current.resume();
        }
        
        // Match pitch of playing audio (fully functioning autotune playback rate emulation)
        audioEl.playbackRate = 1 + (vocalPitchShift / 12);
        
        await audioEl.play();
        setIsWorkspacePlaying(true);
      } catch (err) {
        console.warn("Workspace Web Audio initialization failure:", err);
        // Fallback directly
        try {
          audioEl.playbackRate = 1 + (vocalPitchShift / 12);
          await audioEl.play();
          setIsWorkspacePlaying(true);
        } catch (e) {}
      }
    }
  };

  useEffect(() => {
    autoTuneStrengthRef.current = autoTuneStrength;
  }, [autoTuneStrength]);

  useEffect(() => {
    const media = backingMediaRef.current;
    if (media) {
      media.volume = Math.max(0, Math.min(1, backingVolume / 100));
    }
  }, [backingVolume]);

  useEffect(() => {
    if (liveMonitorGainRef.current && audioCtxRef.current) {
      liveMonitorGainRef.current.gain.setValueAtTime(
        Math.min(1.25, vocalVolume / 100),
        audioCtxRef.current.currentTime,
      );
    }
  }, [vocalVolume]);

  useEffect(() => {
    if (liveMonitorLpRef.current && audioCtxRef.current) {
      liveMonitorLpRef.current.frequency.setValueAtTime(
        16000 - noiseReduction * 105,
        audioCtxRef.current.currentTime,
      );
    }
  }, [noiseReduction]);

  useEffect(() => {
    if (liveMonitorReverbFbRef.current && audioCtxRef.current) {
      liveMonitorReverbFbRef.current.gain.setValueAtTime(
        reverbValue / 220,
        audioCtxRef.current.currentTime,
      );
    }
  }, [reverbValue]);

  useEffect(() => {
    if (liveMonitorDelayRef.current && audioCtxRef.current) {
      liveMonitorDelayRef.current.delayTime.setValueAtTime(
        Math.max(0, vocalDelayMs / 1000),
        audioCtxRef.current.currentTime,
      );
    }
    if (workspaceDelayRef.current && workspaceAudioCtxRef.current) {
      workspaceDelayRef.current.delayTime.setValueAtTime(
        Math.max(0, vocalDelayMs / 1000),
        workspaceAudioCtxRef.current.currentTime,
      );
    }
  }, [vocalDelayMs]);

  useEffect(() => {
    if (liveMonitorEqRef.current && audioCtxRef.current) {
      applyStudioFilterToEq(
        liveMonitorEqRef.current,
        liveMonitorReverbFbRef.current,
        selectedStudioFilter,
        vocalPresence,
        reverbValue,
        activeVoicePreset === 'Monster',
        audioCtxRef.current,
      );
    }
  }, [selectedStudioFilter, vocalPresence, reverbValue, activeVoicePreset]);

  // Live real-time parameter binding effects
  useEffect(() => {
    if (workspaceGainRef.current && workspaceAudioCtxRef.current) {
      workspaceGainRef.current.gain.setValueAtTime(vocalVolume / 100, workspaceAudioCtxRef.current.currentTime);
    }
  }, [vocalVolume]);

  useEffect(() => {
    if (workspaceBiquadRef.current && workspaceAudioCtxRef.current) {
      workspaceBiquadRef.current.gain.setValueAtTime((vocalPresence - 50) / 4, workspaceAudioCtxRef.current.currentTime);
    }
  }, [vocalPresence]);

  useEffect(() => {
    if (workspaceNoiseRef.current && workspaceAudioCtxRef.current) {
      workspaceNoiseRef.current.frequency.setValueAtTime(16000 - (noiseReduction * 105), workspaceAudioCtxRef.current.currentTime);
    }
  }, [noiseReduction]);

  useEffect(() => {
    if (workspaceFeedbackRef.current && workspaceAudioCtxRef.current) {
      workspaceFeedbackRef.current.gain.setValueAtTime(reverbValue / 220, workspaceAudioCtxRef.current.currentTime);
    }
  }, [reverbValue]);

  useEffect(() => {
    if (workspaceAudioRef.current) {
      workspaceAudioRef.current.playbackRate = 1 + (vocalPitchShift / 12);
    }
  }, [vocalPitchShift]);

  useEffect(() => {
    if (workspaceBiquadRef.current && workspaceAudioCtxRef.current) {
      applyStudioFilterToEq(
        workspaceBiquadRef.current,
        workspaceFeedbackRef.current,
        selectedStudioFilter,
        vocalPresence,
        reverbValue,
        activeVoicePreset === 'Monster',
        workspaceAudioCtxRef.current,
      );
    }
  }, [selectedStudioFilter, vocalPresence, reverbValue, activeVoicePreset]);

  // Clean workspace context on teardown
  useEffect(() => {
    return () => {
      if (workspaceAudioCtxRef.current) {
        workspaceAudioCtxRef.current.close().catch(() => {});
        workspaceAudioCtxRef.current = null;
      }
    };
  }, []);

  // Real-time voice + pitch analyzer
  useEffect(() => {
    let analyser: AnalyserNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let animationFrameId: number;
    let fallbackInterval: number;
    let smoothedPitch = 50;
    let lastPitchUiSync = 0;

    const publishPitch = (pitch: number, now: number) => {
      micPitchRef.current = pitch;
      if (now - lastPitchUiSync >= 48) {
        lastPitchUiSync = now;
        setMicPitch(pitch);
      }
    };

    const runFallback = () => {
      fallbackInterval = window.setInterval(() => {
        if (isPlayingRef.current) {
          const t = Date.now() / 150;
          const baseVolume = 10 + Math.max(0, Math.sin(t) * 55 + Math.cos(t * 1.7) * 20);
          const noise = Math.random() * 15 - 7.5;
          const calculated = Math.max(0, Math.min(100, Math.floor(baseVolume + noise)));

          if (Math.sin(t * 0.5) < -0.85) {
            setMicVolume(0);
            smoothedPitch = smoothLanePitch(smoothedPitch, 0, 0.2);
            publishPitch(smoothedPitch, Date.now());
          } else {
            setMicVolume(calculated);
            const active = activeWordSpikeAtTime(wordSpikesRef.current, playbackSecRef.current);
            const target = active?.pitch ?? 50;
            const simulated = target + Math.sin(t * 1.3) * 7 + (Math.random() - 0.5) * 6;
            smoothedPitch = smoothLanePitch(smoothedPitch, Math.min(96, Math.max(6, simulated)));
            publishPitch(smoothedPitch, Date.now());
          }
        } else {
          setMicVolume(0);
          smoothedPitch = smoothLanePitch(smoothedPitch, 0, 0.25);
          publishPitch(smoothedPitch, Date.now());
        }
      }, 80);
    };

    const initAudioSource = (s: MediaStream) => {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) {
          runFallback();
          return;
        }

        let audioContext = audioCtxRef.current;
        if (!audioContext || audioContext.state === 'closed') {
          audioContext = new AudioContextClass({ latencyHint: 'interactive' });
          audioCtxRef.current = audioContext;
        }

        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.82;

        source = audioContext.createMediaStreamSource(s);

        const lp = audioContext.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 16000 - noiseReduction * 105;
        liveMonitorLpRef.current = lp;

        const eq = audioContext.createBiquadFilter();
        eq.type = 'highshelf';
        eq.frequency.value = 3500;
        eq.gain.value = (vocalPresence - 50) / 4;
        liveMonitorEqRef.current = eq;
        applyStudioFilterToEq(
          eq,
          null,
          selectedStudioFilter,
          vocalPresence,
          reverbValue,
          activeVoicePreset === 'Monster',
          audioContext,
        );

        const monitorGain = audioContext.createGain();
        monitorGain.gain.value = Math.min(1.25, vocalVolume / 100);
        liveMonitorGainRef.current = monitorGain;

        const delay = audioContext.createDelay(2.0);
        delay.delayTime.value = Math.max(0, vocalDelayMs / 1000);
        liveMonitorDelayRef.current = delay;

        const feedback = audioContext.createGain();
        feedback.gain.value = reverbValue / 220;
        liveMonitorReverbFbRef.current = feedback;

        source.connect(lp);
        lp.connect(eq);
        eq.connect(monitorGain);
        eq.connect(analyser);
        monitorGain.connect(audioContext.destination);

        eq.connect(delay);
        delay.connect(feedback);
        feedback.connect(audioContext.destination);
        feedback.connect(delay);

        const timeDomain = new Float32Array(analyser.fftSize);
        const updateMic = (now: number) => {
          if (!analyser || !isPlayingRef.current) {
            setMicVolume(0);
            smoothedPitch = smoothLanePitch(smoothedPitch, 0, 0.25);
            publishPitch(smoothedPitch, now);
            return;
          }

          analyser.getFloatTimeDomainData(timeDomain);
          const volumePercent = computeRmsVolume(timeDomain);
          setMicVolume(volumePercent);

          const hz = detectPitchHz(timeDomain, audioContext!.sampleRate);
          if (hz && volumePercent > 8) {
            let lanePitch = vocalHzToLanePitch(hz);
            const active = activeWordSpikeAtTime(wordSpikesRef.current, playbackSecRef.current);
            const tuneStrength = autoTuneStrengthRef.current / 100;
            if (active && tuneStrength > 0) {
              lanePitch = lanePitch * (1 - tuneStrength) + active.pitch * tuneStrength;
            }
            smoothedPitch = smoothLanePitch(smoothedPitch, lanePitch);
            publishPitch(smoothedPitch, now);
          } else {
            smoothedPitch = smoothLanePitch(smoothedPitch, 0, 0.18);
            publishPitch(smoothedPitch, now);
          }

          animationFrameId = requestAnimationFrame(updateMic);
        };

        if (audioContext.state === 'suspended') {
          audioContext.resume().then(() => {
            if (isPlayingRef.current) {
              animationFrameId = requestAnimationFrame(updateMic);
            }
          });
        } else {
          animationFrameId = requestAnimationFrame(updateMic);
        }
      } catch (err) {
        console.warn("Audio Context creation issue, using fallback:", err);
        runFallback();
      }
    };

    if (isPlaying) {
      if (streamRef.current) {
        // Stream exists already, instantly reuse to prevent any race/latency
        initAudioSource(streamRef.current);
        if (mediaRecorderRef.current) {
          try {
            if (mediaRecorderRef.current.state === 'paused') {
              mediaRecorderRef.current.resume();
            } else if (mediaRecorderRef.current.state === 'inactive') {
              audioChunksRef.current = [];
              mediaRecorderRef.current.start(100);
            }
          } catch (e) {
            console.warn("MediaRecorder resume/start failure:", e);
          }
        }
        if (videoRecorderRef.current) {
          try {
            if (videoRecorderRef.current.state === 'paused') {
              videoRecorderRef.current.resume();
            } else if (videoRecorderRef.current.state === 'inactive') {
              videoChunksRef.current = [];
              videoRecorderRef.current.start(250);
            }
          } catch (e) {
            console.warn("Video recorder resume/start failure:", e);
          }
        }
      } else {
        const cameraAudio =
          cameraEnabledRef.current && cameraStreamRef.current
            ? cameraStreamRef.current.getAudioTracks()
            : [];
        if (cameraAudio.length > 0) {
          const sharedMic = new MediaStream(cameraAudio);
          streamRef.current = sharedMic;
          audioChunksRef.current = [];
          try {
            let options: MediaRecorderOptions = { mimeType: 'audio/webm' };
            if (!MediaRecorder.isTypeSupported('audio/webm')) {
              options = { mimeType: '' };
            }
            const recorder = new MediaRecorder(sharedMic, options);
            recorder.ondataavailable = (event) => {
              if (event.data?.size) audioChunksRef.current.push(event.data);
            };
            recorder.onstop = () => {
              if (audioChunksRef.current.length > 0) {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const url = URL.createObjectURL(blob);
                if (vocalBlobRevokeRef.current) URL.revokeObjectURL(vocalBlobRevokeRef.current);
                vocalBlobRevokeRef.current = url;
                setVocalBlobUrl(url);
              }
            };
            mediaRecorderRef.current = recorder;
            recorder.start(100);
          } catch (mediaError) {
            console.warn('MediaRecorder creation error:', mediaError);
          }
          initAudioSource(sharedMic);
          const initialChord = sessionLyrics[currentLyricIndex]?.chord || 'C Maj';
          triggerSynthChord(initialChord);
        } else if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia && !isAcquiringStreamRef.current) {
          isAcquiringStreamRef.current = true;
          navigator.mediaDevices.getUserMedia({ audio: true })
            .then((s) => {
              isAcquiringStreamRef.current = false;
              streamRef.current = s;

              // Race prevention: If user paused while permission dialog was active, bail out silently
              if (!isPlayingRef.current) {
                return;
              }

              // Initialize high-performance vocal capture recording
              audioChunksRef.current = [];
              try {
                let options = { mimeType: 'audio/webm' };
                if (!MediaRecorder.isTypeSupported('audio/webm')) {
                  options = { mimeType: '' }; // Fallback to raw system default container
                }
                const recorder = new MediaRecorder(s, options);
                recorder.ondataavailable = (event) => {
                  if (event.data && event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                  }
                };
                recorder.onstop = () => {
                  if (audioChunksRef.current.length > 0) {
                    const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                    const url = URL.createObjectURL(blob);
                    if (vocalBlobRevokeRef.current) URL.revokeObjectURL(vocalBlobRevokeRef.current);
                    vocalBlobRevokeRef.current = url;
                    setVocalBlobUrl(url);
                  }
                };
                mediaRecorderRef.current = recorder;
                recorder.start(100); // chunk buffer slices every 100ms
              } catch (mediaError) {
                console.warn("MediaRecorder creation error, recording might be simulated:", mediaError);
              }

              initAudioSource(s);

              // Trigger initial chord onset
              const initialChord = sessionLyrics[currentLyricIndex]?.chord || "C Maj";
              triggerSynthChord(initialChord);
            })
            .catch((err) => {
              isAcquiringStreamRef.current = false;
              console.log("Using dynamic vocal analyzer generator fallback:", err);
              runFallback();
            });
        } else {
          runFallback();
        }
      }
    } else {
      setMicVolume(0);
      setMicPitch(0);
      micPitchRef.current = 0;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        try {
          mediaRecorderRef.current.pause();
        } catch (e) {
          console.warn("MediaRecorder pause error:", e);
        }
      }
      if (videoRecorderRef.current && videoRecorderRef.current.state === 'recording') {
        try {
          videoRecorderRef.current.pause();
        } catch (e) {
          console.warn("Video recorder pause error:", e);
        }
      }
      if (audioCtxRef.current && audioCtxRef.current.state === 'running') {
        audioCtxRef.current.suspend().catch(() => {});
      }
      if (streamRef.current && !cameraEnabledRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (fallbackInterval) clearInterval(fallbackInterval);
      if (source) source.disconnect();
      setMicVolume(0);
      setMicPitch(0);
      micPitchRef.current = 0;
    };
  }, [isPlaying]);

  // Load virtual background image for compositor
  useEffect(() => {
    const presetUrl = videoBackground ? VIDEO_BACKGROUNDS[videoBackground] : undefined;
    const customUrl =
      videoBackground === CUSTOM_VIDEO_BACKGROUND ? customBackgroundUrl : null;
    const sourceUrl = presetUrl ?? customUrl ?? null;

    if (!videoBackground || !sourceUrl) {
      videoBgImageRef.current = null;
      if (compositorScratchRef.current) compositorScratchRef.current.bgColor = null;
      sharedMattingBgRef.current = null;
      setVideoBgReady(false);
      return;
    }

    const cachedCustom =
      videoBackground === CUSTOM_VIDEO_BACKGROUND
        ? backgroundImagesCacheRef.current[CUSTOM_VIDEO_BACKGROUND]
        : null;
    if (cachedCustom) {
      videoBgImageRef.current = cachedCustom;
      if (compositorScratchRef.current) compositorScratchRef.current.backgroundLayerKey = '';
      setVideoBgReady(true);
      return;
    }

    let cancelled = false;
    setVideoBgReady(false);
    if (compositorScratchRef.current) compositorScratchRef.current.bgColor = null;
    sharedMattingBgRef.current = null;

    void loadCompositorBackground(sourceUrl)
      .then((img) => {
        if (cancelled) return;
        videoBgImageRef.current = img;
        if (videoBackground === CUSTOM_VIDEO_BACKGROUND) {
          backgroundImagesCacheRef.current[CUSTOM_VIDEO_BACKGROUND] = img;
          const { w, h } = backgroundSourceSize(img);
          const shortEdge = Math.min(w, h);
          if (shortEdge < VIRTUAL_BACKGROUND_MIN_SHORT_EDGE) {
            window.dispatchEvent(new CustomEvent('app-toast', {
              detail: `Background is ${w}×${h}. For a crisp look use at least ${VIRTUAL_BACKGROUND_MIN_SHORT_EDGE}px (4K/8K recommended).`,
            }));
          } else if (shortEdge >= VIRTUAL_BACKGROUND_IDEAL_SHORT_EDGE) {
            window.dispatchEvent(new CustomEvent('app-toast', {
              detail: `Ultra HD background loaded (${w}×${h}).`,
            }));
          }
        }
        if (compositorScratchRef.current) {
          compositorScratchRef.current.backgroundLayerKey = '';
        }
        setVideoBgReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        videoBgImageRef.current = null;
        setVideoBgReady(false);
        window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Could not load virtual background.' }));
      });

    return () => {
      cancelled = true;
    };
  }, [videoBackground, customBackgroundUrl]);

  useEffect(() => {
    return () => {
      if (customBackgroundUrl) URL.revokeObjectURL(customBackgroundUrl);
    };
  }, [customBackgroundUrl]);

  const handleCustomBackgroundUpload = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Please choose a JPEG, PNG, or WebP image.' }));
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Image must be 100 MB or smaller.' }));
      return;
    }

    const baseName = file.name.replace(/\.[^.]+$/, '').trim();
    const blobUrl = URL.createObjectURL(file);

    setCustomBackgroundUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return blobUrl;
    });
    setCustomBackgroundLabel(baseName || 'My Photo');
    setVideoBackground(CUSTOM_VIDEO_BACKGROUND);

    if (compositorScratchRef.current) {
      compositorScratchRef.current.bgColor = null;
      compositorScratchRef.current.backgroundLayerKey = '';
    }
    sharedMattingBgRef.current = null;
    resetPersonSegmentState();
    setVideoBgReady(false);

    void decodeBackgroundFile(file)
      .then((nativeCanvas) => {
        backgroundImagesCacheRef.current[CUSTOM_VIDEO_BACKGROUND] = nativeCanvas;
        videoBgImageRef.current = nativeCanvas;
        const { w, h } = backgroundSourceSize(nativeCanvas);
        const shortEdge = Math.min(w, h);
        if (shortEdge < VIRTUAL_BACKGROUND_MIN_SHORT_EDGE) {
          window.dispatchEvent(new CustomEvent('app-toast', {
            detail: `File decoded at ${w}×${h}. Pick a 4K/8K original — not a screenshot thumbnail.`,
          }));
        } else {
          window.dispatchEvent(new CustomEvent('app-toast', {
            detail: `Background ready at full ${w}×${h}.`,
          }));
        }
        setVideoBgReady(true);
      })
      .catch(() => {
        videoBgImageRef.current = null;
        setVideoBgReady(false);
        URL.revokeObjectURL(blobUrl);
        window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Could not decode that image.' }));
      });
  }, []);

  // Preload all virtual backgrounds for live picker previews
  useEffect(() => {
    if (!cameraEnabled) {
      backgroundImagesCacheRef.current = {};
      return;
    }

    let cancelled = false;
    void Promise.all(
      Object.entries(VIDEO_BACKGROUNDS).map(async ([name, url]) => {
        try {
          const img = await loadCompositorBackground(url);
          if (!cancelled) backgroundImagesCacheRef.current[name] = img;
        } catch {
          /* skip failed thumbnail asset */
        }
      }),
    );

    return () => {
      cancelled = true;
    };
  }, [cameraEnabled]);

  const startCompositorVideoRecorder = useCallback((stream: MediaStream) => {
    videoChunksRef.current = [];
    try {
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
      const recorder = new MediaRecorder(stream, MediaRecorder.isTypeSupported(mime) ? { mimeType: mime } : undefined);
      recorder.ondataavailable = (event) => {
        if (event.data?.size) videoChunksRef.current.push(event.data);
      };
      videoRecorderRef.current = recorder;
      if (isPlayingRef.current && recorder.state === 'inactive') {
        recorder.start(250);
      }
    } catch (err) {
      console.warn('Compositor video recorder unavailable:', err);
    }
  }, []);

  useEffect(() => {
    if (!cameraEnabled || !deeparActive || !deepar.ready) {
      if (!deeparActive) deeparRecorderStartedRef.current = false;
      return;
    }
    if (deeparRecorderStartedRef.current) return;

    const videoStream = deepar.getCanvasStream(30);
    if (!videoStream) return;

    const tracks = [...videoStream.getVideoTracks()];
    const audioTracks = cameraStreamRef.current?.getAudioTracks() ?? [];
    tracks.push(...audioTracks);

    const recorder = videoRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {
        /* ignore */
      }
    }
    videoRecorderRef.current = null;
    compositorRecorderStartedRef.current = true;
    deeparRecorderStartedRef.current = true;
    startCompositorVideoRecorder(new MediaStream(tracks));
  }, [cameraEnabled, deeparActive, deepar.ready, deepar, startCompositorVideoRecorder]);

  useEffect(() => {
    if (deeparActive) return;
    if (!deeparRecorderStartedRef.current) return;
    deeparRecorderStartedRef.current = false;
    compositorRecorderStartedRef.current = false;
    const recorder = videoRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {
        /* ignore */
      }
    }
    videoRecorderRef.current = null;
  }, [deeparActive]);

  // Camera stream acquisition
  useEffect(() => {
    if (!cameraEnabled) {
      if (videoRecorderRef.current && videoRecorderRef.current.state !== 'inactive') {
        try { videoRecorderRef.current.stop(); } catch { /* ignore */ }
      }
      videoRecorderRef.current = null;
      const stream = cameraStreamRef.current || (videoRef.current?.srcObject as MediaStream | null);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      cameraStreamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      sharedMattingBgRef.current = null;
      closePersonSegmenter();
      return;
    }

    void ensurePersonSegmenter();

    let cancelled = false;

    navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: true,
    })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        cameraStreamRef.current = stream;
        const videoEl = videoRef.current;
        if (!videoEl) return;

        videoEl.srcObject = stream;
        const onReady = () => {
          if (cancelled) return;
          void videoEl.play().catch(() => {});
        };

        if (videoEl.readyState >= 1) {
          onReady();
        } else {
          videoEl.onloadedmetadata = onReady;
        }
      })
      .catch((err) => {
        console.error('Camera error:', err);
        window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Camera access denied or unavailable.' }));
        setCameraEnabled(false);
      });

    return () => {
      cancelled = true;
      compositorRecorderStartedRef.current = false;
      if (videoRecorderRef.current && videoRecorderRef.current.state !== 'inactive') {
        try { videoRecorderRef.current.stop(); } catch { /* ignore */ }
      }
      videoRecorderRef.current = null;
      const stream = cameraStreamRef.current || (videoRef.current?.srcObject as MediaStream | null);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      cameraStreamRef.current = null;
      if (videoRef.current) {
        videoRef.current.onloadedmetadata = null;
        videoRef.current.srcObject = null;
      }
      closePersonSegmenter();
    };
  }, [cameraEnabled]);

  // Live compositor render loop (beauty + virtual background)
  useEffect(() => {
    if (!cameraEnabled) return;

    if (!compositorScratchRef.current) {
      try {
        compositorScratchRef.current = createCompositorScratch();
      } catch (err) {
        console.warn('Compositor scratch init failed:', err);
        return;
      }
    }

    let compositorHandle = 0;
    let cancelled = false;
    let previewTick = 0;

    const runCompositorLoop = () => {
      if (deeparActiveRef.current) {
        const video = videoRef.current;
        if (video) {
          compositorHandle = scheduleVideoCompositorFrame(video, runCompositorLoop);
        }
        return;
      }
      const canvas = compositorCanvasRef.current;
      const recorderCanvas = recorderCanvasRef.current;
      const video = videoRef.current;
      const scratch = compositorScratchRef.current;
      if (!canvas || !recorderCanvas || !video || !scratch || cancelled) return;

      const rect = canvas.getBoundingClientRect();
      const displayW = Math.max(1, Math.floor(rect.width));
      const displayH = Math.max(1, Math.floor(rect.height));
      const dpr = window.devicePixelRatio || 1;
      const targetW = Math.floor(displayW * dpr);
      const targetH = Math.floor(displayH * dpr);

      if (Math.abs(canvas.width - targetW) > 2 || Math.abs(canvas.height - targetH) > 2) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
      if (Math.abs(recorderCanvas.width - targetW) > 2 || Math.abs(recorderCanvas.height - targetH) > 2) {
        recorderCanvas.width = targetW;
        recorderCanvas.height = targetH;
      }

      const ctx = canvas.getContext('2d');
      const recordCtx = recorderCanvas.getContext('2d');
      if (!ctx || !recordCtx) return;

      const filterCss = VIDEO_BEAUTY_FILTERS[videoBeautyFilterRef.current] ?? VIDEO_BEAUTY_FILTERS.None;
      const bgImage =
        videoBackgroundRef.current && videoBgReadyRef.current ? videoBgImageRef.current : null;
      const hasVirtualBg = Boolean(bgImage);
      const mattingEnabled = hasVirtualBg;
      const composeOptions = {
        beautyFilter: filterCss,
        backgroundImage: bgImage,
        mirror: true,
        backgroundColor: null,
        segmentTimestampMs: nextSegmentTimestamp(),
        mattingEnabled,
        instantMatting: true,
      } as const;

      // Hidden recorder canvas — full composite for captureStream (8K → screen downscale).
      composeKaraokeVideoFrame(recordCtx, video, targetW, targetH, scratch, {
        ...composeOptions,
        cssBackgroundPreview: false,
      });

      if (hasVirtualBg) {
        // Visible canvas — person only; native-res <img> behind stays razor sharp.
        composeKaraokeVideoFrame(ctx, video, targetW, targetH, scratch, {
          ...composeOptions,
          cssBackgroundPreview: true,
          skipMattingUpdate: true,
        });
      } else {
        ctx.drawImage(recorderCanvas, 0, 0, targetW, targetH);
      }

      if (mattingEnabled && scratch.bgColor) {
        sharedMattingBgRef.current = scratch.bgColor;
      } else if (!hasVirtualBg) {
        sharedMattingBgRef.current = null;
      }

      previewTick += 1;
      if (activeTabRef.current === 'video' && video.videoWidth > 0 && previewTick % 8 === 0) {
        paintStudioVideoTabPreviews(video, scratch, {
          activeBeautyFilter: filterCss,
          beautyFilters: VIDEO_BEAUTY_FILTERS,
          filterPreviewCanvases: filterPreviewCanvasRefs.current,
          noneBgPreviewCanvas: noneBgPreviewCanvasRef.current,
        });
      }

      if (
        !compositorRecorderStartedRef.current &&
        !deeparActiveRef.current &&
        cameraStreamRef.current &&
        targetW > 64 &&
        targetH > 64 &&
        video.videoWidth > 0
      ) {
        compositorRecorderStartedRef.current = true;
        const captureStream = buildCompositorCaptureStream(recorderCanvas, cameraStreamRef.current, 30);
        startCompositorVideoRecorder(captureStream);
      }

      compositorHandle = scheduleVideoCompositorFrame(video, runCompositorLoop);
    };

    const kick = () => {
      if (cancelled) return;
      const video = videoRef.current;
      if (!video) {
        compositorHandle = requestAnimationFrame(kick);
        return;
      }
      runCompositorLoop();
    };

    compositorHandle = requestAnimationFrame(kick);

    return () => {
      cancelled = true;
      const video = videoRef.current;
      if (video) cancelVideoCompositorFrame(video, compositorHandle);
      else cancelAnimationFrame(compositorHandle);
      if (compositorScratchRef.current) {
        disposeCompositorScratch(compositorScratchRef.current);
      }
    };
  }, [cameraEnabled, startCompositorVideoRecorder]);

  // Master playback clock — reads media time every frame, throttles React UI updates.
  useEffect(() => {
    let rafId = 0;
    let lastUiSync = 0;

    const tick = (now: number) => {
      const media = backingMediaRef.current;
      if (media && hasBackingAudioRef.current) {
        playbackSecRef.current = media.currentTime;
      }

      if (now - lastUiSync >= 48) {
        lastUiSync = now;
        const t = playbackSecRef.current;
        setPlaybackSec(t);
        activeWordSpikeRef.current = activeWordSpikeAtTime(wordSpikesRef.current, t);
        setIsTrackLocked(isTrackLockedRef.current);

        if (media && hasBackingAudioRef.current) {
          const duration = Number.isFinite(media.duration) && media.duration > 0 ? media.duration : sessionDurationSec;
          setProgress(Math.min(100, (t / duration) * 100));
          if (duration > 0) setSessionDurationSec(duration);
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [sessionDurationSec, resolvedAudioUrl]);

  // Smule / StarMaker-style word-tracking spike lane (zero-lag media clock)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrame = 0;
    let lockThrottle = 0;
    const maxParticles = 32;

    const readSongTime = () => {
      const media = backingMediaRef.current;
      if (media && hasBackingAudioRef.current && Number.isFinite(media.currentTime)) {
        return media.currentTime;
      }
      return playbackSecRef.current;
    };

    const render = (now: number) => {
      const dpr = window.devicePixelRatio || 1;
      const displayW = canvas.clientWidth || 320;
      const displayH = canvas.clientHeight || 100;
      const targetW = Math.floor(displayW * dpr);
      const targetH = Math.floor(displayH * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const w = displayW;
      const h = displayH;
      const songTime = readSongTime();
      playbackSecRef.current = songTime;
      const spikes = wordSpikesRef.current;
      const vol = micVolumeRef.current;
      const sungPitch = micPitchRef.current;
      const playing = isPlayingRef.current;
      const pxPerSec = 118;
      const playheadX = Math.max(44, Math.min(Math.round(w * 0.1), 100));
      const laneTop = 8;
      const laneBottom = h - 8;
      const pulse = 0.6 + Math.sin(now / 100) * 0.4;
      const activeSpike = activeWordSpikeAtTime(spikes, songTime);
      activeWordSpikeRef.current = activeSpike;
      const laneSpan = Math.max(40, laneBottom - laneTop);

      ctx.clearRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 0.75;
      for (let i = 1; i <= 4; i += 1) {
        const y = laneTop + (laneSpan / 4) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      if (spikes.length > 0) {
        const viewStart = songTime - (playheadX + 24) / pxPerSec;
        const viewEnd = songTime + (w - playheadX + 24) / pxPerSec;
        const startIdx = firstVisibleSpikeIndex(spikes, viewStart);
        let trackLocked = false;

        for (let index = startIdx; index < spikes.length; index += 1) {
          const spike = spikes[index]!;
          if (spike.start > viewEnd) break;

          const startX = playheadX + (spike.start - songTime) * pxPerSec;
          const endX = playheadX + (spike.end - songTime) * pxPerSec;
          if (endX < -16 || startX > w + 16) continue;

          const isActive = activeSpike === spike;
          const isPast = spike.end <= songTime;
          const barWidth = Math.max(4, endX - startX);
          const barHeight = isActive ? 10 + pulse * 2 : 8;
          const centerY = spikeLaneCenterY(spike.pitch, laneTop, laneBottom, barHeight);

          ctx.save();
          if (isActive) {
            ctx.fillStyle = 'rgba(251, 191, 36, 0.38)';
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 2.5;
            ctx.shadowColor = 'rgba(251, 191, 36, 0.9)';
            ctx.shadowBlur = 12;
          } else if (isPast) {
            ctx.fillStyle = 'rgba(100, 116, 139, 0.18)';
            ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
            ctx.lineWidth = 1.5;
            ctx.shadowBlur = 0;
          } else {
            ctx.fillStyle = 'rgba(56, 189, 248, 0.22)';
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.78)';
            ctx.lineWidth = 2;
            ctx.shadowBlur = 0;
          }

          ctx.beginPath();
          ctx.roundRect(startX, centerY - barHeight / 2, barWidth, barHeight, barHeight / 2);
          ctx.fill();
          ctx.stroke();

          if (isActive) {
            if (playing && vol > 10 && particlesRef.current.length < maxParticles) {
              particlesRef.current.push({
                x: startX + barWidth / 2,
                y: centerY,
                vx: -2.5 - Math.random() * 2,
                vy: (Math.random() - 0.5) * 3,
                size: 2 + Math.random() * 2,
                alpha: 1,
                color: '#fbbf24',
              });
            }

            if (vol > 8 && pitchDeltaLane(sungPitch, spike.pitch) < 12) {
              trackLocked = true;
            }
          }

          ctx.restore();
        }

        isTrackLockedRef.current = trackLocked;
        if (trackLocked && playing && vol > 8 && now - lastScoreBumpRef.current > 200) {
          lastScoreBumpRef.current = now;
          setScore((s) => Math.min(100, s + 0.7));
        }
      } else {
        const demoTime = (progress / 100) * 60;
        targetMelodyArray.forEach((note) => {
          const noteX = playheadX + (note.time - demoTime) * pxPerSec;
          const noteY = spikeLaneCenterY(note.pitch, laneTop, laneBottom, 12);
          if (noteX + 48 > 0 && noteX < w) {
            ctx.fillStyle = 'rgba(236, 72, 153, 0.3)';
            ctx.strokeStyle = 'rgba(236, 72, 153, 0.85)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(noteX, noteY - 6, 48, 12, 6);
            ctx.fill();
            ctx.stroke();
          }
        });
      }

      const voiceY = spikeLaneCenterY(sungPitch, laneTop, laneBottom, 12);

      if (playing && vol > 6 && sungPitch > 2 && particlesRef.current.length < maxParticles) {
        particlesRef.current.push({
          x: playheadX,
          y: voiceY,
          vx: -1.8 - Math.random() * 1.5,
          vy: (Math.random() - 0.5) * 2.5,
          size: 2,
          alpha: 0.9,
          color: isTrackLockedRef.current ? '#22c55e' : '#fbbf24',
        });
      }

      particlesRef.current = particlesRef.current.filter((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.03;
        p.alpha -= 0.035;
        if (p.alpha <= 0) return false;
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        return p.x > 0 && p.y > laneTop && p.y < laneBottom;
      });

      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, laneTop);
      ctx.lineTo(playheadX, laneBottom);
      ctx.stroke();

      if (playing && vol > 4) {
        const locked = isTrackLockedRef.current;
        const dotColor = locked ? '#22c55e' : vol <= 8 ? 'rgba(148,163,184,0.75)' : '#fbbf24';

        ctx.strokeStyle = locked ? 'rgba(34,197,94,0.5)' : 'rgba(251,191,36,0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(4, voiceY);
        ctx.lineTo(playheadX, voiceY);
        ctx.stroke();

        ctx.fillStyle = dotColor;
        ctx.shadowColor = locked ? 'rgba(34,197,94,0.8)' : 'rgba(251,191,36,0.75)';
        ctx.shadowBlur = locked ? 14 : 10;
        ctx.beginPath();
        ctx.arc(playheadX, voiceY, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(playheadX, voiceY, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      if (now - lockThrottle > 200) {
        lockThrottle = now;
        setIsTrackLocked(isTrackLockedRef.current);
      }

      animFrame = requestAnimationFrame(render);
    };

    animFrame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animFrame);
      particlesRef.current = [];
    };
  }, [progress]);

  // Load uploaded backing track when entering studio
  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      if (song?.audioUrl) {
        setResolvedAudioUrl(song.audioUrl);
        setIsVideoBacking(isUploadedVideoTrack(song));
        if (song.durationSec) setSessionDurationSec(song.durationSec);
        return;
      }
      if (song?.isUploaded) {
        const enriched = await enrichUploadedKaraokeSong(song);
        if (cancelled) return;
        if (enriched.audioUrl) {
          setResolvedAudioUrl(enriched.audioUrl);
          setIsVideoBacking(Boolean(enriched.isVideo));
          setSessionDurationSec(enriched.durationSec ?? sessionDurationSec);
        }
      }
    };
    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [song]);

  useEffect(() => {
    if (!backingMediaRef.current || !resolvedAudioUrl) return;
    backingMediaRef.current.src = resolvedAudioUrl;
    backingMediaRef.current.load();
  }, [resolvedAudioUrl, isVideoBacking]);

  // Simulate playback progress and scoring (demo tracks without uploaded audio)
  useEffect(() => {
    let interval: number;
    if (isPlaying && !hasBackingAudio) {
      interval = window.setInterval(() => {
        setProgress(p => {
          if (p >= 100) {
            setIsPlaying(false);
            setIsRecording(false);
            setIsEditingMode(true);
            window.dispatchEvent(new CustomEvent('app-toast', { detail: '✨ Track ended! Transitioning to Post-Recording Editing Studio.' }));
            return 100;
          }
          return p + 0.5;
        });
        setPlaybackSec((sec) => {
          const next = Math.min(sessionDurationSec, sec + sessionDurationSec * 0.005);
          playbackSecRef.current = next;
          return next;
        });
        setScore(s => Math.min(100, s + Math.random() * 2));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, hasBackingAudio, sessionDurationSec]);

  // Real uploaded media playback + progress sync (seek / end events)
  useEffect(() => {
    const media = backingMediaRef.current;
    if (!media || !hasBackingAudio) return;

    const syncFromMedia = () => {
      playbackSecRef.current = media.currentTime;
      const duration = Number.isFinite(media.duration) && media.duration > 0 ? media.duration : sessionDurationSec;
      setPlaybackSec(media.currentTime);
      setProgress(Math.min(100, (media.currentTime / duration) * 100));
      setSessionDurationSec(duration);
    };

    const onEnded = () => {
      setIsPlaying(false);
      setIsRecording(false);
      setIsEditingMode(true);
      setProgress(100);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: '✨ Track ended! Transitioning to Post-Recording Editing Studio.' }));
    };

    media.addEventListener('seeked', syncFromMedia);
    media.addEventListener('ended', onEnded);
    return () => {
      media.removeEventListener('seeked', syncFromMedia);
      media.removeEventListener('ended', onEnded);
    };
  }, [hasBackingAudio, sessionDurationSec]);

  useEffect(() => {
    const media = backingMediaRef.current;
    if (!media || !hasBackingAudio) return;
    if (isPlaying) {
      void media.play().catch(() => {
        window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Could not play backing track. Tap start again.' }));
      });
    } else {
      media.pause();
    }
  }, [isPlaying, hasBackingAudio, resolvedAudioUrl]);

  const currentLyricIndex = useMemo(
    () => activeLyricIndexForTime(sessionLyrics, playbackSec),
    [sessionLyrics, playbackSec],
  );

  const activeWordSpike = useMemo(
    () => activeWordSpikeAtTime(wordSpikes, playbackSec),
    [wordSpikes, playbackSec],
  );

  const aiMetrics = useMemo(
    () =>
      computeLiveVocalMetrics(
        micPitch,
        micVolume,
        playbackSec,
        isPlaying,
        isTrackLocked,
        noiseReduction,
        activeWordSpike,
      ),
    [micPitch, micVolume, playbackSec, isPlaying, isTrackLocked, noiseReduction, activeWordSpike],
  );

  const aiSuggestions = useMemo(
    () => buildAiSuggestions(aiMetrics, autoTuneStrength),
    [aiMetrics, autoTuneStrength],
  );

  // Play dynamic background chord progression on lyric changes (demo mode only)
  useEffect(() => {
    if (isPlaying && audioCtxRef.current && !hasBackingAudio) {
      const activeChord = sessionLyrics[currentLyricIndex]?.chord || "C Maj";
      triggerSynthChord(activeChord);
    }
  }, [currentLyricIndex, isPlaying, hasBackingAudio, sessionLyrics]);

  const singer1Avatar = "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80"; // Young child portrait
  const singer2Avatar = "https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=150&auto=format&fit=crop&q=80"; // Star / deep cosmic art/image

  const stopMediaRecorderAsync = (recorder: MediaRecorder | null): Promise<void> => {
    if (!recorder || recorder.state === 'inactive') return Promise.resolve();
    return new Promise((resolve) => {
      recorder.addEventListener('stop', () => resolve(), { once: true });
      try {
        recorder.stop();
      } catch {
        resolve();
      }
    });
  };

  const finalizePublishMedia = async (): Promise<{ blob: Blob | null; mediaKind: 'audio' | 'video'; mimeType?: string }> => {
    const videoMime = videoRecorderRef.current?.mimeType || 'video/webm';
    await stopMediaRecorderAsync(videoRecorderRef.current);
    await stopMediaRecorderAsync(mediaRecorderRef.current);

    if (cameraEnabled && videoChunksRef.current.length > 0) {
      return {
        blob: new Blob(videoChunksRef.current, { type: videoMime }),
        mediaKind: 'video',
        mimeType: videoMime,
      };
    }
    if (audioChunksRef.current.length > 0) {
      return {
        blob: new Blob(audioChunksRef.current, { type: 'audio/webm' }),
        mediaKind: 'audio',
        mimeType: 'audio/webm',
      };
    }
    if (vocalBlobUrl) {
      const blob = await fetch(vocalBlobUrl).then((response) => response.blob());
      return { blob, mediaKind: 'audio', mimeType: blob.type || 'audio/webm' };
    }
    return { blob: null, mediaKind: 'audio' };
  };

  const handlePublishRecording = async () => {
    if (isPublishing) return;
    if (!song?.id) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Missing song — cannot publish cover.' }));
      return;
    }

    setIsPublishing(true);
    setIsPlaying(false);

    try {
      await new Promise((resolve) => setTimeout(resolve, 280));

      const performanceType = groupMode ? 'group' : duetMode ? 'duet' : 'solo';
      const userHandle = '@' + (appUser.username || appUser.displayName || 'you').toLowerCase().replace(/\s+/g, '_');
      const userName = appUser.displayName || appUser.username || 'You';
      const performers =
        performanceType === 'solo'
          ? [{ handle: userHandle, name: userName, avatar: safeAvatarUrl(appUser.avatarUrl) }]
          : performanceType === 'duet'
            ? [
                { handle: userHandle, name: userName, avatar: safeAvatarUrl(appUser.avatarUrl) },
                { handle: '@duet_partner', name: 'Duet Partner', avatar: singer2Avatar },
              ]
            : [
                { handle: userHandle, name: userName, avatar: safeAvatarUrl(appUser.avatarUrl) },
                { handle: '@group_part_2', name: 'Part 2', avatar: singer2Avatar },
                { handle: '@group_part_3', name: 'Part 3', avatar: singer1Avatar },
                { handle: '@group_part_4', name: 'Part 4', avatar: singer2Avatar },
              ];

      const { blob, mediaKind, mimeType } = await finalizePublishMedia();
      const caption = publishCaption.trim();
      const meta = await saveKaraokeCoverRecording({
        songId: song.id,
        songTitle: song.title,
        performers,
        performanceType,
        mediaKind,
        mediaBlob: blob,
        mimeType,
        durationSec: Math.max(1, Math.floor(playbackSec)),
        img: song.img,
        caption: caption || undefined,
        score: Math.round(score),
        performerUserId: appUser.id,
      });

      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: blob
          ? cameraEnabled
            ? 'Video cover published with your camera FX! 🎉'
            : 'Cover published! Others can listen from Recordings. 🎉'
          : 'Cover published without captured audio — sing again with mic enabled to save media.',
      }));
      onPublished?.(meta);
      onClose();
    } catch (err) {
      console.error('Publish failed:', err);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Could not publish cover. Try again.' }));
    } finally {
      setIsPublishing(false);
    }
  };

  const defaultPublishCaption = useMemo(() => {
    const title = song?.title || 'this track';
    const artist = song?.artist ? ` by ${song.artist}` : '';
    return `My cover of "${title}"${artist} 🎤`;
  }, [song?.title, song?.artist]);

  const handleMixdownStart = () => {
    if (isExporting || isPublishing) return;
    setIsExporting(true);
    setExportProgress(0);
    if (exportIntervalRef.current) clearInterval(exportIntervalRef.current);
    exportIntervalRef.current = setInterval(() => {
      setExportProgress((prev) => {
        if (prev >= 100) {
          if (exportIntervalRef.current) {
            clearInterval(exportIntervalRef.current);
            exportIntervalRef.current = null;
          }
          setIsExporting(false);
          setPublishCaption((current) => current.trim() || defaultPublishCaption);
          setStudioPublishStep('caption');
          return 100;
        }
        return prev + 4;
      });
    }, 120);
  };

  // Pitch feedback label shown on the left pitch lane
  const activeTargetPitch = activeWordSpikeAtTime(wordSpikes, playbackSec)?.pitch;
  let voiceStatusText = "";

  if (isPlaying && micVolume > 5) {
    if (micVolume <= 8) {
      voiceStatusText = "Low";
    } else if (activeTargetPitch != null && pitchDeltaLane(micPitch, activeTargetPitch) <= 12) {
      voiceStatusText = "On Pitch";
    } else if (micVolume > 75) {
      voiceStatusText = "Too Loud!";
    } else if (activeTargetPitch != null && micPitch < activeTargetPitch - 12) {
      voiceStatusText = "Flat";
    } else if (activeTargetPitch != null && micPitch > activeTargetPitch + 12) {
      voiceStatusText = "High";
    } else {
      voiceStatusText = "Sing";
    }
  }

  if (isEditingMode && studioPublishStep === 'caption') {
    return (
      <div className="fixed inset-0 z-50 bg-[#0a0a0c] text-white flex flex-col font-sans select-none overflow-hidden">
        <div className="h-16 shrink-0 bg-zinc-950 border-b border-white/5 px-6 flex items-center justify-between z-10">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setStudioPublishStep('workstation')}
              className="p-2 hover:bg-white/5 rounded-full transition text-zinc-400 hover:text-white shrink-0"
              aria-label="Back to mastering"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-sm font-black tracking-wider uppercase text-white truncate">Write caption</h1>
              <p className="text-[10px] text-zinc-500 font-medium truncate">Add a caption before publishing your studio master</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-full transition text-zinc-400 hover:text-white shrink-0"
            aria-label="Close studio"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-lg mx-auto space-y-5">
            <div className="flex items-center gap-4 p-4 rounded-2xl border border-white/10 bg-zinc-900/60">
              <div className="w-16 h-16 rounded-xl overflow-hidden border border-white/10 shrink-0 bg-zinc-800">
                <img
                  src={song?.img || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=200&auto=format&fit=crop&q=60'}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Studio master ready</p>
                <h2 className="font-black text-lg truncate">{song?.title || 'Untitled track'}</h2>
                <p className="text-sm text-zinc-400 truncate">{song?.artist || 'Unknown artist'}</p>
                <p className="text-[11px] text-zinc-500 mt-1 font-mono">
                  Score {Math.round(score)} · {groupMode ? 'Group' : duetMode ? 'Duet' : 'Solo'}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="studio-publish-caption" className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Caption
              </label>
              <textarea
                id="studio-publish-caption"
                value={publishCaption}
                onChange={(e) => setPublishCaption(e.target.value)}
                placeholder="Tell listeners about your cover…"
                className="w-full min-h-[140px] rounded-t-2xl rounded-b-none border border-white/10 border-b-0 bg-zinc-950 px-4 py-3 text-[15px] text-white placeholder:text-zinc-600 outline-none focus:border-rose-500/50 resize-none"
              />
              <div className="relative rounded-b-2xl border border-white/10 border-t-0 bg-zinc-950 px-3 py-2.5 flex items-center gap-1 text-zinc-400">
                {showCaptionHashtagList && (
                  <div className="absolute bottom-full left-0 mb-2 w-full bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                    <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between bg-zinc-950/80">
                      <span className="text-xs font-bold text-white">Select hashtags</span>
                      <button
                        type="button"
                        onClick={() => setShowCaptionHashtagList(false)}
                        className="text-xs font-bold text-rose-400 hover:underline"
                      >
                        Done
                      </button>
                    </div>
                    <div className="p-3 flex flex-wrap gap-2 max-h-32 overflow-y-auto no-scrollbar">
                      {STUDIO_CAPTION_HASHTAGS.map((tag) => {
                        const isSelected = publishCaption.includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setPublishCaption(
                                  publishCaption.replace(new RegExp(tag.replace('#', '\\#') + '\\s*', 'g'), '').trim()
                                );
                              } else {
                                setPublishCaption((publishCaption.trim() + ' ' + tag).trim() + ' ');
                              }
                            }}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                              isSelected
                                ? 'bg-rose-500 text-white'
                                : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
                            }`}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {showCaptionMentionList && (
                  <div className="absolute bottom-full left-0 mb-2 w-full bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 flex flex-col">
                    <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between bg-zinc-950/80 shrink-0">
                      <span className="text-xs font-bold text-white">Mention creators</span>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCaptionMentionList(false);
                          setCaptionMentionSearch('');
                        }}
                        className="text-xs font-bold text-rose-400 hover:underline"
                      >
                        Done
                      </button>
                    </div>
                    <div className="p-2 border-b border-white/10 shrink-0">
                      <input
                        type="text"
                        value={captionMentionSearch}
                        onChange={(e) => setCaptionMentionSearch(e.target.value)}
                        placeholder="Search creators…"
                        className="w-full text-xs bg-zinc-950 border border-white/10 rounded-lg px-2.5 py-1.5 outline-none font-medium text-white placeholder:text-zinc-500 focus:border-rose-500/50"
                      />
                    </div>
                    <div className="p-1 flex flex-col gap-1 max-h-44 overflow-y-auto no-scrollbar">
                      {(() => {
                        const users = db.users ?? [];
                        const filteredDbUsers = users.filter(
                          (u) =>
                            (u.username || '').toLowerCase().includes(captionMentionSearch.toLowerCase()) ||
                            (u.displayName || '').toLowerCase().includes(captionMentionSearch.toLowerCase())
                        );
                        const hasExactMatch = users.some(
                          (u) =>
                            (u.username || '').toLowerCase() ===
                            captionMentionSearch.toLowerCase().replace('@', '')
                        );
                        const showCustomAdd =
                          captionMentionSearch.trim().length > 0 && !hasExactMatch;

                        return (
                          <>
                            {filteredDbUsers.map((u) => {
                              const handle = '@' + u.username;
                              const isSelected = publishCaption.includes(handle);
                              return (
                                <button
                                  key={u.id}
                                  type="button"
                                  onClick={() => {
                                    if (isSelected) {
                                      setPublishCaption(
                                        publishCaption
                                          .replace(new RegExp(handle + '\\s*', 'g'), '')
                                          .trim()
                                      );
                                    } else {
                                      setPublishCaption((publishCaption.trim() + ' ' + handle).trim() + ' ');
                                    }
                                  }}
                                  className={`flex items-center gap-2.5 w-full p-2 rounded-lg text-left transition-colors ${
                                    isSelected
                                      ? 'bg-rose-500/15 hover:bg-rose-500/25'
                                      : 'hover:bg-zinc-800'
                                  }`}
                                >
                                  <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 border border-white/10">
                                    <img
                                      src={safeAvatarUrl(u.avatarUrl)}
                                      alt={u.username}
                                      className="w-full h-full object-cover"
                                      onError={handleAvatarError}
                                    />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs font-bold text-white truncate flex items-center gap-1">
                                      {u.username}
                                      {u.isVerified ? <span className="text-sky-400">✓</span> : null}
                                    </div>
                                    <div className="text-[10px] text-zinc-500 truncate">
                                      {u.displayName}
                                    </div>
                                  </div>
                                  {isSelected ? (
                                    <div className="w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center text-[10px] font-black">
                                      ✓
                                    </div>
                                  ) : null}
                                </button>
                              );
                            })}
                            {showCustomAdd ? (
                              <button
                                type="button"
                                onClick={() => {
                                  const handle = '@' + captionMentionSearch.replace('@', '').trim();
                                  setPublishCaption((publishCaption.trim() + ' ' + handle).trim() + ' ');
                                  setCaptionMentionSearch('');
                                }}
                                className="flex items-center gap-2.5 w-full p-2 rounded-lg text-left hover:bg-zinc-800 border border-dashed border-white/10"
                              >
                                <div className="w-7 h-7 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center text-xs font-bold">
                                  @
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-bold text-rose-400">Mention custom user</div>
                                  <div className="text-[10px] text-zinc-500 truncate">
                                    @{captionMentionSearch.replace('@', '').trim()}
                                  </div>
                                </div>
                              </button>
                            ) : null}
                            {filteredDbUsers.length === 0 && !showCustomAdd ? (
                              <div className="p-4 text-center text-xs text-zinc-500 font-semibold">
                                No creators found. Type to mention.
                              </div>
                            ) : null}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setPublishCaption((publishCaption.trim() + ' 😊').trim() + ' ')}
                  className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
                  aria-label="Add emoji"
                >
                  <span className="text-xl">😊</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCaptionHashtagList(!showCaptionHashtagList);
                    setShowCaptionMentionList(false);
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-colors font-semibold text-lg ${
                    showCaptionHashtagList
                      ? 'bg-rose-500 text-white'
                      : 'hover:bg-zinc-800 text-zinc-200'
                  }`}
                  aria-label="Add hashtag"
                >
                  #
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCaptionMentionList(!showCaptionMentionList);
                    setShowCaptionHashtagList(false);
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-colors font-semibold text-lg ${
                    showCaptionMentionList
                      ? 'bg-rose-500 text-white'
                      : 'hover:bg-zinc-800 text-zinc-200'
                  }`}
                  aria-label="Mention user"
                >
                  @
                </button>
                <div className="flex-1 text-right">
                  <span className="text-xs font-medium text-zinc-500">
                    {publishCaption.length > 0
                      ? `${publishCaption.length} · Unlimited`
                      : 'Unlimited'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 p-5 border-t border-white/5 bg-zinc-950">
          <button
            type="button"
            disabled={isPublishing}
            onClick={() => { void handlePublishRecording(); }}
            className="w-full py-4 bg-gradient-to-r from-rose-500 to-pink-500 font-extrabold uppercase tracking-widest text-sm rounded-xl text-white shadow-lg shadow-rose-500/20 hover:shadow-rose-500/35 transition active:scale-98 flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isPublishing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Publishing…
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Publish cover
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  if (isEditingMode) {
    const handleExport = () => {
      handleMixdownStart();
    };

    return (
      <div className="fixed inset-0 z-50 bg-[#0a0a0c] text-white flex flex-col font-sans select-none overflow-hidden">
        {/* Workstation Header */}
        <div className="h-16 shrink-0 bg-zinc-950 border-b border-white/5 px-6 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
              <Wand2 className="w-4 h-4 text-rose-400 animate-pulse" />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-wider uppercase text-white">Vocal Production Workstation</h1>
              <p className="text-[10px] text-zinc-500 font-medium">Auto track finished successfully • Mastering Mode Active</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-full transition text-zinc-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Workspace Grid */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
          
          {/* Main Visualizer Panel */}
          <div className="flex-1 flex flex-col p-6 overflow-hidden min-w-0">
            
            {/* Waveform Board */}
            <div className="flex-1 bg-zinc-900/40 rounded-2xl border border-white/5 p-6 flex flex-col gap-6 relative overflow-hidden backdrop-blur-sm shadow-inner justify-center">
              
              {/* Grid Background */}
              <div className="absolute inset-0 bg-[radial-gradient(#1f1f2e_1px,transparent_1px)] [background-size:16px_16px] opacity-20 pointer-events-none" />

              {/* Peak Meter Column */}
              <div className="absolute left-3 top-6 bottom-6 w-1 flex flex-col justify-between opacity-40 animate-pulse">
                <div className="w-full h-1 bg-red-500 rounded-full" />
                <div className="w-full h-1 bg-amber-500 rounded-full" />
                <div className="w-full h-1 bg-green-500 rounded-full" />
                <div className="w-full h-1 bg-green-500 rounded-full" />
              </div>

              {/* Title Overlay */}
              <div className="absolute top-4 right-4 flex items-center gap-2 text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" /> Real-Time Signal Level
              </div>

              {/* Target Waveform - Backing Track */}
              <div className="flex-1 flex flex-col justify-center relative">
                <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                  <Music className="w-3 h-3 text-sky-400" /> Backing Track Waveform (Instrumental Mix)
                </div>
                <div className="h-28 bg-black/30 rounded-xl border border-white/5 relative overflow-hidden flex items-center px-4">
                  <svg className="w-full h-full opacity-60" viewBox="0 0 1000 100" preserveAspectRatio="none">
                    <path 
                      d="M0 50 Q 50 15, 100 50 T 200 50 T 300 15 T 400 50 T 500 80 T 600 50 T 700 20 T 800 50 T 900 85 T 1000 50 L 1000 50 L 0 50 Z" 
                      fill="none" 
                      stroke="rgba(56, 189, 248, 0.75)" 
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                    <path 
                      d="M0 50 Q 25 35, 50 50 T 100 50 T 150 25 T 200 50 T 250 65 T 300 50 T 350 35 T 400 50 T 450 75 T 500 50 L 1000 50" 
                      fill="none" 
                      stroke="rgba(14, 165, 233, 0.4)" 
                      strokeWidth="1.5"
                    />
                  </svg>
                  {/* Playhead Marker */}
                  <div className="absolute left-[40%] top-0 bottom-0 w-[1.5px] bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.8)] z-10">
                    <div className="absolute -top-1 -left-[5px] w-3 h-3 rotate-45 bg-sky-400" />
                  </div>
                </div>
              </div>

              {/* Recorded Waveform - Vocals */}
              <div className="flex-1 flex flex-col justify-center relative border-t border-white/5 pt-4">
                <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Mic className="w-3 h-3 text-pink-400" /> Your Voice Waveform (Raw Vocal capture)
                  </div>
                  <span className="text-zinc-650 font-mono text-[8px]">Latent Delay Tricked: {vocalDelayMs}ms</span>
                </div>
                <div className="h-28 bg-black/30 rounded-xl border border-white/5 relative overflow-hidden flex items-center px-4">
                  <svg className="w-full h-full" viewBox="0 0 1000 100" preserveAspectRatio="none">
                    <path 
                      d="M0 50 Q 80 85, 120 50 T 210 50 T 340 90 T 420 50 T 510 15 T 620 50 T 730 85 T 840 50 T 930 20 T 1000 50" 
                      fill="none" 
                      stroke="rgba(244, 63, 94, 0.85)" 
                      strokeWidth="2.5" 
                      strokeLinecap="round"
                    />
                    {/* Shadow active segment inside dual handled trimming slider boundary */}
                    <rect 
                      x={`${recordedVocalTrim.start}%`} 
                      y="0" 
                      width={`${recordedVocalTrim.end - recordedVocalTrim.start}%`}
                      height="100" 
                      fill="rgba(244, 63, 94, 0.08)"
                      className="transition-all duration-150"
                    />
                  </svg>
                  {/* Trimmer Handles */}
                  <div 
                    className="absolute top-0 bottom-0 w-[2px] bg-pink-500 shadow-[0_0_8px_rgba(244,63,94,1)] cursor-col-resize z-25 group"
                    style={{ left: `${recordedVocalTrim.start}%` }}
                  >
                    <div className="absolute -top-1 -left-[5px] px-1 py-0.5 rounded bg-pink-500 text-[8px] font-black tracking-tighter text-white">
                      START
                    </div>
                  </div>
                  <div 
                    className="absolute top-0 bottom-0 w-[2px] bg-pink-500 shadow-[0_0_8px_rgba(244,63,94,1)] cursor-col-resize z-25"
                    style={{ left: `${recordedVocalTrim.end}%` }}
                  >
                    <div className="absolute -bottom-1 -left-[5px] px-1 py-0.5 rounded bg-pink-500 text-[8px] font-black tracking-tighter text-white">
                      END
                    </div>
                  </div>
                  {/* Playhead Marker syncing */}
                  <div className="absolute left-[40%] top-0 bottom-0 w-[1.5px] bg-pink-400 shadow-[0_0_10px_rgba(244,63,94,0.8)] z-10" />
                </div>
              </div>

              {/* Trimmer interactive timeline handles */}
              <div className="space-y-2 mt-2 bg-black/20 p-4 rounded-xl border border-white/5">
                <div className="flex justify-between items-center text-[10px] text-zinc-400 font-bold">
                  <span>TRIM SECTION RANGE:</span>
                  <span className="font-mono text-pink-400 font-bold">{recordedVocalTrim.start}% - {recordedVocalTrim.end}% (Duration: {Math.max(0, recordedVocalTrim.end - recordedVocalTrim.start)}s)</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-xs text-zinc-500 select-none">Start</div>
                  <input 
                    type="range" 
                    min="0" 
                    max="45" 
                    value={recordedVocalTrim.start} 
                    onChange={(e) => setRecordedVocalTrim({ ...recordedVocalTrim, start: parseInt(e.target.value) })}
                    className="flex-1 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-pink-500"
                  />
                  <input 
                    type="range" 
                    min="55" 
                    max="100" 
                    value={recordedVocalTrim.end} 
                    onChange={(e) => setRecordedVocalTrim({ ...recordedVocalTrim, end: parseInt(e.target.value) })}
                    className="flex-1 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-pink-500"
                  />
                  <div className="text-xs text-zinc-500 select-none">End</div>
                </div>
              </div>

              {/* Master Vocal Sync Playback Deck */}
              {vocalBlobUrl ? (
                <div className="bg-zinc-950/80 border border-white/15 rounded-xl p-4 flex flex-col gap-3 shadow-xl animate-in fade-in zoom-in-95 duration-300">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-[#2dd4bf] flex items-center gap-1.5 tracking-wider">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
                      </span>
                      Hifi Audio Production Node Active
                    </span>
                    <span className="text-[9px] text-zinc-500 font-mono">Synced Mixdown • 48000 Hz</span>
                  </div>
                  
                  {/* Invisible Audio Element */}
                  <audio 
                    ref={workspaceAudioRef}
                    src={vocalBlobUrl} 
                    className="hidden"
                  />

                  {/* Custom Premium Audio Player UI */}
                  <div className="flex items-center gap-4 bg-black/40 border border-white/5 p-3 rounded-xl">
                    <button
                      type="button"
                      id="btn-workspace-play-toggle"
                      onClick={toggleWorkspacePlay}
                      className="w-12 h-12 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 flex items-center justify-center text-white shadow-md active:scale-95 transition-all text-sm shrink-0"
                    >
                      {isWorkspacePlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current translate-x-0.5" />}
                    </button>
                    
                    <div className="flex-1 space-y-1.5 min-w-0">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-extrabold text-white uppercase tracking-wider">Monitoring Master Mix</span>
                        <span className="text-zinc-400 font-mono">
                          {formatMediaClock(workspaceTime)} / {formatMediaClock(workspaceDuration)}
                        </span>
                      </div>
                      
                      {/* Scrubbable Timeline Track */}
                      <div className="relative">
                        <div 
                          className="h-2 bg-zinc-800 rounded-full cursor-pointer relative overflow-hidden"
                          onClick={(e) => {
                            const audio = workspaceAudioRef.current;
                            if (!audio) return;
                            const duration =
                              finiteMediaDuration(audio.duration) || finiteMediaDuration(workspaceDuration);
                            if (duration <= 0) return;
                            const rect = e.currentTarget.getBoundingClientRect();
                            const pos = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
                            const nextTime = pos * duration;
                            audio.currentTime = nextTime;
                            setWorkspaceTime(nextTime);
                          }}
                        >
                          {/* Selected Active Timeline highlight */}
                          <div 
                            className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-teal-400 to-cyan-400"
                            style={{ width: `${(workspaceTime / (finiteMediaDuration(workspaceDuration) || 1)) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-[9px] text-zinc-500 italic">
                    Adjust Levels / EQ / FX. Settings chain maps directly to final mastered product output.
                  </p>
                </div>
              ) : (
                <div className="bg-zinc-950/20 border border-dashed border-white/5 rounded-xl p-3 text-center sm:p-4">
                  <p className="text-[10px] text-zinc-500 tracking-wider">Vocal tracking stream compiled. Master audio is active for mixdown settings.</p>
                </div>
              )}

            </div>

            {/* Editing Controls Tab Row */}
            <div className="flex items-center gap-2 mt-5 bg-zinc-950 p-1.5 rounded-xl border border-white/5">
              {[
                { id: 'mixer', label: 'Levels & Faders', icon: Volume2 },
                { id: 'tuning', label: 'Vocal Auto-Tune', icon: Wand2 },
                { id: 'effects', label: 'Space & Echo', icon: Sparkles },
                { id: 'trimming', label: 'Vocal Delay Sync', icon: Activity },
              ].map(tab => {
                const IconComp = tab.icon;
                return (
                  <button
                    type="button"
                    key={tab.id}
                    onClick={() => setEditingTab(tab.id as any)}
                    className={`flex-1 py-3 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 uppercase tracking-wider ${
                      editingTab === tab.id 
                        ? 'bg-white/10 text-white shadow' 
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                    }`}
                  >
                    <IconComp className="w-4 h-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Side Tools Console */}
          <div className="w-full md:w-96 shrink-0 bg-zinc-950 border-t md:border-t-0 md:border-l border-white/5 flex flex-col overflow-y-auto">
            <div className="p-6 space-y-6">
              
              <div className="border-b border-white/5 pb-4">
                <h2 className="text-xs font-black uppercase text-zinc-400 tracking-widest flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-rose-500" /> Active Parameter Deck
                </h2>
              </div>

              {editingTab === 'mixer' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Vocal Track Volume</span>
                      <span className="text-xs font-mono font-bold text-rose-450">{vocalVolume}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="120"
                      value={vocalVolume}
                      onChange={(e) => setVocalVolume(parseInt(e.target.value))}
                      className="w-full accent-rose-500 bg-zinc-800" 
                    />
                    <p className="text-[10px] text-zinc-500 italic">Boost limits vocals above original source signal to balance quiet vocals</p>
                  </div>

                  <div className="space-y-2.5 mt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Backing Track Gain</span>
                      <span className="text-xs font-mono font-bold text-sky-450">{backingVolume}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={backingVolume}
                      onChange={(e) => setBackingVolume(parseInt(e.target.value))}
                      className="w-full accent-sky-500 bg-zinc-800" 
                    />
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Presence & Clarity Shift</span>
                      <span className="text-xs font-mono font-bold text-teal-400">+{vocalPresence}c</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="100"
                      value={vocalPresence}
                      onChange={(e) => setVocalPresence(parseInt(e.target.value))}
                      className="w-full accent-teal-400 bg-zinc-800" 
                    />
                  </div>

                  <div className="p-4 bg-zinc-900/50 rounded-xl border border-white/5">
                    <div className="text-xs font-bold text-zinc-400 mb-2">OUTPUT CONSOLE DECK</div>
                    <div className="space-y-1.5 font-mono text-[10px] text-zinc-500">
                      <div className="flex justify-between"><span>Format:</span> <span className="text-zinc-300">Float 32bit WAV</span></div>
                      <div className="flex justify-between"><span>Sample Rate:</span> <span className="text-zinc-300">48000 Hz</span></div>
                      <div className="flex justify-between"><span>Estimated latency:</span> <span className="text-zinc-300">5 ms</span></div>
                    </div>
                  </div>
                </div>
              )}

              {editingTab === 'tuning' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Auto-Tune Strength</span>
                      <span className="text-xs font-mono font-bold text-pink-400">{autoTuneStrength}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="100"
                      value={autoTuneStrength}
                      onChange={(e) => setAutoTuneStrength(parseInt(e.target.value))}
                      className="w-full accent-pink-500 bg-zinc-800" 
                    />
                    <div className="flex justify-between text-[9px] text-zinc-500">
                      <span>Classic/Natural</span>
                      <span>Perfect/Robotic</span>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Vocal Pitch Offset</span>
                      <span className="text-xs font-mono font-bold text-amber-400">{vocalPitchShift > 0 ? `+${vocalPitchShift}` : vocalPitchShift} Semitones</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setVocalPitchShift(prev => Math.max(-12, prev - 1))}
                        className="flex-1 bg-zinc-900 hover:bg-zinc-800 border border-white/10 rounded-lg py-2 text-xs font-black"
                      >
                        - Semitone
                      </button>
                      <button 
                        onClick={() => setVocalPitchShift(0)}
                        className="bg-zinc-900 hover:bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-xs font-black text-zinc-500"
                      >
                        Reset
                      </button>
                      <button 
                        onClick={() => setVocalPitchShift(prev => Math.min(12, prev + 1))}
                        className="flex-1 bg-zinc-900 hover:bg-zinc-800 border border-white/10 rounded-lg py-2 text-xs font-black animate-pulse"
                      >
                        + Semitone
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Master Scale Reference</span>
                    <div className="p-3 bg-zinc-900 border border-white/5 rounded-xl font-mono text-xs flex justify-between">
                      <span className="text-zinc-500">TRACK SCALE:</span>
                      <span className="text-green-400 font-extrabold text-[12px] animate-pulse">E Major • Locked</span>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Vibrato Presence Ratio</span>
                      <span className="text-xs font-mono font-bold text-indigo-400">{vibratoPresence}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="100"
                      value={vibratoPresence}
                      onChange={(e) => setVibratoPresence(parseInt(e.target.value))}
                      className="w-full accent-indigo-400 bg-zinc-800" 
                    />
                  </div>
                </div>
              )}

              {editingTab === 'effects' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Reverb Space Decay (Wet/Dry)</span>
                      <span className="text-xs font-mono font-bold text-purple-400">{reverbValue}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="100"
                      value={reverbValue}
                      onChange={(e) => setReverbValue(parseInt(e.target.value))}
                      className="w-full accent-purple-400 bg-zinc-800" 
                    />
                    <div className="flex justify-between text-[9px] text-zinc-500">
                      <span>Dry/Muted</span>
                      <span>Concert Cathedral</span>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">AI Noise Reduction ratio</span>
                      <span className="text-xs font-mono font-bold text-emerald-400">{noiseReduction}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="100"
                      value={noiseReduction}
                      onChange={(e) => setNoiseReduction(parseInt(e.target.value))}
                      className="w-full accent-emerald-400 bg-zinc-800" 
                    />
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Vocal Field Presets</span>
                    <div className="grid grid-cols-2 gap-2">
                      {['Studio Room', 'Chamber Reverb', 'Large Cathedral', 'Phonograph 1920', 'Concert Echo', 'Perfect Dry'].map(preset => (
                        <button 
                          key={preset}
                          onClick={() => {
                            setSelectedStudioFilter(preset);
                            window.dispatchEvent(new CustomEvent('app-toast', { detail: `Preset ${preset} updated` }));
                          }}
                          className={`p-2.5 rounded-lg border text-left text-[11px] font-bold uppercase transition ${
                            selectedStudioFilter === preset 
                              ? 'bg-rose-500/10 border-rose-500/55 text-rose-450 shadow-[0_0_8px_rgba(244,63,94,0.2)]'
                              : 'bg-zinc-900 border-white/5 text-zinc-500 hover:text-zinc-300 hover:border-white/10'
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {editingTab === 'trimming' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  <div className="p-4 bg-zinc-900/50 rounded-xl border border-white/5 space-y-3">
                    <h3 className="text-xs font-extrabold uppercase text-zinc-300">Vocal Shift Alignment</h3>
                    <p className="text-[11px] text-zinc-500 leading-relaxed">
                      Micro-shifts your vocal wave file horizontally relative to the backing track to align timing.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Delay Correction Offset</span>
                      <span className="text-xs font-mono font-bold text-indigo-400">{vocalDelayMs} ms</span>
                    </div>
                    <div className="flex items-center justify-center gap-4 bg-zinc-900 p-4 rounded-xl border border-white/5">
                      <button 
                        onClick={() => {
                          setVocalDelayMs(prev => Math.max(-300, prev - 10));
                        }}
                        className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center font-black text-lg hover:bg-zinc-700 transition"
                      >
                        -
                      </button>
                      <div className="font-mono text-center">
                        <div className="text-sm font-black">{vocalDelayMs > 0 ? `+${vocalDelayMs}` : vocalDelayMs} ms</div>
                        <div className="text-[9px] text-zinc-500 tracking-wider">DELAY TRIM</div>
                      </div>
                      <button 
                        onClick={() => {
                          setVocalDelayMs(prev => Math.min(300, prev + 10));
                        }}
                        className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center font-black text-lg hover:bg-zinc-700 transition"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="p-3 bg-zinc-950 rounded-lg border border-white/5 text-[10px] text-zinc-500 italic leading-relaxed">
                    🗣️ Tip: Slide delay trim left if your microphone has bluetooth latency. Aligning beats gives you perfect synchronization score!
                  </div>
                </div>
              )}

              {/* Master Control Publish Block */}
              <div className="border-t border-white/5 pt-6 space-y-4">
                <button 
                  onClick={handleExport}
                  disabled={isExporting}
                  className="w-full py-4 bg-gradient-to-r from-rose-500 to-pink-500 font-extrabold uppercase tracking-widest text-sm rounded-xl text-white shadow-lg shadow-rose-500/20 hover:shadow-rose-500/35 hover:scale-102 transition active:scale-98 flex items-center justify-center gap-2"
                >
                  <Upload className="w-4 h-4 text-white" /> Mixdown & Publish Studio Master
                </button>
              </div>

            </div>
          </div>

        </div>

        {/* Global Export Status / Overlay Dialog */}
        {isExporting && (
          <div className="absolute inset-0 bg-black/95 z-50 flex flex-col items-center justify-center p-8">
            <div className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl p-6 text-center space-y-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-amber-500 to-sky-500" />
              <div className="w-16 h-16 bg-rose-500/15 border border-rose-500/35 rounded-2xl flex items-center justify-center mx-auto text-rose-400">
                <Wand2 className="w-8 h-8 text-rose-400 animate-spin" />
              </div>
              <div className="space-y-2">
                <h3 className="text-base font-black uppercase text-white tracking-widest">Mastering Audio Signal</h3>
                <p className="text-xs text-zinc-400">Applying Autotune, Compiling Reverb Matrices, and aligning sound layers...</p>
              </div>
              <div className="space-y-2">
                <div className="w-full bg-zinc-800 h-2.5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-rose-500 to-pink-500 transition-all duration-100 rounded-full"
                    style={{ width: `${exportProgress}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[10px] font-mono text-zinc-500">
                  <span>TRK_EXPORT_BUFFER_MTRX</span>
                  <span>{exportProgress}% COMPLETE</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col sm:flex-row font-sans min-h-0">
      {hasBackingAudio && isVideoBacking && (
        <video ref={backingMediaRef as React.RefObject<HTMLVideoElement>} className="hidden" preload="auto" playsInline />
      )}
      {hasBackingAudio && !isVideoBacking && (
        <audio ref={backingMediaRef as React.RefObject<HTMLAudioElement>} className="hidden" preload="auto" playsInline />
      )}
      {/* Mobile Header / Main Header */}
      <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-20 bg-gradient-to-b from-black/90 via-black/40 to-transparent">
        <button onClick={onClose} className="p-2.5 bg-black/40 rounded-full text-white backdrop-blur hover:bg-black/60 transition shadow-inner">
          <X className="w-5 h-5" />
        </button>
        <div className="text-center font-semibold text-white drop-shadow-md flex items-center justify-center gap-1.5 max-w-[70%]">
          <Music className="w-4 h-4 text-white shrink-0 animate-pulse" />
          <div className="text-sm tracking-tight truncate">
            {song.title || "You Are The Reason"} - {song.artist || "Calum Scott"}
          </div>
        </div>
        <button 
          onClick={() => {
            window.dispatchEvent(new CustomEvent('app-toast', { detail: 'More options coming soon' }));
          }} 
          className="p-2.5 rounded-full bg-black/40 text-white hover:bg-black/60 backdrop-blur transition shadow-sm"
        >
          <MoreVertical className="w-5 h-5" />
        </button>
      </div>

      {/* Main View Area (Camera / Visualizer) */}
      <div className={`flex-1 relative overflow-hidden bg-gradient-to-b from-zinc-950 via-zinc-900 to-black flex flex-col min-h-0 min-w-0 ${
        !isFullScreenLyrics ? 'h-[52dvh] sm:h-auto' : ''
      }`}>
        
        {/* Visual Media Background Layer */}
        <div className="absolute inset-0 z-0">
          {cameraEnabled ? (
            <div className={`w-full h-full relative ${(duetMode || groupMode) ? 'flex' : ''}`}>
              {virtualBgDisplayUrl && videoBackground ? (
                <VirtualBackgroundLayer
                  url={virtualBgDisplayUrl}
                  onDecodedSize={reportBackgroundDisplaySize}
                />
              ) : null}
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="absolute w-px h-px opacity-0 pointer-events-none"
                aria-hidden
              />
              <canvas
                ref={recorderCanvasRef}
                className="absolute w-px h-px opacity-0 pointer-events-none"
                aria-hidden
              />
              <canvas
                ref={compositorCanvasRef}
                className={`absolute inset-0 z-[1] ${
                  deeparActive ? 'opacity-0 pointer-events-none' : ''
                } ${
                  (duetMode || groupMode) ? 'w-1/2 h-full border-r border-white/20' : 'w-full h-full'
                }`}
              />
              {deeparActive && (
                <div
                  ref={deeparPreviewRef}
                  className={`absolute inset-0 z-[2] ${
                    (duetMode || groupMode) ? 'w-1/2 h-full' : 'w-full h-full'
                  }`}
                />
              )}
              {(duetMode || groupMode) && (
                 <div className="w-1/2 h-full bg-zinc-900 flex items-center justify-center relative overflow-hidden">
                   <img src="https://images.unsplash.com/photo-1516280440502-6c9ab45187fb?w=800&auto=format&fit=crop&q=60" className="absolute inset-0 w-full h-full object-cover opacity-60" alt="" />
                   <div className="z-10 bg-black/50 px-4 py-2 rounded-full text-white font-medium text-sm backdrop-blur flex items-center gap-2">
                     <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" /> @star_singer
                   </div>
                 </div>
              )}
            </div>
          ) : hasBackingAudio && song?.img ? (
            <img
              src={song.img}
              alt={song.title || 'Cover art'}
              className="w-full h-full object-cover opacity-35 scale-105 blur-[1px]"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-zinc-950 via-black to-zinc-900">
              <Disc className={`w-36 h-36 text-white/5 ${isPlaying ? 'animate-spin-slow' : ''}`} />
            </div>
          )}
          {/* Ambient overlay vignette — off when virtual background replaces the room */}
          <div className={`absolute inset-0 pointer-events-none ${
            cameraEnabled && videoBackground
              ? 'bg-transparent'
              : 'bg-gradient-to-b from-black/80 via-black/55 to-black/90'
          }`} />
        </div>

        {/* Foreground stage — lyrics between header and transport */}
        <div className="relative z-10 flex flex-col flex-1 min-h-0">
        <div className="h-16 shrink-0" />

        {/* Chord strip — full width on top (above pitch lane + lyrics) */}
        {showChords && (
          <div className="relative w-full shrink-0 overflow-hidden select-none z-20">
            <div className="grid grid-cols-4 gap-px">
              {sessionLyrics.slice(Math.max(0, currentLyricIndex - 1), Math.max(0, currentLyricIndex - 1) + 4).map((lyr, index) => {
                const actualLyricIndex = Math.max(0, currentLyricIndex - 1) + index;
                const isActive = actualLyricIndex === currentLyricIndex;
                const isPast = actualLyricIndex < currentLyricIndex;
                return (
                  <div
                    key={index}
                    className={`py-1.5 px-1 text-center transition-all duration-200 flex flex-col items-center justify-center min-h-[36px] ${
                      isActive
                        ? 'bg-amber-400/10 text-amber-300'
                        : isPast
                          ? 'text-white/25'
                          : 'text-white/55'
                    }`}
                  >
                    <span className="text-[10px] font-black uppercase tracking-wide leading-none">
                      {(lyr.chord || 'C Maj').replace(' Maj', '').replace(' Min', 'm')}
                    </span>
                    <span className="text-[7px] text-zinc-500 font-mono mt-0.5 leading-none uppercase">
                      {isActive ? 'now' : isPast ? 'past' : 'next'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pitch lane — full width on top (below chords) */}
        {showPitchHUD && wordSpikes.length > 0 && (
          <div className="relative w-full shrink-0 overflow-hidden select-none z-20">
            <div className="relative h-[96px] sm:h-[112px] w-full">
              <canvas ref={canvasRef} className="block w-full h-full" />
              {isPlaying && micVolume > 5 && voiceStatusText && (
                <div className={`absolute left-3 bottom-2 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wide border bg-black/80 backdrop-blur ${
                  voiceStatusText === 'On Pitch' ? 'border-green-500/60 text-green-400' :
                  voiceStatusText === 'Too Loud!' ? 'border-red-500/60 text-red-400' :
                  voiceStatusText === 'High' ? 'border-sky-400/60 text-sky-300' :
                  'border-amber-400/50 text-amber-300'
                }`}>
                  {voiceStatusText}
                </div>
              )}
            </div>
          </div>
        )}

         {/* Lyrics zone */}
         <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
         <div className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 flex flex-col justify-center gap-4 items-center z-20 select-none pointer-events-auto">
          <button 
            type="button"
            onClick={() => {
              setIsFullScreenLyrics(!isFullScreenLyrics);
              window.dispatchEvent(new CustomEvent('app-toast', { 
                detail: !isFullScreenLyrics ? 'Full Screen Lyrics Enabled' : 'Split Settings Enabled' 
              }));
            }} 
            className="group flex flex-col items-center gap-1.5 focus:outline-none"
          >
            <div className={`w-11 h-11 rounded-full backdrop-blur-md flex items-center justify-center text-white transition-all active:scale-95 border ${
              isFullScreenLyrics 
                ? 'bg-rose-500/20 border-rose-500/40 shadow-[0_0_12px_rgba(244,63,94,0.35)]' 
                : 'bg-black/40 border-white/10 hover:bg-black/60'
            }`}>
              {isFullScreenLyrics ? (
                <Minimize2 className="w-5 h-5 text-rose-400 group-hover:scale-110 transition stroke-[2.5px]" />
              ) : (
                <Maximize2 className="w-5 h-5 text-white group-hover:scale-110 transition stroke-[2.5px]" />
              )}
            </div>
            <span className="text-[10px] font-black uppercase text-white/90 drop-shadow-md">
              {isFullScreenLyrics ? "Split" : "Full View"}
            </span>
          </button>

          <button 
            type="button"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Clip created! Start and end times updated.' }));
            }} 
            className="group flex flex-col items-center gap-1.5 focus:outline-none"
          >
            <div className="w-10 h-10 rounded-full bg-black/40 border border-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/60 transition active:scale-95">
              <Layers className="w-5 h-5 group-hover:text-primary transition" />
            </div>
            <span className="text-[10px] font-bold text-white/80 drop-shadow">Clip</span>
          </button>

          <button 
            type="button"
            onClick={() => {
              const nextSize = lyricsSize === 'sm' ? 'md' : lyricsSize === 'md' ? 'lg' : 'sm';
              setLyricsSize(nextSize);
              window.dispatchEvent(new CustomEvent('app-toast', { detail: `Lyrics size set to ${nextSize.toUpperCase()}` }));
            }} 
            className="group flex flex-col items-center gap-1.5 focus:outline-none"
          >
            <div className="w-10 h-10 rounded-full bg-black/40 border border-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/60 transition active:scale-95">
              <Type className="w-5 h-5 group-hover:text-primary transition" />
            </div>
            <span className="text-[10px] font-bold text-white/80 drop-shadow">Size</span>
          </button>

          <button 
            type="button"
            onClick={() => {
              setShowChords(!showChords);
              window.dispatchEvent(new CustomEvent('app-toast', { detail: !showChords ? 'Chords HUD Shown' : 'Chords HUD Hidden' }));
            }} 
            className="group flex flex-col items-center gap-1.5 focus:outline-none animate-in fade-in duration-200"
          >
            <div className={`w-10 h-10 rounded-full border backdrop-blur-md flex items-center justify-center transition-all active:scale-95 ${
              showChords 
                ? 'bg-[#2dd4bf]/20 border-[#2dd4bf]/40 text-[#2dd4bf] shadow-[0_0_12px_rgba(45,212,191,0.35)]' 
                : 'bg-black/40 border-white/10 hover:bg-black/60 text-white/60'
            }`}>
              {showChords ? <Eye className="w-5 h-5 stroke-[2.2px]" /> : <EyeOff className="w-5 h-5 stroke-[2px]" />}
            </div>
            <span className="text-[10px] font-bold text-white/80 drop-shadow">Chords</span>
          </button>

          <button 
            type="button"
            onClick={() => {
              setShowPitchHUD(!showPitchHUD);
              window.dispatchEvent(new CustomEvent('app-toast', { detail: !showPitchHUD ? 'Laser Pitch HUD Shown' : 'Laser Pitch HUD Hidden' }));
            }} 
            className="group flex flex-col items-center gap-1.5 focus:outline-none animate-in fade-in duration-200"
          >
            <div className={`w-10 h-10 rounded-full border backdrop-blur-md flex items-center justify-center transition-all active:scale-95 ${
              showPitchHUD 
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-450 shadow-[0_0_12px_rgba(244,63,94,0.35)]' 
                : 'bg-black/40 border-white/10 hover:bg-black/60 text-white/60'
            }`}>
              {showPitchHUD ? <Eye className="w-5 h-5 stroke-[2.2px]" /> : <EyeOff className="w-5 h-5 stroke-[2px]" />}
            </div>
            <span className="text-[10px] font-bold text-white/80 drop-shadow">Visuals</span>
          </button>
         </div>

         {/* Center Lyrics List Wrapper */}
         <div className="flex-1 min-h-0 flex flex-col overflow-hidden px-3 sm:px-12 md:px-16 py-1 pointer-events-none">
           
           {/* Static Group parts header */}
           {groupMode && (
             <div className="flex flex-col items-center gap-3 mb-5 select-none pointer-events-auto z-20 animate-in fade-in zoom-in-95 duration-300">
               <div className="flex items-center gap-8">
                 <button 
                   type="button" 
                   onClick={() => {
                     setGroupModeType('default');
                     window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Default parts activated' }));
                   }}
                   className="flex items-center gap-2 text-sm text-white select-none focus:outline-none"
                 >
                   <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                     groupModeType === 'default' ? 'border-rose-500' : 'border-zinc-500'
                   }`}>
                     {groupModeType === 'default' && <div className="w-2 h-2 rounded-full bg-rose-500" />}
                   </div>
                   <span className="text-sm font-semibold">Default parts</span>
                 </button>

                 <button 
                   type="button" 
                   onClick={() => {
                     setGroupModeType('just_sing');
                     window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Just Sing mode activated' }));
                   }}
                   className="flex items-center gap-2 text-sm text-white select-none focus:outline-none"
                 >
                   <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                     groupModeType === 'just_sing' ? 'border-rose-500' : 'border-zinc-500'
                   }`}>
                     {groupModeType === 'just_sing' && <div className="w-2 h-2 rounded-full bg-rose-500" />}
                   </div>
                   <span className="text-sm font-semibold">Just Sing</span>
                 </button>
               </div>

               <div className="flex items-center justify-center gap-2.5">
                 <button 
                   type="button"
                   onClick={() => {
                     setSelectedPart(1);
                     window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Part 1 selected' }));
                   }}
                   className={`px-3 py-1 rounded-full text-xs font-bold tracking-tight transition duration-200 ${
                     selectedPart === 1 
                       ? 'bg-rose-500 text-white font-extrabold shadow-[0_0_12px_rgba(244,63,94,0.5)]' 
                       : 'border border-rose-500/40 text-rose-450 bg-black/35 hover:bg-rose-500/15'
                   }`}
                 >
                   Part1
                 </button>
                 <button 
                   type="button"
                   onClick={() => {
                     setSelectedPart(2);
                     window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Part 2 selected' }));
                   }}
                   className={`px-3 py-1 rounded-full text-xs font-bold tracking-tight transition duration-200 ${
                     selectedPart === 2 
                       ? 'bg-teal-500 text-white font-extrabold shadow-[0_0_12px_rgba(20,184,166,0.5)]' 
                       : 'border border-teal-500/40 text-teal-400 bg-black/35 hover:bg-teal-500/15'
                   }`}
                 >
                   Part2
                 </button>
                 <button 
                   type="button"
                   onClick={() => {
                     setSelectedPart(3);
                     window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Part 3 selected' }));
                   }}
                   className={`px-3 py-1 rounded-full text-xs font-bold tracking-tight transition duration-150 ${
                     selectedPart === 3 
                       ? 'bg-amber-500 text-white font-extrabold shadow-[0_0_12px_rgba(245,158,11,0.5)]' 
                       : 'border border-amber-500/40 text-amber-400 bg-black/35 hover:bg-amber-500/15'
                   }`}
                 >
                   Part3
                 </button>
                 <button 
                   type="button"
                   onClick={() => {
                     setSelectedPart(4);
                     window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Part 4 selected' }));
                   }}
                   className={`px-3 py-1 rounded-full text-xs font-bold tracking-tight transition duration-150 ${
                     selectedPart === 4 
                       ? 'bg-sky-400 text-white font-extrabold shadow-[0_0_12px_rgba(56,189,248,0.5)]' 
                       : 'border border-sky-400/40 text-sky-400 bg-black/35 hover:bg-sky-500/15'
                   }`}
                 >
                   Part4
                 </button>
               </div>
             </div>
           )}

           {duetMode && (
             <div className="flex items-center justify-center gap-4 mb-6 select-none pointer-events-auto z-20 animate-in fade-in zoom-in-95 duration-300">
               <div className="w-12 h-12 rounded-full ring-2 ring-pink-500 ring-offset-2 ring-offset-zinc-950 overflow-hidden shadow-lg">
                 <img src={singer1Avatar} className="w-full h-full object-cover" alt="Singer 1" />
               </div>
               <div className="w-12 h-12 rounded-full ring-2 ring-sky-500 ring-offset-2 ring-offset-zinc-950 overflow-hidden shadow-lg">
                 <img src={singer2Avatar} className="w-full h-full object-cover" alt="Singer 2" />
               </div>
             </div>
           )}

           <div
             ref={lyricsViewportRef}
             className="relative flex-1 min-h-0 w-full max-w-3xl mx-auto overflow-hidden"
           >
             <div className="absolute left-6 right-6 top-1/2 h-px bg-white/10 pointer-events-none z-[5]" />
             <div className="absolute left-0 right-0 top-1/2 will-change-transform">
               <div
                 className={`flex flex-col items-center w-full ${syncLyricsToUpload ? 'transition-transform duration-75 ease-linear' : 'transition-transform duration-300 ease-out'}`}
                 style={{
                   transform: `translateY(${-(currentLyricIndex * lyricLineHeight + lyricLineHeight / 2)}px)`,
                 }}
               >
               {sessionLyrics.map((lyric, i) => {
                 const isActive = i === currentLyricIndex;
                 const lineWords = lyric.text.split(/\s+/).filter(Boolean);
                 const percentOfLine = isActive
                   ? (() => {
                       const spike = activeWordSpikeAtTime(wordSpikes, playbackSec);
                       if (spike && spike.lineIndex === i) {
                         const span = Math.max(0.08, spike.end - spike.start);
                         return Math.min(100, Math.max(0, ((playbackSec - spike.start) / span) * 100));
                       }
                       return syncLyricsToUpload
                         ? lyricLineProgressPercent(sessionLyrics, playbackSec, i, sessionDurationSec)
                         : isPlaying
                           ? Math.min(100, Math.max(0, ((progress / 100) * sessionLyrics.length - i) * 100))
                           : 0;
                     })()
                   : 0;
                 const activeWordIndex = isActive
                   ? wordSpikes.length > 0
                     ? wordIndexOnLineFromSpikes(wordSpikes, i, playbackSec)
                     : preciseTimedLyrics
                       ? activeWordIndexForLine(sessionLyrics, playbackSec, i, sessionDurationSec)
                       : Math.min(
                           lineWords.length - 1,
                           Math.floor((percentOfLine / 100) * lineWords.length),
                         )
                   : 0;
                 const isPast = i < currentLyricIndex;
                 const isDuet = duetMode;
                 const isGroup = groupMode;
                 const singer = lyric.singer || 'singer1';
                 const lyricPart = lyric.part || 1;
                 
                 // Display speech bubble at transition
                 let showBadge = false;
                 if (isDuet) {
                   showBadge = i === 0 || lyric.singer !== sessionLyrics[i - 1].singer;
                 } else if (isGroup && groupModeType === 'default') {
                   showBadge = i === 0 || lyric.part !== sessionLyrics[i - 1].part;
                 }

                 let textColor = "";
                 let sizeClass = "text-xl";
                 let activeSizeClass = "text-2xl";

                 if (isDuet) {
                   if (singer === 'both') {
                     textColor = isActive 
                       ? 'text-teal-400 font-bold drop-shadow-[0_0_12px_rgba(45,212,191,0.7)] scale-102' 
                       : `text-teal-500/40 ${isPast ? 'opacity-50' : ''}`;
                   } else if (singer === 'singer1') {
                     textColor = isActive 
                       ? 'text-pink-400 font-bold drop-shadow-[0_0_12px_rgba(244,63,94,0.7)] scale-102' 
                       : `text-pink-500/40 ${isPast ? 'opacity-50' : ''}`;
                   } else if (singer === 'singer2') {
                     textColor = isActive 
                       ? 'text-sky-400 font-bold drop-shadow-[0_0_12px_rgba(56,189,248,0.7)] scale-102' 
                       : `text-sky-500/40 ${isPast ? 'opacity-50' : ''}`;
                   }
                 } else if (isGroup) {
                   if (groupModeType === 'just_sing') {
                     textColor = isActive 
                       ? 'text-white font-bold drop-shadow-[0_0_12px_rgba(255,255,255,0.7)] scale-102' 
                       : 'text-white/40';
                   } else {
                     if (lyricPart === 1) {
                       textColor = isActive 
                         ? 'text-rose-400 font-bold drop-shadow-[0_0_12px_rgba(244,63,94,0.7)] scale-102' 
                         : `text-rose-500/40 ${isPast ? 'opacity-50' : ''}`;
                     } else if (lyricPart === 2) {
                       textColor = isActive 
                         ? 'text-teal-400 font-bold drop-shadow-[0_0_12px_rgba(20,184,166,0.7)] scale-102' 
                         : `text-teal-500/40 ${isPast ? 'opacity-50' : ''}`;
                     } else if (lyricPart === 3) {
                       textColor = isActive 
                         ? 'text-amber-400 font-bold drop-shadow-[0_0_12px_rgba(245,158,11,0.7)] scale-102' 
                         : `text-amber-500/40 ${isPast ? 'opacity-50' : ''}`;
                     } else if (lyricPart === 4) {
                       textColor = isActive 
                         ? 'text-sky-450 font-bold drop-shadow-[0_0_12px_rgba(56,189,248,0.7)] scale-102' 
                         : `text-sky-500/40 ${isPast ? 'opacity-50' : ''}`;
                     }
                   }
                 } else {
                   textColor = isActive 
                     ? 'text-white font-bold drop-shadow-[0_0_12px_rgba(255,255,255,0.7)] scale-102' 
                     : 'text-white/40';
                 }

                 if (lyricsSize === 'sm') {
                   sizeClass = "text-sm";
                   activeSizeClass = "text-base";
                 } else if (lyricsSize === 'lg') {
                   sizeClass = "text-2xl";
                   activeSizeClass = "text-3xl";
                 }

                 return (
                   <div 
                     key={i} 
                     className={`w-full max-w-2xl relative flex items-center justify-center shrink-0 transition-all duration-300 px-2 ${
                       syncLyricsToUpload && isActive ? 'scale-[1.02]' : ''
                     }`} style={{ height: `${lyricLineHeight}px` }}
                   >
                     {showBadge && (
                       <div className="absolute left-6 flex items-center animate-in fade-in slide-in-from-left-2 duration-300 select-none">
                         {isDuet ? (
                           singer === 'both' ? (
                             <div className="w-8 h-8 rounded-full bg-teal-500 text-white flex items-center justify-center shadow-lg border border-teal-400 relative">
                               <Mic className="w-4 h-4 text-white" />
                               <div className="absolute right-[-4px] top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-teal-500 border-t border-r border-teal-400" />
                             </div>
                           ) : singer === 'singer1' ? (
                             <div className="w-8 h-8 rounded-full bg-pink-500 p-0.5 shadow-lg border border-pink-400 relative flex items-center justify-center">
                               <img src={singer1Avatar} className="w-full h-full object-cover rounded-full" alt="S1" />
                               <div className="absolute right-[-4px] top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-pink-500 border-t border-r border-pink-400" />
                             </div>
                           ) : (
                             <div className="w-8 h-8 rounded-full bg-sky-500 p-0.5 shadow-lg border border-sky-400 relative flex items-center justify-center">
                               <img src={singer2Avatar} className="w-full h-full object-cover rounded-full" alt="S2" />
                               <div className="absolute right-[-4px] top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-sky-500 border-t border-r border-sky-400" />
                             </div>
                           )
                         ) : (
                           lyricPart === 1 ? (
                             <div className="w-8 h-8 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-lg border border-rose-400 relative">
                               <Mic className="w-4 h-4 text-white" />
                               <div className="absolute right-[-4px] top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-rose-500 border-t border-r border-rose-400" />
                             </div>
                           ) : lyricPart === 2 ? (
                             <div className="w-8 h-8 rounded-full bg-teal-500 text-white flex items-center justify-center shadow-lg border border-teal-400 relative">
                               <Mic className="w-4 h-4 text-white" />
                               <div className="absolute right-[-4px] top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-teal-500 border-t border-r border-teal-400" />
                             </div>
                           ) : lyricPart === 3 ? (
                             <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-lg border border-amber-400 relative">
                               <Mic className="w-4 h-4 text-white" />
                               <div className="absolute right-[-4px] top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-amber-500 border-t border-r border-amber-400" />
                             </div>
                           ) : (
                             <div className="w-8 h-8 rounded-full bg-sky-500 text-white flex items-center justify-center shadow-lg border border-sky-400 relative">
                               <Mic className="w-4 h-4 text-white" />
                               <div className="absolute right-[-4px] top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-sky-500 border-t border-r border-sky-400" />
                             </div>
                           )
                         )}
                       </div>
                     )}

                     <div 
                       className={`transition-all duration-300 tracking-normal text-center max-w-2xl leading-snug ${
                         syncLyricsToUpload ? 'whitespace-normal break-words px-4' : 'whitespace-nowrap px-16'
                       } ${
                         syncLyricsToUpload && isActive
                           ? 'text-amber-300 font-black drop-shadow-[0_0_18px_rgba(251,191,36,0.55)] border-l-4 border-amber-400 pl-3'
                           : syncLyricsToUpload && isPast
                             ? 'text-white/35 font-medium'
                             : ''
                       } ${
                         isActive ? `${isFullScreenLyrics ? (lyricsSize === 'sm' ? 'text-2xl font-extrabold' : lyricsSize === 'lg' ? 'text-4xl md:text-5xl font-black animate-pulse' : 'text-3xl md:text-4xl font-extrabold') : activeSizeClass} ${textColor} font-black scale-105 duration-300 drop-shadow-[0_0_16px_rgba(255,255,255,0.4)]` : `${isFullScreenLyrics ? (lyricsSize === 'sm' ? 'text-lg' : lyricsSize === 'lg' ? 'text-3xl' : 'text-2xl') : sizeClass} ${textColor} ${isPast ? 'opacity-25 line-through-none blur-[0.2px] scale-90' : 'opacity-40 scale-95 transition-all duration-300'}`
                       }`}
                     >
                       {isActive && (wordSpikes.length > 0 || preciseTimedLyrics || (isPlaying && !duetMode && !groupMode)) ? (
                          <span className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 py-1 select-none pointer-events-none">
                            {lyric.text.split(/\s+/).filter(Boolean).map((word, wIdx, arr) => {
                              const isWordActive = wIdx === activeWordIndex;
                              const isWordPast = wIdx < activeWordIndex;
                              
                              let activeCol = syncLyricsToUpload
                                ? "text-amber-200 drop-shadow-[0_0_10px_rgba(251,191,36,0.9)]"
                                : "text-[#fbbf24] drop-shadow-[0_0_12px_rgba(251,191,36,1)]";
                              let underlineCol = syncLyricsToUpload
                                ? "bg-amber-300"
                                : "bg-[#fbbf24] shadow-[0_0_8px_rgba(251,191,36,0.8)]";
                              
                              if (!syncLyricsToUpload) {
                              if (singer === 'singer1') {
                                activeCol = "text-pink-400 drop-shadow-[0_0_12px_rgba(244,63,94,1)]";
                                underlineCol = "bg-pink-400";
                              } else if (singer === 'singer2') {
                                activeCol = "text-sky-400 drop-shadow-[0_0_12px_rgba(56,189,248,1)]";
                                underlineCol = "bg-sky-400";
                              } else if (singer === 'both') {
                                activeCol = "text-teal-350 drop-shadow-[0_0_12px_rgba(45,212,191,1)]";
                                underlineCol = "bg-teal-350";
                              }
                              }

                              return (
                                <span 
                                  key={wIdx} 
                                  className={`transition-all duration-150 relative inline-block text-center px-1 ${
                                    isWordActive 
                                      ? `${activeCol} scale-110 font-extrabold` 
                                      : isWordPast 
                                      ? "opacity-55 text-white/80 font-bold" 
                                      : "opacity-42 text-white/40 font-medium"
                                  }`}
                                >
                                  {word}
                                  {isWordActive && !syncLyricsToUpload && (
                                    <>
                                      {/* High-fidelity Floating Laser Emitter Bracket & Lens */}
                                      <span className="absolute -top-7 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none select-none z-30 animate-in fade-in zoom-in duration-200">
                                        <span className="relative w-3.5 h-3.5 rounded-full bg-zinc-950 border border-white/45 flex items-center justify-center shadow-lg">
                                          <span className={`absolute inset-[-4px] rounded-full animate-ping opacity-60 ${
                                            singer === 'singer1' ? 'bg-pink-500' : singer === 'singer2' ? 'bg-sky-400' : 'bg-amber-400'
                                          }`} />
                                          <span className={`w-1.5 h-1.5 rounded-full ${
                                            singer === 'singer1' ? 'bg-pink-400' : singer === 'singer2' ? 'bg-sky-400' : 'bg-amber-400'
                                          } shadow-inner`} />
                                        </span>
                                        {/* Direct Intense Laser Light Beam Cylinder */}
                                        <span className={`w-[2px] h-7 bg-gradient-to-b opacity-90 shadow-[0_0_12px_2px_rgba(255,255,255,0.85)] ${
                                          singer === 'singer1' 
                                            ? 'from-pink-500 via-pink-400 to-pink-300' 
                                            : singer === 'singer2' 
                                            ? 'from-sky-500 via-sky-400 to-sky-300' 
                                            : 'from-amber-500 via-amber-400 to-amber-300'
                                        }`} />
                                        {/* Focal Contact Laser Core spark dot */}
                                        <span className={`absolute -bottom-0.5 w-1.5 h-1.5 rounded-full animate-pulse ${
                                          singer === 'singer1' ? 'bg-rose-300 shadow-[0_0_14px_6px_rgba(244,63,94,0.95)]' : singer === 'singer2' ? 'bg-sky-200 shadow-[0_0_14px_6px_rgba(56,189,248,0.95)]' : 'bg-yellow-200 shadow-[0_0_14px_6px_rgba(251,191,36,0.95)]'
                                        }`} />
                                      </span>

                                      {/* Underline wave segment indicator */}
                                      <span className={`absolute -bottom-1 left-1.5 right-1.5 h-[2.5px] rounded-full animate-pulse shadow-lg ${underlineCol}`} />

                                      {/* Sci-Fi Target Angle Brackets for precise spatial sweeping feedback */}
                                      <span className={`absolute inset-x-[-4px] inset-y-[-2px] rounded border border-dashed opacity-50 pointer-events-none select-none animate-pulse ${
                                        singer === 'singer1' 
                                          ? 'border-pink-500/40' 
                                          : singer === 'singer2' 
                                          ? 'border-sky-500/40' 
                                          : 'border-amber-500/40'
                                      }`} />
                                    </>
                                  )}
                                </span>
                              );
                            })}
                          </span>
                        ) : lyric.text}
                      </div>

                      {false && isPlaying && (
                        <div 
                          className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none z-10 select-none w-full"
                          style={{ clipPath: `inset(0 ${100 - percentOfLine}% 0 0)` }}
                        >
                          <div className={`whitespace-nowrap transition-all duration-75 tracking-normal text-center px-16 ${isFullScreenLyrics ? (lyricsSize === 'sm' ? 'text-2xl font-extrabold' : lyricsSize === 'lg' ? 'text-4xl md:text-5xl font-black' : 'text-3xl md:text-4xl font-extrabold') : activeSizeClass} ${
                            isDuet 
                              ? singer === 'both' ? 'text-teal-300 drop-shadow-[0_0_15px_rgba(45,212,191,0.95)] font-black' : singer === 'singer1' ? 'text-pink-300 drop-shadow-[0_0_15px_rgba(244,63,94,0.95)] font-black' : 'text-sky-300 drop-shadow-[0_0_15px_rgba(56,189,248,0.95)] font-black'
                              : isGroup && groupModeType === 'default'
                              ? lyricPart === 1 ? 'text-rose-300 drop-shadow-[0_0_15px_rgba(244,63,94,0.95)] font-black' : lyricPart === 2 ? 'text-teal-300 drop-shadow-[0_0_15px_rgba(20,184,166,0.95)] font-black' : lyricPart === 3 ? 'text-amber-300 drop-shadow-[0_0_15px_rgba(245,158,11,0.95)] font-black' : 'text-sky-300 drop-shadow-[0_0_15px_rgba(56,189,248,0.95)] font-black'
                              : 'text-amber-400 font-extrabold drop-shadow-[0_0_18px_rgba(245,158,11,1)] scale-105'
                          }`}>
                            {isActive ? (
                          <span className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 py-1">
                            {lyric.text.split(" ").map((word, wIdx, arr) => {
                              const isWordActive = wIdx === Math.min(arr.length - 1, Math.floor((percentOfLine / 100) * arr.length));
                              const isWordPast = wIdx < Math.min(arr.length - 1, Math.floor((percentOfLine / 100) * arr.length));
                              
                              // Stylize matching group parts active color
                              let activeCol = "text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,1)]";
                              let underlineCol = "bg-yellow-400";
                              if (singer === 'singer1') {
                                activeCol = "text-pink-400 drop-shadow-[0_0_10px_rgba(244,63,94,1)]";
                                underlineCol = "bg-pink-400";
                              } else if (singer === 'singer2') {
                                activeCol = "text-sky-400 drop-shadow-[0_0_10px_rgba(56,189,248,1)]";
                                underlineCol = "bg-sky-450";
                              } else if (singer === 'both') {
                                activeCol = "text-teal-300 drop-shadow-[0_0_10px_rgba(45,212,191,1)]";
                                underlineCol = "bg-teal-300";
                              }

                              return (
                                <span 
                                  key={wIdx} 
                                  className={`transition-all duration-150 relative inline-block text-center ${
                                    isWordActive 
                                      ? `${activeCol} scale-110 font-black` 
                                      : isWordPast 
                                      ? "opacity-50 text-white/70" 
                                      : "opacity-42 text-white/40"
                                  }`}
                                >
                                  {word}
                                  {isWordActive && (
                                    <span className={`absolute -bottom-1 left-1.5 right-1.5 h-[2.5px] rounded-full animate-bounce shadow-lg ${underlineCol}`} />
                                  )}
                                </span>
                              );
                            })}
                          </span>
                        ) : lyric.text}
                          </div>
                        </div>
                      )}
                      
                     </div>
                  );
               })}
               </div>
             </div>
           </div>
         </div>
         </div>

        {/* Action Controls Panel (Bottom Overlay) */}
        <div className="shrink-0 p-6 flex flex-col items-center gap-5 z-20 relative select-none">
          
          {!isPlaying && (
          <div className="bg-white/10 active:bg-white/15 backdrop-blur-md rounded-full p-1 flex items-center gap-1.5 w-[100px] border border-white/15 relative">
            <button 
              type="button"
              onClick={() => {
                setCameraEnabled(false);
                window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Camera disabled' }));
              }}
              className={`flex-1 flex items-center justify-center py-1.5 rounded-full text-xs transition-all duration-300 relative z-10 ${!cameraEnabled ? 'text-black font-extrabold' : 'text-white font-medium hover:text-white/80'}`}
            >
              <Mic className="w-4 h-4" />
            </button>
            <button 
              type="button"
              onClick={() => {
                setCameraEnabled(true);
                window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Camera enabled' }));
              }}
              className={`flex-1 flex items-center justify-center py-1.5 rounded-full text-xs transition-all duration-300 relative z-10 ${cameraEnabled ? 'text-black font-extrabold' : 'text-white font-medium hover:text-white/80'}`}
            >
              <Video className="w-4 h-4" />
            </button>
            <div 
              className="absolute top-1 bottom-1 w-[46px] bg-white rounded-full transition-all duration-300 z-0 shadow"
              style={{ left: cameraEnabled ? 'calc(50% + 1px)' : '4px' }}
            />
          </div>
          )}

          {/* Controls Deck with Restart, Play/Pause, and End Early */}
          <div className="flex items-center justify-center gap-4 w-full max-w-[320px] select-none">
            {/* Restart Button */}
            <button 
              type="button"
              id="btn-recording-restart"
              onClick={handleRestart}
              className="flex items-center justify-center w-12 h-12 rounded-full border border-white/20 bg-black/40 hover:bg-black/60 text-white/80 hover:text-white transition-all active:scale-95 shadow-md shrink-0"
              title="Restart session"
            >
              <RotateCcw className="w-5 h-5" />
            </button>

            {/* Main Play/Pause Button */}
            <button 
              type="button"
              id="btn-recording-toggle"
              onClick={() => {
                setIsPlaying(!isPlaying);
                if (!isRecording && !isPlaying) setIsRecording(true);
              }}
              className="flex-1 py-4 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 font-extrabold text-white text-base rounded-full shadow-[0_0_25px_rgba(244,63,94,0.45)] hover:scale-102 transition-all duration-200 active:scale-98 tracking-wide text-center uppercase"
            >
              {isPlaying ? "Pause Session" : "Tap to start"}
            </button>

            {/* End Early Button */}
            <button 
              type="button"
              id="btn-recording-end-early"
              onClick={handleEndEarly}
              className="flex items-center justify-center w-12 h-12 rounded-full border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-450 hover:text-rose-400 transition-all active:scale-95 shadow-md shrink-0"
              title="End session early & master"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>
          </div>

          {!isPlaying && (
          <div className="flex items-center justify-center gap-10 text-sm mt-1 w-full max-w-sm select-none border-t border-white/5 pt-3">
            <button 
              type="button"
              onClick={() => {
                setDuetMode(false);
                setGroupMode(false);
                window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Solo Mode selected' }));
              }}
              className={`relative py-1 px-2.5 transition text-xs tracking-wider uppercase ${(!duetMode && !groupMode) ? 'text-white font-bold' : 'text-white/50 font-semibold hover:text-white/80'}`}
            >
              Solo
              {!duetMode && !groupMode && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full" />}
            </button>
            <button 
              type="button"
              onClick={() => {
                setDuetMode(true);
                setGroupMode(false);
                window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Duet Mode selected' }));
              }}
              className={`relative py-1 px-2.5 transition text-xs tracking-wider uppercase ${(duetMode && !groupMode) ? 'text-white font-bold' : 'text-white/50 font-semibold hover:text-white/80'}`}
            >
              Duet
              {duetMode && !groupMode && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full" />}
            </button>
            <button 
              type="button"
              onClick={() => {
                setDuetMode(false);
                setGroupMode(true);
                window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Group Mode selected' }));
              }}
              className={`relative py-1 px-2.5 transition text-xs tracking-wider uppercase ${groupMode ? 'text-white font-bold' : 'text-white/50 font-semibold hover:text-white/80'}`}
            >
              Group
              {groupMode && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full" />}
            </button>
          </div>
          )}

        </div>
        </div>
      </div>

      {/* Side / Bottom Controls (Studio Settings) */}
      {!isFullScreenLyrics && (
        <div className="w-full h-[48dvh] sm:h-full sm:w-96 bg-card border-t sm:border-t-0 sm:border-l border-border flex flex-col overflow-hidden shrink-0 z-30 min-h-0 animate-in slide-in-from-right duration-300">
        <div className="flex p-2 gap-1 bg-secondary/30">
          <button 
            onClick={() => setActiveTab('effects')}
            className={`flex-1 py-3 px-2 text-sm font-semibold rounded-lg transition ${activeTab === 'effects' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-black/5'}`}
          >
            Effects
          </button>
          <button 
            onClick={() => setActiveTab('mix')}
            className={`flex-1 py-3 px-2 text-sm font-semibold rounded-lg transition ${activeTab === 'mix' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-black/5'}`}
          >
            Mix
          </button>
          <button 
            onClick={() => setActiveTab('video')}
            className={`flex-1 py-3 px-2 text-sm font-semibold rounded-lg transition ${activeTab === 'video' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-black/5'}`}
          >
            Video
          </button>
          <button 
            onClick={() => setActiveTab('analysis')}
            className={`flex-1 py-3 px-2 text-sm font-semibold rounded-lg transition ${activeTab === 'analysis' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-black/5'}`}
          >
            AI
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-8">
          {activeTab === 'effects' && (
            <>
              <div>
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2"><Mic className="w-4 h-4"/> Voice Filters</h3>
                <div className="grid grid-cols-2 gap-3">
                  {(
                    [
                      { name: 'Studio' as VoicePresetName, desc: 'Warm & clear' },
                      { name: 'KTV' as VoicePresetName, desc: 'Standard echo' },
                      { name: 'Pop' as VoicePresetName, desc: 'Bright vocals' },
                      { name: 'R&B' as VoicePresetName, desc: 'Smooth reverb' },
                      { name: 'Concert' as VoicePresetName, desc: 'Large hall' },
                      { name: 'Phonograph' as VoicePresetName, desc: 'Vintage lo-fi' },
                      { name: 'Auto-Tune' as VoicePresetName, desc: 'Perfect pitch' },
                      { name: 'Monster' as VoicePresetName, desc: 'Deep voice' },
                    ] as const
                  ).map((effect) => (
                    <button
                      key={effect.name}
                      type="button"
                      onClick={() => applyVoicePreset(effect.name)}
                      className={`p-4 rounded-xl text-left border transition group ${
                        activeVoicePreset === effect.name
                          ? 'bg-primary/10 border-primary shadow-sm'
                          : 'bg-secondary/40 hover:bg-secondary border-border/50 hover:border-primary/50'
                      }`}
                    >
                      <div className={`font-bold text-sm transition ${activeVoicePreset === effect.name ? 'text-primary' : 'group-hover:text-primary'}`}>{effect.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">{effect.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2"><Settings2 className="w-4 h-4"/> Advanced Tuning</h3>
                <div className="space-y-6 bg-secondary/20 p-4 rounded-xl border border-border/50">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Pitch Correction</span>
                      <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded font-mono">{autoTuneStrength}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={autoTuneStrength}
                      onChange={(e) => setAutoTuneStrength(parseInt(e.target.value, 10))}
                      className="w-full accent-primary h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Noise Reduction (AI)</span>
                      <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded font-mono">{noiseReduction}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={noiseReduction}
                      onChange={(e) => setNoiseReduction(parseInt(e.target.value, 10))}
                      className="w-full accent-primary h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Reverb Tail</span>
                      <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded font-mono">{reverbValue}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={reverbValue}
                      onChange={(e) => setReverbValue(parseInt(e.target.value, 10))}
                      className="w-full accent-primary h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'mix' && (
            <div className="space-y-8">
              <div className="bg-secondary/20 p-4 rounded-xl border border-border/50 space-y-6">
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-semibold flex items-center gap-2"><Mic className="w-5 h-5 text-indigo-500"/> Vocals</span>
                    <span className="text-muted-foreground font-mono">{vocalVolume}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={150}
                    value={vocalVolume}
                    onChange={(e) => setVocalVolume(parseInt(e.target.value, 10))}
                    className="w-full accent-indigo-500"
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-semibold flex items-center gap-2"><Volume2 className="w-5 h-5 text-amber-500"/> Backing Track</span>
                    <span className="text-muted-foreground font-mono">{backingVolume}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={backingVolume}
                    onChange={(e) => setBackingVolume(parseInt(e.target.value, 10))}
                    className="w-full accent-amber-500"
                  />
                </div>
              </div>
              
              <div>
                 <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">Vocal Timing Sync</h3>
                 <p className="text-sm text-muted-foreground mb-4">If your vocals sound delayed, adjust the sync to match the music perfectly.</p>
                 <div className="flex items-center justify-center gap-4 bg-secondary/20 p-4 rounded-xl border border-border/50">
                    <button
                      type="button"
                      onClick={() => setVocalDelayMs((prev) => Math.max(-300, prev - 10))}
                      className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center font-bold text-lg hover:bg-black/10 transition"
                    >
                      -
                    </button>
                    <div className="font-mono text-center">
                       <div className="text-lg font-bold">{vocalDelayMs > 0 ? `+${vocalDelayMs}` : vocalDelayMs} ms</div>
                       <div className="text-xs text-muted-foreground">Delay</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setVocalDelayMs((prev) => Math.min(300, prev + 10))}
                      className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center font-bold text-lg hover:bg-black/10 transition"
                    >
                      +
                    </button>
                 </div>
              </div>
            </div>
          )}

          {activeTab === 'analysis' && (
             <div className="space-y-6">
                <div>
                   <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2"><Sparkles className="w-4 h-4"/> AI Vocal Analysis</h3>
                   <div className="bg-secondary/20 p-5 rounded-xl border border-border/50 space-y-5">
                      <div>
                        <div className="flex justify-between items-center mb-1"><span className="text-sm font-bold">Pitch Accuracy</span> <span className="font-mono text-xs text-primary font-bold">{aiMetrics.pitchAccuracy}%</span></div>
                        <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden"><div className="h-full bg-primary transition-all duration-300" style={{ width: `${aiMetrics.pitchAccuracy}%` }} /></div>
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-1"><span className="text-sm font-bold">Rhythm & Timing</span> <span className="font-mono text-xs text-green-500 font-bold">{aiMetrics.rhythmTiming}%</span></div>
                        <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden"><div className="h-full bg-green-500 transition-all duration-300" style={{ width: `${aiMetrics.rhythmTiming}%` }} /></div>
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-1"><span className="text-sm font-bold">Voice Clarity</span> <span className="font-mono text-xs text-amber-500 font-bold">{aiMetrics.voiceClarity}%</span></div>
                        <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden"><div className="h-full bg-amber-500 transition-all duration-300" style={{ width: `${aiMetrics.voiceClarity}%` }} /></div>
                      </div>
                   </div>
                </div>
                
                <div>
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">AI Suggestions</h3>
                  <div className="space-y-2">
                     {aiSuggestions.map((tip) => (
                       <div key={`${tip.title}-${tip.text}`} className="p-3 bg-secondary/30 rounded-lg text-sm border border-transparent hover:border-border transition">
                         <span className="font-bold">{tip.icon} {tip.title}:</span> {tip.text}
                       </div>
                     ))}
                  </div>
                </div>
             </div>
          )}

          {activeTab === 'video' && (
            <div className="space-y-6">
              {!cameraEnabled ? (
                <div className="text-center p-8 bg-secondary/20 rounded-xl border border-border border-dashed">
                   <Video className="w-12 h-12 mx-auto text-muted-foreground mb-3 opacity-50" />
                   <h3 className="font-bold mb-2">Camera Disabled</h3>
                   <p className="text-sm text-muted-foreground mb-4">Enable your camera to use AR filters and backgrounds.</p>
                   <button type="button" onClick={() => setCameraEnabled(true)} className="px-4 py-2 bg-primary text-white rounded-full font-medium text-sm">Enable Camera</button>
                </div>
              ) : (
                <>
                  <div className="rounded-xl border border-border/50 bg-secondary/20 px-3 py-2 text-xs text-muted-foreground">
                    Active: <span className="font-semibold text-foreground">{videoBeautyFilter}</span>
                    {' · Background: '}
                    <span className="font-semibold text-foreground">
                      {videoBackground
                        ? (videoBackground === CUSTOM_VIDEO_BACKGROUND ? customBackgroundLabel : videoBackground)
                        : 'Original (no virtual BG)'}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2"><Smile className="w-4 h-4"/> Beauty AR Filters</h3>
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                      {Object.keys(VIDEO_BEAUTY_FILTERS).map((filter) => (
                        <button
                          key={filter}
                          type="button"
                          onClick={() => {
                            setVideoBeautyFilter(filter);
                            if (filter !== 'None') {
                              window.dispatchEvent(new CustomEvent('app-toast', { detail: `${filter} beauty filter applied` }));
                            }
                          }}
                          className={`relative w-20 shrink-0 aspect-[3/4] rounded-lg overflow-hidden transition border ${
                            videoBeautyFilter === filter
                              ? 'border-primary ring-2 ring-primary/40'
                              : 'border-border/50 hover:border-primary'
                          }`}
                        >
                          <canvas
                            ref={(el) => {
                              filterPreviewCanvasRefs.current[filter] = el;
                            }}
                            className="absolute inset-0 w-full h-full bg-zinc-900"
                            aria-hidden
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent pointer-events-none" />
                          <span className="absolute inset-x-0 bottom-0 z-10 px-1 pb-2 text-[10px] font-bold uppercase tracking-wider text-white text-center">
                            {filter}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  {isDeepARConfigured() ? (
                    <div>
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Sparkles className="w-4 h-4" /> DeepAR Face Effects
                      </h3>
                      <DeepAREffectPicker
                        activeEffectId={deeparEffectId}
                        onSelect={(id) => {
                          setDeeparEffectId(id);
                          if (id !== 'none') {
                            window.dispatchEvent(
                              new CustomEvent('app-toast', {
                                detail: `${id.replace(/_/g, ' ')} AR effect applied`,
                              }),
                            );
                          }
                        }}
                        disabled={!cameraEnabled || (deeparActive && !deepar.ready)}
                      />
                      {deeparActive && !deepar.ready && !deepar.error && (
                        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-2">
                          <Loader2 className="w-3 h-3 animate-spin" /> Loading AR…
                        </p>
                      )}
                      {deepar.error && (
                        <p className="text-xs text-destructive mt-2">{deepar.error}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Add <code className="text-foreground">VITE_DEEPAR_LICENSE_KEY</code> to{' '}
                      <code>.env</code> for DeepAR face effects (
                      <a
                        href="https://developer.deepar.ai"
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline"
                      >
                        developer.deepar.ai
                      </a>
                      ).
                    </p>
                  )}
                  <div>
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2"><Layers className="w-4 h-4"/> Green Screen Backgrounds</h3>
                    <p className="text-xs text-muted-foreground mb-3">Choose <span className="font-semibold text-foreground">None</span> to keep your real room (no virtual background). Pick a preset or upload for green-screen replacement.</p>
                    <input
                      ref={customBgInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleCustomBackgroundUpload(file);
                        e.target.value = '';
                      }}
                    />
                    <div className="grid grid-cols-3 gap-2">
                       <button
                         type="button"
                         onClick={() => {
                           setVideoBackground(null);
                           if (compositorScratchRef.current) compositorScratchRef.current.bgColor = null;
                           sharedMattingBgRef.current = null;
                           resetPersonSegmentState();
                         }}
                         className={`relative aspect-square rounded-lg overflow-hidden transition border-2 ${
                           !videoBackground
                             ? 'border-primary ring-2 ring-primary/40'
                             : 'border-border/50 hover:border-primary'
                         }`}
                       >
                         <canvas
                           ref={noneBgPreviewCanvasRef}
                           data-none-preview="true"
                           className="absolute inset-0 w-full h-full bg-zinc-900"
                           aria-hidden
                         />
                         <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-0.5 pb-1.5 bg-gradient-to-t from-black/80 to-transparent pt-4">
                           <X className="w-4 h-4 text-white" />
                           <span className="text-[9px] uppercase font-bold text-white">None</span>
                           <span className="text-[8px] text-white/70">Original</span>
                         </div>
                       </button>
                       <button
                         type="button"
                         onClick={() => {
                           if (customBackgroundUrl) {
                             setVideoBackground(CUSTOM_VIDEO_BACKGROUND);
                             if (compositorScratchRef.current) compositorScratchRef.current.bgColor = null;
                             sharedMattingBgRef.current = null;
                             resetPersonSegmentState();
                             window.dispatchEvent(new CustomEvent('app-toast', { detail: `${customBackgroundLabel} background applied` }));
                           } else {
                             customBgInputRef.current?.click();
                           }
                         }}
                         onDoubleClick={() => customBgInputRef.current?.click()}
                         className={`relative aspect-square rounded-lg overflow-hidden border-2 transition ${
                           videoBackground === CUSTOM_VIDEO_BACKGROUND
                             ? 'border-primary ring-2 ring-primary/40'
                             : 'border-border/50 hover:border-primary'
                         }`}
                       >
                         {customBackgroundUrl ? (
                           <BackgroundPickerImage src={customBackgroundUrl} alt={customBackgroundLabel} />
                         ) : (
                           <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-secondary/40">
                             <Upload className="w-5 h-5 text-muted-foreground" />
                           </div>
                         )}
                         <div className="absolute inset-x-0 bottom-0 z-10 p-1.5 bg-gradient-to-t from-black/85 to-transparent pt-5">
                           <span className="text-[9px] font-bold text-white text-center truncate block">
                             {customBackgroundUrl ? customBackgroundLabel : 'Upload'}
                           </span>
                         </div>
                         {customBackgroundUrl ? (
                           <span
                             role="button"
                             tabIndex={0}
                             title="Replace photo"
                             onClick={(e) => {
                               e.stopPropagation();
                               customBgInputRef.current?.click();
                             }}
                             onKeyDown={(e) => {
                               if (e.key === 'Enter' || e.key === ' ') {
                                 e.preventDefault();
                                 e.stopPropagation();
                                 customBgInputRef.current?.click();
                               }
                             }}
                             className="absolute top-1 right-1 z-20 rounded-full bg-black/60 p-1 text-white hover:bg-black/80 cursor-pointer"
                           >
                             <Upload className="w-3 h-3" />
                           </span>
                         ) : null}
                       </button>
                       {Object.keys(VIDEO_BACKGROUNDS).map((bg) => (
                         <button
                           key={bg}
                           type="button"
                           onClick={() => {
                             setVideoBackground(bg);
                             if (compositorScratchRef.current) compositorScratchRef.current.bgColor = null;
                             sharedMattingBgRef.current = null;
                             resetPersonSegmentState();
                             window.dispatchEvent(new CustomEvent('app-toast', { detail: `${bg} background applied` }));
                           }}
                           className={`relative aspect-square rounded-lg overflow-hidden border-2 transition ${
                             videoBackground === bg ? 'border-primary ring-2 ring-primary/40' : 'border-border/50 hover:border-primary'
                           }`}
                         >
                            <BackgroundPickerImage src={backgroundPickerThumbUrl(VIDEO_BACKGROUNDS[bg])} alt={bg} />
                            <div className="absolute inset-x-0 bottom-0 z-10 p-1.5 bg-gradient-to-t from-black/85 to-transparent pt-5">
                              <span className="text-[9px] font-bold text-white text-center truncate block">{bg}</span>
                            </div>
                         </button>
                       ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        
        {/* Publish/Save Button */}
        <div className="p-5 border-t border-border bg-card/95 backdrop-blur shadow-[0_-10px_20px_rgba(0,0,0,0.05)]">
          <button 
             type="button"
             disabled={isExporting || isPublishing}
             onClick={() => {
               setIsPlaying(false);
               setIsRecording(false);
               if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                 try {
                   mediaRecorderRef.current.stop();
                 } catch {
                   /* ignore */
                 }
               }
               setIsEditingMode(true);
               handleMixdownStart();
             }}
             className="w-full h-12 bg-primary text-primary-foreground font-bold rounded-xl shadow-lg hover:shadow-xl hover:bg-primary/90 transition flex items-center justify-center gap-2 text-lg disabled:opacity-60 disabled:pointer-events-none"
          >
            {isExporting ? 'Mixing down…' : isPublishing ? 'Publishing…' : 'Finish & Publish'} <Upload className="w-5 h-5" />
          </button>
        </div>
       </div>
     )}
    </div>
  );
}
