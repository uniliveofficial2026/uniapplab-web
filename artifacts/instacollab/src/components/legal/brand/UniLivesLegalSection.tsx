import React from 'react';

type Props = {
  className?: string;
  children: React.ReactNode;
  id?: string;
};

export function UniLivesLegalSection({ className = '', children, id }: Props) {
  return (
    <section id={id} className={className} data-unilives-legal-section="">
      {children}
    </section>
  );
}
