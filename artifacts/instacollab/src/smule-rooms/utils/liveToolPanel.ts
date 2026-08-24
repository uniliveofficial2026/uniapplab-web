/** Mutually exclusive live-room tool panels. Opening one closes the others without unmounting the livestream. */
export type LiveToolPanel =
  | 'gift'
  | 'guests'
  | 'games'
  | 'voice'
  | 'beauty'
  | 'effects'
  | 'stickers'
  | null;

export type LiveToolPanelSetters = {
  setGift?: (open: boolean) => void;
  setGuests?: (open: boolean) => void;
  setGames?: (open: boolean) => void;
  setVoice?: (open: boolean) => void;
  setBeauty?: (open: boolean) => void;
  setEffects?: (open: boolean) => void;
  setStickers?: (open: boolean) => void;
};

export function closeAllLiveToolPanels(setters: LiveToolPanelSetters): void {
  setters.setGift?.(false);
  setters.setGuests?.(false);
  setters.setGames?.(false);
  setters.setVoice?.(false);
  setters.setBeauty?.(false);
  setters.setEffects?.(false);
  setters.setStickers?.(false);
}

export function openLiveToolPanel(
  panel: Exclude<LiveToolPanel, null>,
  setters: LiveToolPanelSetters,
): void {
  closeAllLiveToolPanels(setters);
  switch (panel) {
    case 'gift':
      setters.setGift?.(true);
      break;
    case 'guests':
      setters.setGuests?.(true);
      break;
    case 'games':
      setters.setGames?.(true);
      break;
    case 'voice':
      setters.setVoice?.(true);
      break;
    case 'beauty':
      setters.setBeauty?.(true);
      break;
    case 'effects':
      setters.setEffects?.(true);
      break;
    case 'stickers':
      setters.setStickers?.(true);
      break;
    default:
      break;
  }
}
