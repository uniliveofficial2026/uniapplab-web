import React from 'react';
import { FileText, Shield } from 'lucide-react';
import { UniLivesLegalMedia } from './UniLivesLegalMedia';

type NavItem = {
  label: string;
  onClick: () => void;
  kind?: 'privacy' | 'terms';
};

type Props = {
  items: NavItem[];
  className?: string;
};

/** Styled legal link buttons — handlers and destinations supplied by parent. */
export function UniLivesLegalNavigation({ items, className = '' }: Props) {
  return (
    <nav className={`flex flex-wrap gap-x-3 gap-y-1 ${className}`.trim()} data-unilives-legal-navigation="" aria-label="Legal documents">
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={item.onClick}
          className="inline-flex items-center gap-1.5 text-[color:var(--color-unilives-primary)] hover:underline underline-offset-2 unilives-focus-ring font-semibold text-xs"
        >
          {item.kind === 'privacy' ? (
            <UniLivesLegalMedia
              kind="privacy-icon"
              legacyNode={<Shield className="w-3.5 h-3.5" aria-hidden />}
              imgClassName="w-3.5 h-3.5"
              decorative
            />
          ) : item.kind === 'terms' ? (
            <UniLivesLegalMedia
              kind="terms-icon"
              legacyNode={<FileText className="w-3.5 h-3.5" aria-hidden />}
              imgClassName="w-3.5 h-3.5"
              decorative
            />
          ) : null}
          {item.label}
        </button>
      ))}
    </nav>
  );
}
