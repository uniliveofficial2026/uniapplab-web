import React from 'react';
import { useDB } from '../../lib/useDB';
import { getSupabaseClient } from '../../lib/supabase/client';

export function BannedScreen() {
  const db = useDB();
  const me = db.currentUser;
  const reason = me?.banReason?.trim();

  const handleSignOut = async () => {
    const supabase = getSupabaseClient();
    if (supabase) await supabase.auth.signOut();
    db.logout();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-background text-foreground">
      <h1 className="text-2xl font-semibold mb-3">Account suspended</h1>
      <p className="text-muted-foreground max-w-md mb-2">
        Your account has been banned and cannot access InstaCollab.
      </p>
      {reason ? (
        <p className="text-sm text-muted-foreground max-w-md mb-6">Reason: {reason}</p>
      ) : (
        <div className="mb-6" />
      )}
      <button
        type="button"
        onClick={() => void handleSignOut()}
        className="px-4 py-2 rounded-lg bg-primary text-primary-foreground"
      >
        Sign out
      </button>
    </div>
  );
}
