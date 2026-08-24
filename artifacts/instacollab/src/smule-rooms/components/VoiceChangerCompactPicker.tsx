import { useState } from 'react';
import { Check } from 'lucide-react';
import {
  getVoiceChangerEffect,
  isOriginalVoiceEffect,
  isVoiceEffectSupported,
  type VoiceChangerEffectId,
} from '../utils/voiceEffects';
import { V14_VOICES, V14_VOICE_TABS } from './liveToolsV14Artwork';
import './live-tools-approved-v15.css';

type VoiceChangerCompactPickerProps = {
  effectId: VoiceChangerEffectId;
  onEffectChange?: (effectId: VoiceChangerEffectId) => void;
  className?: string;
  embedded?: boolean;
};

export function VoiceChangerCompactPicker({
  effectId,
  onEffectChange,
  className = '',
  embedded = false,
}: VoiceChangerCompactPickerProps) {
  const [tab, setTab] = useState('All');
  const activeId = isOriginalVoiceEffect(effectId) ? 'original' : effectId;
  const activeEffect = getVoiceChangerEffect(activeId);
  const visible = V14_VOICES.filter((row) => (V14_VOICE_TABS[tab] ?? V14_VOICE_TABS.All).includes(row.id));

  return (
    <div
      className={`lt15-voice-compact${embedded ? ' is-embedded' : ''} ${className}`.trim()}
      data-ui-id="live.voice.v14.compact"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="lt15-voice-compact__head">
        <span>Voice Changer</span>
        <span>{activeEffect.label}</span>
      </div>
      <div className="lt15-tabs lt15-voice-compact__tabs">
        {Object.keys(V14_VOICE_TABS).map((label) => (
          <button
            type="button"
            key={label}
            className={`lt15-tab ${tab === label ? 'is-active' : ''}`}
            onClick={() => setTab(label)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="lt15-voice-grid lt15-voice-compact__grid">
        {visible.map((row) => {
          const selected = activeId === row.id;
          const supported = isVoiceEffectSupported(row.id);
          return (
            <button
              type="button"
              key={row.id}
              className={`lt15-voice-option ${selected ? 'selected' : ''}`}
              disabled={!supported || !onEffectChange}
              onClick={() => {
                if (!supported || !onEffectChange) return;
                onEffectChange(row.id);
              }}
              aria-pressed={selected}
              aria-label={`Voice effect ${row.label}`}
            >
              <span className="lt15-voice-art">
                <img src={row.artwork} alt="" />
                {selected ? <Check className="lt15-selection-check" size={12} strokeWidth={3} aria-hidden /> : null}
              </span>
              <span className="lt15-voice-label">{row.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
