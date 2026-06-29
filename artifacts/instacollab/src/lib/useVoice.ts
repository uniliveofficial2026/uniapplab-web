import { useState, useRef, useEffect } from 'react';
import { fileToBase64 } from './utils';

export function useVoice(onTranscription?: (text: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedVoice, setRecordedVoice] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const recordingStartTokenRef = useRef(0);
  const pendingStopAfterStartRef = useRef(false);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<{
    start: () => void;
    stop: () => void;
  } | null>(null);
  const unsupportedRecognitionNotifiedRef = useRef(false);
  const recognitionToggleCooldownUntilRef = useRef(0);
  const isListeningRef = useRef(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTranscriptionRef = useRef<typeof onTranscription>(onTranscription);
  const SILENCE_TIMEOUT_MS = 3000;
  const lastSpeechActivityRef = useRef<number>(0);

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current !== null) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const startSilenceTimer = () => {
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      if (!isListeningRef.current || !recognitionRef.current) return;
      const inactiveFor = Date.now() - lastSpeechActivityRef.current;
      if (inactiveFor < SILENCE_TIMEOUT_MS) {
        startSilenceTimer();
        return;
      }
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore stop races from browser lifecycle.
      } finally {
        isListeningRef.current = false;
        setIsListening(false);
      }
    }, SILENCE_TIMEOUT_MS);
  };

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    onTranscriptionRef.current = onTranscription;
  }, [onTranscription]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    type SpeechResultEvent = {
      results: ArrayLike<{ 0: { transcript: string } }>;
    };
    type SpeechErrorEvent = { error: string };
    type BrowserSpeechRecognition = {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      start: () => void;
      stop: () => void;
      onresult: ((event: SpeechResultEvent) => void) | null;
      onstart: (() => void) | null;
      onend: (() => void) | null;
      onspeechstart: (() => void) | null;
      onerror: ((event: SpeechErrorEvent) => void) | null;
    };
    type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;
    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const SpeechRecognitionCtor =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;
    const recognition = new SpeechRecognitionCtor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: SpeechResultEvent) => {
        const transcript = Array.from(event.results)
          .map((result) => result[0].transcript)
          .join('');
        
        if (onTranscriptionRef.current) {
          onTranscriptionRef.current(transcript);
        }
        if (transcript.trim().length > 0) {
          lastSpeechActivityRef.current = Date.now();
        }
        startSilenceTimer();
      };

      recognition.onstart = () => {
        isListeningRef.current = true;
        setIsListening(true);
        recognitionToggleCooldownUntilRef.current = Date.now() + 250;
        lastSpeechActivityRef.current = Date.now();
        startSilenceTimer();
      };

      recognition.onspeechstart = () => {
        lastSpeechActivityRef.current = Date.now();
      };

      recognition.onend = () => {
        isListeningRef.current = false;
        setIsListening(false);
        recognitionToggleCooldownUntilRef.current = Date.now() + 150;
        clearSilenceTimer();
      };

      recognition.onerror = (event: SpeechErrorEvent) => {
        // These are normal lifecycle outcomes; don't spam console.
        if (event.error === 'no-speech' || event.error === 'aborted' || event.error === 'network') {
          isListeningRef.current = false;
          setIsListening(false);
          clearSilenceTimer();
          return;
        }
        console.error('Speech recognition error', event.error);
        isListeningRef.current = false;
        setIsListening(false);
        clearSilenceTimer();
      };

      recognitionRef.current = recognition;

    return () => {
      clearSilenceTimer();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // Ignore teardown races.
        }
      }
    };
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      if (!unsupportedRecognitionNotifiedRef.current) {
        unsupportedRecognitionNotifiedRef.current = true;
      }
      return;
    }

    if (Date.now() < recognitionToggleCooldownUntilRef.current) {
      return;
    }

    try {
      if (isListeningRef.current) {
        recognitionRef.current.stop();
        recognitionToggleCooldownUntilRef.current = Date.now() + 250;
        isListeningRef.current = false;
        setIsListening(false);
        clearSilenceTimer();
      } else {
        recognitionRef.current.start();
        recognitionToggleCooldownUntilRef.current = Date.now() + 250;
        // onstart will set state to true when recognizer is actually active
      }
    } catch (err) {
      const errorName = err instanceof Error ? err.name : undefined;
      if (
        errorName !== 'InvalidStateError' &&
        errorName !== 'NotAllowedError' &&
        errorName !== 'AbortError'
      ) {
        console.error('Error with speech recognition:', err);
      }
      isListeningRef.current = false;
      setIsListening(false);
      clearSilenceTimer();
    }
  };

  const [supportedMimeType, setSupportedMimeType] = useState('audio/webm');

  useEffect(() => {
    if (typeof MediaRecorder === 'undefined') return;
    const types = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav'];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        setSupportedMimeType(type);
        break;
      }
    }
  }, []);

  const startRecording = async () => {
    const startToken = ++recordingStartTokenRef.current;
    pendingStopAfterStartRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (startToken !== recordingStartTokenRef.current || pendingStopAfterStartRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        setIsRecording(false);
        return;
      }

      activeStreamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream, { mimeType: supportedMimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        mediaRecorderRef.current = null;
        setIsRecording(false);
        if (audioChunksRef.current.length === 0) {
          setRecordedVoice(null);
          if (activeStreamRef.current) {
            activeStreamRef.current.getTracks().forEach(track => track.stop());
            activeStreamRef.current = null;
          }
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: supportedMimeType });
        fileToBase64(audioBlob).then(base64 => {
          setRecordedVoice(base64);
        }).catch(err => {
          console.error("Error converting audio to base64:", err);
        });
        
        // Stop all tracks to release the microphone
        if (activeStreamRef.current) {
          activeStreamRef.current.getTracks().forEach(track => track.stop());
          activeStreamRef.current = null;
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordedVoice(null);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    pendingStopAfterStartRef.current = true;
    recordingStartTokenRef.current += 1;
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
      return;
    }
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach((track) => track.stop());
      activeStreamRef.current = null;
    }
    setIsRecording(false);
  };

  const playRecording = () => {
    if (recordedVoice) {
      try {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
        const audio = new Audio(recordedVoice);
        
        audio.onerror = () => {
          console.error("Audio element error during playback");
        };

        audioRef.current = audio;
        audio.play().catch(e => {
          console.error("Error playing audio");
          if (e && e.name === 'NotSupportedError') {
             console.error("The source format is not supported by this browser.");
          }
        });
      } catch (err) {
        console.error("Failed to create audio element:", err);
      }
    }
  };

  const clearRecording = () => {
    // Keep the blob URL valid for components that might be using it (like messages in feed)
    // Revocation should ideally be handled at a higher level or by the browser on page refresh
    setRecordedVoice(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  };

  return {
    isListening,
    isRecording,
    recordedVoice,
    toggleListening,
    startRecording,
    stopRecording,
    playRecording,
    clearRecording,
    startListening: () => {
      if (!isListeningRef.current) toggleListening();
    },
    stopListening: () => {
      if (isListeningRef.current) toggleListening();
    },
  };
}
