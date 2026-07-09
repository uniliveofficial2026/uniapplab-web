import { useCallback, useRef, useState } from 'react';
import {
  clampCommerceCardPosition,
  clampGameLiveEdgePosition,
  type CommerceCardPosition,
} from '../utils/liveRoomTypes';

type DragSession = {
  pointerId: number;
  startX: number;
  startY: number;
  origin: CommerceCardPosition;
  moved: boolean;
};

type UsePercentOverlayDragOptions = {
  position: CommerceCardPosition;
  onPositionChange: (position: CommerceCardPosition) => void;
  enabled?: boolean;
  clampPosition?: (position: CommerceCardPosition) => CommerceCardPosition;
  /** Measure overlay size so the widget can sit flush against stage edges without clipping. */
  edgeToEdge?: boolean;
};

const MOVE_THRESHOLD_PX = 6;

export function usePercentOverlayDrag({
  position,
  onPositionChange,
  enabled = true,
  clampPosition = clampCommerceCardPosition,
  edgeToEdge = false,
}: UsePercentOverlayDragOptions) {
  const dragRef = useRef<DragSession | null>(null);
  const overlayRef = useRef<HTMLElement | null>(null);
  const suppressClickRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [draftPosition, setDraftPosition] = useState<CommerceCardPosition | null>(null);

  const displayPosition = draftPosition ?? position;

  const resolvePosition = useCallback(
    (nextPosition: CommerceCardPosition, stage: HTMLElement | null) => {
      if (!edgeToEdge || !stage || !overlayRef.current) {
        return clampPosition(nextPosition);
      }
      const stageRect = stage.getBoundingClientRect();
      const overlayRect = overlayRef.current.getBoundingClientRect();
      return clampGameLiveEdgePosition(nextPosition, {
        stageWidth: stageRect.width,
        stageHeight: stageRect.height,
        elementWidth: overlayRect.width,
        elementHeight: overlayRect.height,
      });
    },
    [clampPosition, edgeToEdge],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>, stage: HTMLElement | null) => {
      if (!enabled || event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      if (!stage) return;

      overlayRef.current =
        event.currentTarget.closest<HTMLElement>('.game-live-draggable') ??
        event.currentTarget.parentElement;

      suppressClickRef.current = false;
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        origin: displayPosition,
        moved: false,
      };
      setDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);

      const onMove = (moveEvent: PointerEvent) => {
        const drag = dragRef.current;
        if (!drag || moveEvent.pointerId !== drag.pointerId) return;
        const bounds = stage.getBoundingClientRect();
        if (bounds.width < 1 || bounds.height < 1) return;

        const pixelDx = moveEvent.clientX - drag.startX;
        const pixelDy = moveEvent.clientY - drag.startY;
        if (
          !drag.moved &&
          (Math.abs(pixelDx) > MOVE_THRESHOLD_PX || Math.abs(pixelDy) > MOVE_THRESHOLD_PX)
        ) {
          drag.moved = true;
          suppressClickRef.current = true;
        }

        const dx = (pixelDx / bounds.width) * 100;
        const dy = (pixelDy / bounds.height) * 100;
        setDraftPosition(
          resolvePosition(
            {
              x: drag.origin.x + dx,
              y: drag.origin.y + dy,
            },
            stage,
          ),
        );
      };

      const onUp = (upEvent: PointerEvent) => {
        const drag = dragRef.current;
        if (!drag || upEvent.pointerId !== drag.pointerId) return;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        dragRef.current = null;
        overlayRef.current = null;
        setDragging(false);
        setDraftPosition((prev) => {
          const finalPosition = resolvePosition(prev ?? drag.origin, stage);
          onPositionChange(finalPosition);
          return null;
        });
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [displayPosition, enabled, onPositionChange, resolvePosition],
  );

  const consumeClickIfDragged = useCallback(() => {
    if (!suppressClickRef.current) return false;
    suppressClickRef.current = false;
    return true;
  }, []);

  return {
    displayPosition,
    dragging,
    handlePointerDown,
    consumeClickIfDragged,
  };
}
