import React from 'react';
import { Check, Copy, Loader2, X } from 'lucide-react';
import {
  publicUserIdAvailabilityMessage,
  type PublicUserIdAvailabilityStatus,
} from '../../lib/publicUserId';
import { launchInputClass } from './launchUi';

type PublicUserIdFieldProps = {
  value: string;
  onChange: (value: string) => void;
  onCopy: () => void;
  onBlur?: () => void;
  disabled?: boolean;
  hint?: string | null;
  id?: string;
  /** Visual-only input class override. Defaults to launch input styles. */
  inputClass?: string;
  /** Live uniqueness status from usePublicUserIdAvailability. */
  availability?: PublicUserIdAvailabilityStatus;
};

export function PublicUserIdField({
  value,
  onChange,
  onCopy,
  onBlur,
  disabled = false,
  hint,
  id,
  inputClass = launchInputClass,
  availability = 'idle',
}: PublicUserIdFieldProps) {
  const statusMessage = publicUserIdAvailabilityMessage(availability);
  const borderTone =
    availability === 'taken' || availability === 'unreachable' || availability === 'invalid'
      ? 'ring-2 ring-[color:var(--color-unilives-profile-setup-error)]/40 border-[color:var(--color-unilives-profile-setup-error)]/50'
      : availability === 'available'
        ? 'ring-2 ring-[color:var(--color-unilives-profile-setup-success)]/30 border-[color:var(--color-unilives-profile-setup-success)]/40'
        : '';

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-bold uppercase tracking-wide text-[color:var(--color-unilives-profile-setup-muted)]">
        User ID
      </span>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            id={id}
            type="text"
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            placeholder="my_unique_id"
            minLength={3}
            maxLength={24}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={
              availability === 'taken' ||
              availability === 'unreachable' ||
              availability === 'invalid'
            }
            className={`${inputClass} w-full font-mono text-sm lowercase pr-10 ${borderTone} ${
              disabled ? 'bg-[color:var(--color-unilives-profile-setup-surface)]/30 text-[color:var(--color-unilives-profile-setup-text)]/70 cursor-not-allowed' : ''
            }`}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--color-unilives-profile-setup-muted)]">
            {availability === 'checking' ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
            ) : availability === 'available' ? (
              <Check className="w-4 h-4 text-[color:var(--color-unilives-profile-setup-success)]" aria-hidden />
            ) : availability === 'taken' || availability === 'unreachable' ? (
              <X className="w-4 h-4 text-[color:var(--color-unilives-profile-setup-error)]" aria-hidden />
            ) : null}
          </span>
        </div>
        <button
          type="button"
          onClick={onCopy}
          disabled={!value.trim()}
          className="shrink-0 rounded-xl border border-[color:var(--color-unilives-profile-setup-border)] bg-[color:var(--color-unilives-profile-setup-surface)] px-3 text-[color:var(--color-unilives-profile-setup-muted)] hover:text-[color:var(--color-unilives-profile-setup-text)] transition-colors disabled:opacity-40"
          aria-label="Copy user ID"
        >
          <Copy className="w-5 h-5" />
        </button>
      </div>
      {statusMessage ? (
        <p
          className={`text-[11px] leading-snug ${
            availability === 'available'
              ? 'text-[color:var(--color-unilives-profile-setup-success)]'
              : availability === 'taken' ||
                  availability === 'unreachable' ||
                  availability === 'invalid'
                ? 'text-[color:var(--color-unilives-profile-setup-error)]'
                : 'text-[color:var(--color-unilives-profile-setup-muted)]'
          }`}
          role="status"
        >
          {statusMessage}
        </p>
      ) : hint ? (
        <p className="text-[11px] text-[color:var(--color-unilives-profile-setup-muted)] leading-snug">{hint}</p>
      ) : (
        <p className="text-[11px] text-[color:var(--color-unilives-profile-setup-muted)] leading-snug">
          Letters, numbers, and underscores only (3–24). Must be unique — cannot match another
          account. You can change this once every 7 days after setup.
        </p>
      )}
    </div>
  );
}
