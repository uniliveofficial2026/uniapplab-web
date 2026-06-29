import { useCallback, useContext } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { RoomFlowContext, type RoomFlowEntry, type RoomSettingsNavState } from './roomFlowContextCore';

export type { RoomFlowEntry, RoomSettingsNavState };

export function liveRoomSettingsNavState(): RoomSettingsNavState {
  return { fromLiveRoom: true };
}

export function useRoomFlowExit(): () => void {
  const ctx = useContext(RoomFlowContext);
  return ctx?.onExit ?? (() => {});
}

export function useRoomFlowEntry(): RoomFlowEntry {
  return useContext(RoomFlowContext)?.entry ?? 'default';
}

/** Back from room settings — returns to live room when opened in-room; else exits embed from Manage Rooms. */
export function useRoomSettingsNavigateBack(): () => void {
  const ctx = useContext(RoomFlowContext);
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(() => {
    const navState = location.state as RoomSettingsNavState | null;
    if (navState?.fromLiveRoom) {
      navigate(-1);
      return;
    }
    if (ctx?.entry === 'karaoke-profile-manage') {
      ctx.onExit();
      return;
    }
    navigate(-1);
  }, [ctx, navigate, location.state]);
}
