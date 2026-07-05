import React, { useState } from 'react';
import { LayoutDashboard, Lock, Shield } from 'lucide-react';
import { verifyWorkspaceAccessCode } from '../../lib/workspaceAccess';

type WorkspaceAuthScreenProps = {
  onUnlocked: () => void;
};

/**
 * Staff-only gate for Workspace.
 * Access code is required on every visit (never shown in the UI, never persisted).
 */
export function WorkspaceAuthScreen({ onUnlocked }: WorkspaceAuthScreenProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    const ok = verifyWorkspaceAccessCode(code);
    if (!ok) {
      setError('Invalid access code.');
      setCode('');
      setSubmitting(false);
      return;
    }

    onUnlocked();
    setSubmitting(false);
  };

  return (
    <div className="flex flex-col h-full w-full max-w-[420px] mx-auto px-4 py-10 md:py-16">
      <div className="flex-1 flex flex-col justify-center">
        <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <LayoutDashboard className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Workspace access</h1>
              <p className="text-sm text-muted-foreground mt-1.5">
                Enter your access code to continue. You will be asked again each time you open
                Workspace.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                Access code
              </span>
              <input
                type="password"
                name="workspace-access-code"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                inputMode="numeric"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="••••"
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-base font-semibold tracking-[0.35em] text-center text-foreground placeholder:tracking-normal placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                aria-label="Workspace access code"
                aria-invalid={Boolean(error)}
              />
            </label>

            {error ? (
              <p className="text-sm font-medium text-destructive text-center" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting || !code.trim()}
              className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground font-bold py-3 px-4 transition-opacity disabled:opacity-50"
            >
              <Shield className="w-4 h-4" />
              Unlock Workspace
            </button>
          </form>

          <p className="text-[11px] text-center text-muted-foreground leading-relaxed">
            This area is restricted. Access is not saved — leave and return to enter the code again.
          </p>
        </div>
      </div>
    </div>
  );
}
