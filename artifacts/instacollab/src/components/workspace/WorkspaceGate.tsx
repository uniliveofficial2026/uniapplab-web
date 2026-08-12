import React, { useCallback, useEffect, useState } from 'react';
import { clearWorkspaceSessionUnlock } from '../../lib/workspaceAccess';
import { useKeepAliveTabActive } from '../../lib/keepAliveTabContext';
import { requestWorkspaceAdminTab } from '../../lib/appBrandRuntime';
import { useGreedySession } from '../../contexts/GreedySessionContext';
import { WorkspaceAuthScreen } from './WorkspaceAuthScreen';
import WorkspaceScreen from './WorkspaceScreen';

function isWorkspaceDeepLink(): boolean {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname.replace(/\/+$/, '');
  return path === '/workspace' || path.endsWith('/workspace');
}

/**
 * Workspace always requires the staff access code.
 * After unlock you land in Workspace (Admin & Portal).
 * Fullscreen Greedy admin is opened from inside Workspace — not instead of it.
 */
export function WorkspaceGate() {
  const tabActive = useKeepAliveTabActive();
  const { adminOpen } = useGreedySession();
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    clearWorkspaceSessionUnlock();
  }, []);

  // /workspace deep link → open Admin & Portal after unlock (not auto Greedy).
  useEffect(() => {
    if (!tabActive) return;
    if (!isWorkspaceDeepLink()) return;
    requestWorkspaceAdminTab();
  }, [tabActive]);

  // Re-lock when leaving Workspace — except while fullscreen Greedy admin is open,
  // so "Return to Workspace" does not demand the code again immediately.
  useEffect(() => {
    if (tabActive) return;
    if (adminOpen) return;
    clearWorkspaceSessionUnlock();
    setUnlocked(false);
  }, [tabActive, adminOpen]);

  const handleUnlocked = useCallback(() => {
    // Keep admin-tab hint for WorkspaceScreen (Admin & Portal).
    setUnlocked(true);
  }, []);

  if (!unlocked) {
    return <WorkspaceAuthScreen onUnlocked={handleUnlocked} />;
  }

  return <WorkspaceScreen />;
}

export default WorkspaceGate;
