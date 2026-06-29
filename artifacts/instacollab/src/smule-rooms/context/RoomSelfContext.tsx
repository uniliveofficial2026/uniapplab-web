import React, { createContext, useContext, useMemo } from 'react';
import { useCurrentUser } from '../../lib/useCurrentUser';
import { userToRoomSelfIdentity, type RoomSelfIdentity } from '../utils/selfIdentity';

const RoomSelfContext = createContext<RoomSelfIdentity | null>(null);

export function RoomSelfProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const currentUser = useCurrentUser();
  const identity = useMemo(
    () => userToRoomSelfIdentity(currentUser),
    [currentUser.id, currentUser.username, currentUser.displayName, currentUser.avatarUrl],
  );

  return (
    <RoomSelfContext.Provider value={identity}>{children}</RoomSelfContext.Provider>
  );
}

export function useRoomSelf(): RoomSelfIdentity {
  const ctx = useContext(RoomSelfContext);
  const currentUser = useCurrentUser();
  const fallback = useMemo(
    () => userToRoomSelfIdentity(currentUser),
    [currentUser.id, currentUser.username, currentUser.displayName, currentUser.avatarUrl],
  );
  return ctx ?? fallback;
}
