import React from 'react';
import { Copy } from 'lucide-react';
import { launchInputClass } from './launchUi';

type PublicUserIdFieldProps = {
  value: string;
  onChange: (value: string) => void;
  onCopy: () => void;
  onBlur?: () => void;
  disabled?: boolean;
  hint?: string | null;
  id?: string;
};

export function PublicUserIdField({
  value,
  onChange,
  onCopy,
  onBlur,
  disabled = false,
  hint,
  id,
}: PublicUserIdFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        User ID
      </span>
      <div className="flex gap-2">
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
          className={`${launchInputClass} flex-1 font-mono text-sm lowercase ${
            disabled ? 'bg-secondary/30 text-foreground/70 cursor-not-allowed' : ''
          }`}
        />
        <button
          type="button"
          onClick={onCopy}
          disabled={!value.trim()}
          className="shrink-0 rounded-xl border border-border bg-card/80 px-3 text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors disabled:opacity-40"
          aria-label="Copy user ID"
        >
          <Copy className="w-5 h-5" />
        </button>
      </div>
      {hint ? (
        <p className="text-[11px] text-muted-foreground leading-snug">{hint}</p>
      ) : (
        <p className="text-[11px] text-muted-foreground leading-snug">
          Letters, numbers, and underscores only (3–24). You can change this once every 7 days after
          setup.
        </p>
      )}
    </div>
  );
}
