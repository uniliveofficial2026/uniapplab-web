const CHORD_FREQUENCIES: Record<string, number[]> = {
  'C Maj': [130.81, 164.81, 196.0, 261.63],
  'G Maj': [98.0, 146.83, 196.0, 246.94],
  'A Min': [110.0, 130.81, 220.0, 261.63],
  'F Maj': [87.31, 130.81, 174.61, 220.0],
  'E Min': [82.41, 123.47, 164.81, 196.0],
};

const ROTATION = ['C Maj', 'G Maj', 'A Min', 'F Maj', 'E Min'] as const;

export function getChordForLyricLine(lineIndex: number): string {
  return ROTATION[Math.max(0, lineIndex) % ROTATION.length] ?? 'C Maj';
}

export function triggerSynthChord(audioContext: AudioContext, chordName: string) {
  if (audioContext.state === 'suspended') return;

  const freqs = CHORD_FREQUENCIES[chordName] ?? CHORD_FREQUENCIES['C Maj']!;
  const now = audioContext.currentTime;

  freqs.forEach((freq) => {
    const osc = audioContext.createOscillator();
    const filter = audioContext.createBiquadFilter();
    const gain = audioContext.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    osc.detune.setValueAtTime((Math.random() - 0.5) * 15, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, now);
    filter.frequency.exponentialRampToValueAtTime(1400, now + 1.2);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.05, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioContext.destination);

    osc.start(now);
    osc.stop(now + 1.5);
  });

  const bufferSize = audioContext.sampleRate * 0.05;
  const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = audioContext.createBufferSource();
  noise.buffer = buffer;

  const clickFilter = audioContext.createBiquadFilter();
  clickFilter.type = 'highpass';
  clickFilter.frequency.setValueAtTime(8000, now);

  const clickGain = audioContext.createGain();
  clickGain.gain.setValueAtTime(0.01, now);
  clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

  noise.connect(clickFilter);
  clickFilter.connect(clickGain);
  clickGain.connect(audioContext.destination);

  noise.start(now);
  noise.stop(now + 0.05);
}
