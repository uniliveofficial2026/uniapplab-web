import React from 'react';
import { ScanFace, Sparkles } from 'lucide-react';
import {
  CAMERA_AR_BUTTON_LABEL,
  CAMERA_BEAUTY_BUTTON_LABEL,
} from '../../lib/camera/cameraBeautyLabels';

export type CameraDualBeautyButtonsProps = {
  /** Large glass buttons for fullscreen capture overlays. */
  variant?: 'capture' | 'inline' | 'call';
  disabled?: boolean;
  deeparPanelOpen: boolean;
  beautyPanelOpen: boolean;
  deeparActive: boolean;
  beautyActive: boolean;
  onToggleDeepAR: () => void;
  onToggleBeauty: () => void;
  showDeepAR?: boolean;
  showBeauty?: boolean;
  className?: string;
};

const captureBtn =
  'w-14 h-14 rounded-full flex items-center justify-center border border-white/25 bg-black/80 backdrop-blur-xl shadow-[0_4px_22px_rgba(0,0,0,0.6)]';
const inlineBeautyBtn =
  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-wide backdrop-blur-xl shadow-[0_4px_18px_rgba(0,0,0,0.55)] disabled:opacity-40';
const captureLabel =
  'text-[10px] font-bold uppercase drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]';

/** Shared AR + Beauty toggle buttons for every camera surface. */
export function CameraDualBeautyButtons({
  variant = 'capture',
  disabled = false,
  deeparPanelOpen,
  beautyPanelOpen,
  deeparActive,
  beautyActive,
  onToggleDeepAR,
  onToggleBeauty,
  showDeepAR = true,
  showBeauty = true,
  className = '',
}: CameraDualBeautyButtonsProps) {
  if (variant === 'call') {
    const callBtn = 'h-14 w-14';
    const callIcon = 'h-6 w-6';
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {showDeepAR ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onToggleDeepAR}
            className={`flex ${callBtn} items-center justify-center rounded-full transition-colors ${
              deeparPanelOpen || deeparActive
                ? 'bg-fuchsia-500/90 text-white'
                : 'bg-white/15 text-white hover:bg-white/25'
            }`}
            aria-label="AR effects"
            aria-pressed={deeparPanelOpen || deeparActive}
          >
            <Sparkles className={callIcon} />
          </button>
        ) : null}
        {showBeauty ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onToggleBeauty}
            className={`flex ${callBtn} items-center justify-center rounded-full transition-colors ${
              beautyPanelOpen || beautyActive
                ? 'bg-rose-500/90 text-white'
                : 'bg-white/15 text-white hover:bg-white/25'
            }`}
            aria-label="Beauty effects"
            aria-pressed={beautyPanelOpen || beautyActive}
          >
            <ScanFace className={callIcon} />
          </button>
        ) : null}
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {showDeepAR ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onToggleDeepAR}
            className={`${inlineBeautyBtn} ${
              deeparPanelOpen || deeparActive
                ? 'border-fuchsia-400/55 bg-fuchsia-500/25 text-fuchsia-100'
                : 'border-white/25 bg-black/80 text-white/90 hover:bg-black/90'
            }`}
            aria-label="AR effects"
            aria-pressed={deeparPanelOpen || deeparActive}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {CAMERA_AR_BUTTON_LABEL}
          </button>
        ) : null}
        {showBeauty ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onToggleBeauty}
            className={`${inlineBeautyBtn} ${
              beautyPanelOpen || beautyActive
                ? 'border-rose-300/65 bg-rose-600/35 text-rose-50'
                : 'border-white/25 bg-black/80 text-white/90 hover:bg-black/90'
            }`}
            aria-label="Beauty effects"
            aria-pressed={beautyPanelOpen || beautyActive}
          >
            <ScanFace className="h-3.5 w-3.5" />
            {CAMERA_BEAUTY_BUTTON_LABEL}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      {showDeepAR ? (
        <button
          type="button"
          disabled={disabled}
          onClick={onToggleDeepAR}
          className="flex flex-col items-center gap-1.5 text-white disabled:opacity-40"
          aria-label={deeparPanelOpen ? 'Close AR effects' : 'AR effects'}
          aria-pressed={deeparPanelOpen || deeparActive}
        >
          <span
            className={`${captureBtn} ${
              deeparPanelOpen || deeparActive
                ? 'border-fuchsia-300/70 bg-fuchsia-500/35'
                : 'hover:bg-black/90'
            }`}
          >
            <Sparkles className="w-6 h-6" />
          </span>
          <span className={captureLabel}>{CAMERA_AR_BUTTON_LABEL}</span>
        </button>
      ) : null}
      {showBeauty ? (
        <button
          type="button"
          disabled={disabled}
          onClick={onToggleBeauty}
          className="flex flex-col items-center gap-1.5 text-white disabled:opacity-40"
          aria-label={beautyPanelOpen ? 'Close Beauty' : 'Beauty effects'}
          aria-pressed={beautyPanelOpen || beautyActive}
        >
          <span
            className={`${captureBtn} ${
              beautyPanelOpen || beautyActive
                ? 'border-rose-300/70 bg-rose-600/40'
                : 'bg-black/80 hover:bg-black/90'
            }`}
          >
            <ScanFace className="w-6 h-6" />
          </span>
          <span className={captureLabel}>{CAMERA_BEAUTY_BUTTON_LABEL}</span>
        </button>
      ) : null}
    </div>
  );
}
