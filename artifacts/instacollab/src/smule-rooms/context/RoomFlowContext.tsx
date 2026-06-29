import React from 'react';
import { RoomFlowContext, type RoomFlowEntry } from './roomFlowContextCore';

export type { RoomFlowEntry, RoomSettingsNavState } from './roomFlowContextCore';
export {
  liveRoomSettingsNavState,
  useRoomFlowEntry,
  useRoomFlowExit,
  useRoomSettingsNavigateBack,
} from './roomFlowHooks';

export function RoomFlowProvider({
  onExit,
  entry = 'default',
  children,
}: {
  onExit: () => void;
  entry?: RoomFlowEntry;
  children: React.ReactNode;
}) {
  return (
    <RoomFlowContext.Provider value={{ onExit, entry }}>{children}</RoomFlowContext.Provider>
  );
}
