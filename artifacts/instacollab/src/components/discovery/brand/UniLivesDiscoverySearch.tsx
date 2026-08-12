import React from 'react';
import { Search } from 'lucide-react';

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
  inputClassName?: string;
};

/**
 * Search field chrome only — parent owns query state/debounce/endpoints.
 * Preserves text input semantics.
 */
export function UniLivesDiscoverySearch({
  value,
  onChange,
  placeholder = 'Search...',
  type = 'text',
  className = 'relative mb-4 shrink-0',
  inputClassName,
}: Props) {
  return (
    <div className={className} data-unilives-discovery-search="">
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
        <Search className="h-5 w-5 text-[color:var(--color-unilives-discovery-muted)]" />
      </div>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={
          inputClassName ??
          'w-full bg-[color:var(--color-unilives-discovery-surface)] text-[color:var(--color-unilives-discovery-text)] text-[15px] font-medium rounded-2xl pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-[color:var(--color-unilives-discovery-selected)]/20 transition-all border border-transparent focus:border-[color:var(--color-unilives-discovery-border)]'
        }
      />
    </div>
  );
}
