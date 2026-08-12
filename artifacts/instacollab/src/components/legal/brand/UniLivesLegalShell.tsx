import React from 'react';

type Props = {
  className?: string;
  children: React.ReactNode;
};

/** Visual shell only — preserve children structure and handlers. */
export function UniLivesLegalShell({ className = '', children }: Props) {
  return (
    <div className={className} data-unilives-legal-shell="">
      {children}
    </div>
  );
}
