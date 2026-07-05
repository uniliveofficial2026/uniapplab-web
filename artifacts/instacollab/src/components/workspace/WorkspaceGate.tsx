import React, { useCallback, useEffect, useState } from 'react';
import { clearWorkspaceSessionUnlock } from '../../lib/workspaceAccess';
import { WorkspaceAuthScreen } from './WorkspaceAuthScreen';
import WorkspaceScreen from './WorkspaceScreen';

/**
 * Workspace always requires the staff code on every visit.
 * Unlock is in-memory only for this mount — leave and return asks again.
 */
export function WorkspaceGate() {
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    clearWorkspaceSessionUnlock();
    setUnlocked(false);
  }, []);

  const handleUnlocked = useCallback(() => {
    setUnlocked(true);
  }, []);

  if (!unlocked) {
    return <WorkspaceAuthScreen onUnlocked={handleUnlocked} />;
  }

  return <WorkspaceScreen />;
}

export default WorkspaceGate;
