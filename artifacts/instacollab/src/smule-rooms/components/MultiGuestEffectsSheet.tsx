import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { BodyShapeTray } from '../../components/camera/BodyShapeTray';
import { CameraBeautyBottomShell } from '../../components/camera/CameraBeautyBottomShell';
import { DeepARFilterCarousel } from '../../components/deepar/DeepARFilterCarousel';
import { CAMERA_AR_PANEL_TITLE } from '../../lib/camera/cameraBeautyLabels';
import { EMPTY_BODY_SHAPE, type BodyShapeParams } from '../../lib/ar/bodyShape';
import type { DeepAREffectSelection } from '../../lib/deepar/deeparEffectSelection';
import { EMPTY_DEEPAR_EFFECT_SELECTION } from '../../lib/deepar/deeparEffectSelection';

type ArTab = 'effects' | 'shape';

type MultiGuestEffectsSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  /** Legacy single-effect id (used when activeSelection is omitted). */
  activeEffectId?: string;
  onSelectEffect?: (effectId: string) => void;
  /** Multi-slot selection — one effect per category (like Beauty trays). */
  activeSelection?: DeepAREffectSelection;
  onSelectionChange?: (selection: DeepAREffectSelection) => void;
  bodyShape?: BodyShapeParams;
  onBodyShapeChange?: (shape: BodyShapeParams) => void;
  loading?: boolean;
  cameraReady?: boolean;
  /** Pixels from bottom edge — matches footer height so panel sits above footer. */
  anchorBottom?: number;
  anchorMode?: 'fixed' | 'container';
};

const AR_TABS: Array<{ id: ArTab; label: string }> = [
  { id: 'effects', label: 'Effects' },
  { id: 'shape', label: 'Shape' },
];

export function MultiGuestEffectsSheet({
  isOpen,
  onClose,
  activeEffectId = 'none',
  onSelectEffect,
  activeSelection = EMPTY_DEEPAR_EFFECT_SELECTION,
  onSelectionChange,
  bodyShape = EMPTY_BODY_SHAPE,
  onBodyShapeChange,
  loading = false,
  cameraReady = false,
  anchorBottom = 0,
  anchorMode = 'fixed',
}: MultiGuestEffectsSheetProps) {
  const multiSelect = Boolean(onSelectionChange);
  const [tab, setTab] = useState<ArTab>('effects');

  return (
    <CameraBeautyBottomShell
      isOpen={isOpen}
      onClose={onClose}
      title={CAMERA_AR_PANEL_TITLE}
      titleIcon={<Sparkles size={12} aria-hidden />}
      accent="fuchsia"
      anchorBottom={anchorBottom}
      anchorMode={anchorMode}
      loading={loading}
      loadingLabel="Loading AR…"
    >
      <div className="mb-2 flex gap-1 overflow-x-auto scrollbar-hide touch-pan-x">
        {AR_TABS.map((entry) => {
          const active = tab === entry.id;
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => setTab(entry.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wide transition touch-manipulation ${
                active
                  ? 'bg-fuchsia-600/40 text-fuchsia-50 border border-fuchsia-200/60'
                  : 'bg-black/75 text-white/80 border border-white/20 hover:bg-black/85 hover:text-white'
              }`}
            >
              {entry.label}
            </button>
          );
        })}
      </div>

      {tab === 'effects' ? (
        <DeepARFilterCarousel
          activeEffectId={activeEffectId}
          onSelect={onSelectEffect ?? (() => undefined)}
          activeSelection={activeSelection}
          onSelectionChange={onSelectionChange}
          multiSelect={multiSelect}
          disabled={!cameraReady}
          deepAROnly
        />
      ) : null}

      {tab === 'shape' ? (
        <BodyShapeTray
          bodyShape={bodyShape}
          onBodyShapeChange={onBodyShapeChange ?? (() => undefined)}
          accent="fuchsia"
        />
      ) : null}
    </CameraBeautyBottomShell>
  );
}
