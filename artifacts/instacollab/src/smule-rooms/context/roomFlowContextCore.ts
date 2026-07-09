import { createContext } from 'react';

export type RoomFlowEntry =
  | 'karaoke-profile-manage'
  | 'karaoke-profile-saved'
  | 'karaoke-party'
  | 'admin-embed'
  | 'live-discovery'
  | 'default';

export type RoomSettingsNavState = { fromLiveRoom?: boolean };

export type RoomFlowContextValue = {
  onExit: () => void;
  entry: RoomFlowEntry;
};

export const RoomFlowContext = createContext<RoomFlowContextValue | null>(null);
