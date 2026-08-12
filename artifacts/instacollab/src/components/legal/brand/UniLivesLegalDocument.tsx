import React from 'react';

type Props = {
  className?: string;
  children: React.ReactNode;
};

/** Pass-through document chrome — does not rewrite legal text. */
export function UniLivesLegalDocument({ className = '', children }: Props) {
  return (
    <article className={className} data-unilives-legal-document="">
      {children}
    </article>
  );
}
