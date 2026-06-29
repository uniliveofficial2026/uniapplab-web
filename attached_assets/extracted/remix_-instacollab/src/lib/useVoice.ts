import { useState, useRef, useEffect } from 'react';
import { fileToBase64 } from './utils';

export function useVoice(onTranscription?: (text: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedVoice, setRecordedVoice] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Initialize Speech Recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result: any) => result.transcript)
          .join('');
        
        if (onTranscription) {
          onTranscription(transcript);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'no-speech' || event.error === 'aborted') {
          // Ignore these errors as they are common and often non-fatal
          return;
        }
        console.error('Speech recognition error', event.error);
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [onTranscription]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      console.warn('Speech recognition is not supported in this browser.');
      return;
    }

    try {
      if (isListening) {
        recognitionRef.current.stop();
      } else {
        recognitionRef.current.start();
      }
      setIsListening(!isListening);
    } catch (err) {
      console.error('Error with speech recognition:', err);
      setIsListening(false);
    }
  };

  const [supportedMimeType, setSupportedMimeType] = useState('audio/webm');

  useEffect(() => {
    const types = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav'];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        setSupportedMimeType(type);
        break;
      }
    }
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: supportedMimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (audioChunksRef.current.length === 0) {
          console.warn("No audio data captured.");
          setRecordedVoice(null);
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: supportedMimeType });
        fileToBase64(audioBlob).then(base64 => {
          setRecordedVoice(base64);
        }).catch(err => {
          console.error("Error converting audio to base64:", err);
        });
        
        // Stop all tracks to release the microphone
        stream.getTracks().forEach(track => track.stop());
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
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
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
  };
}
