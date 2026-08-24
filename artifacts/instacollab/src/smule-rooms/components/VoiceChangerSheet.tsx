import { useEffect, useState } from 'react';
import { Activity, Check, Mic2, Music2, User, Volume2, X } from 'lucide-react';
import {
  isOriginalVoiceEffect,
  isVoiceEffectSupported,
  type VoiceChangerEffectId,
} from '../utils/voiceEffects';
import { safeAvatarUrl } from '../../lib/safe';
import { V14_VOICES, V14_VOICE_TABS } from './liveToolsV14Artwork';
import './live-tools-approved-v15.css';

type VoiceChangerSheetProps = {
  open: boolean;
  effectId: VoiceChangerEffectId;
  onEffectChange: (effectId: VoiceChangerEffectId) => void;
  onClose: () => void;
  monitorEnabled?: boolean;
  onMonitorEnabledChange?: (enabled: boolean) => void;
  effectStrength?: number;
  onEffectStrengthChange?: (strength: number) => void;
  selfName?: string;
  selfAvatarUrl?: string;
  backgroundSoundOn?: boolean;
  onBackgroundSoundChange?: (enabled: boolean) => void;
};

export function VoiceChangerSheet({
  open,
  effectId,
  onEffectChange,
  onClose,
  monitorEnabled = false,
  onMonitorEnabledChange,
  effectStrength = 70,
  onEffectStrengthChange,
  selfName = 'You',
  selfAvatarUrl,
  backgroundSoundOn = true,
  onBackgroundSoundChange,
}: VoiceChangerSheetProps) {
  const [tab, setTab] = useState('All');
  const [pendingId, setPendingId] = useState<VoiceChangerEffectId>(
    isOriginalVoiceEffect(effectId) ? 'original' : effectId,
  );
  const [previewActive, setPreviewActive] = useState(false);

  useEffect(() => {
    if (open) setPendingId(isOriginalVoiceEffect(effectId) ? 'original' : effectId);
  }, [open, effectId]);

  if (!open) return null;

  const visible = V14_VOICES.filter((row) => (V14_VOICE_TABS[tab] ?? V14_VOICE_TABS.All).includes(row.id));
  const selected = V14_VOICES.find((row) => row.id === pendingId) ?? V14_VOICES[0];
  const canApply = isVoiceEffectSupported(selected.id);
  const selfAvatar = safeAvatarUrl(selfAvatarUrl || '');

  const closeSheet = () => {
    setPreviewActive(false);
    if (monitorEnabled || previewActive) onMonitorEnabledChange?.(false);
    onClose();
  };

  const apply = () => {
    if (!canApply) return;
    onEffectChange(selected.id);
    setPreviewActive(false);
    onMonitorEnabledChange?.(false);
    onClose();
  };

  const toggleMonitor = () => {
    if (!onMonitorEnabledChange || !canApply) return;
    const next = !(monitorEnabled || previewActive);
    if (next) onEffectChange(selected.id);
    setPreviewActive(next);
    onMonitorEnabledChange(next);
  };

  const handlePreview = () => {
    if (!onMonitorEnabledChange || !canApply) return;
    const next = !(previewActive || monitorEnabled);
    setPreviewActive(next);
    onMonitorEnabledChange(next);
    if (next) onEffectChange(selected.id);
  };

  return (
    <div className="lt15-overlay" data-ui-id="live.voice.v14.exact">
      <button type="button" className="lt15-scrim" aria-label="Close voice changer" onClick={closeSheet} />
      <section className="lt15-sheet lt15-voice" aria-label="Voice Changer">
        <div className="lt15-handle" />
        <div className="lt15-head">
          <div>
            <div className="lt15-title">
              <Mic2 size={18} color="#ff72d8" /> Voice Changer ✨
            </div>
            <div className="lt15-sub">Change your voice and have more fun!</div>
          </div>
          <div className="lt15-head-actions">
            {onMonitorEnabledChange ? (
              <button
                type="button"
                className={`lt15-soft-btn ${monitorEnabled ? 'is-on' : ''}`}
                onClick={toggleMonitor}
              >
                My Voice
              </button>
            ) : (
              <span className="lt15-soft-btn">My Voice</span>
            )}
            <button type="button" className="lt15-icon-btn" onClick={closeSheet} aria-label="Close">
              <X size={17} />
            </button>
          </div>
        </div>
        <div className="lt15-tabs">
          {Object.keys(V14_VOICE_TABS).map((label) => (
            <button
              type="button"
              className={`lt15-tab ${tab === label ? 'is-active' : ''}`}
              onClick={() => setTab(label)}
              key={label}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="lt15-voice-grid">
          {visible.map((row) => {
            const selectedRow = pendingId === row.id;
            return (
              <button
                type="button"
                key={row.id}
                className={`lt15-voice-option ${selectedRow ? 'selected' : ''}`}
                onClick={() => {
                  setPendingId(row.id);
                  if (isVoiceEffectSupported(row.id)) onEffectChange(row.id);
                }}
                aria-pressed={selectedRow}
              >
                <span className="lt15-voice-art">
                  <img src={row.artwork} alt="" />
                  {selectedRow ? <Check className="lt15-selection-check" size={14} strokeWidth={3} aria-hidden /> : null}
                </span>
                <span className="lt15-voice-label">{row.label}</span>
              </button>
            );
          })}
        </div>
        <div className="lt15-voice-controls">
          <div className="lt15-control-card">
            <h4><Activity size={14} aria-hidden /> Voice Effect <span aria-label="Information">ⓘ</span></h4>
            <div className="lt15-range-line">
              <Activity size={15} aria-hidden />
              <input
                className="lt15-range"
                type="range"
                min="0"
                max="100"
                value={effectStrength}
                onChange={(event) => onEffectStrengthChange?.(Number(event.target.value))}
                disabled={!onEffectStrengthChange || isOriginalVoiceEffect(selected.id)}
              />
              <span>{effectStrength}%</span>
            </div>
          </div>
          <button
            type="button"
            className={`lt15-control-card lt15-bg-sound ${backgroundSoundOn ? 'is-on' : ''}`}
            onClick={() => onBackgroundSoundChange?.(!backgroundSoundOn)}
          >
            <h4><Music2 size={14} aria-hidden /> Background Sound</h4>
            <div className="lt15-bg-sound-name"><Music2 size={13} aria-hidden /> Magic Forest <span>›</span></div>
          </button>
        </div>
        <div className="lt15-footer">
          <div className="lt15-recipient">
            <div className="lt15-recipient-avatar">
              {selfAvatar ? <img src={selfAvatar} alt="" /> : <User size={20} aria-hidden />}
            </div>
            <div>
              <small>Send to</small>
              <b>{selfName}</b>
            </div>
            <span>›</span>
          </div>
          <button type="button" className="lt15-preview" onClick={handlePreview} disabled={!canApply}>
            <Volume2 size={15} aria-hidden /> Preview
          </button>
          <button
            type="button"
            className="lt15-primary"
            onClick={apply}
            disabled={!canApply}
          >
            <Mic2 size={17} aria-hidden /> Apply Voice
          </button>
        </div>
      </section>
    </div>
  );
}
