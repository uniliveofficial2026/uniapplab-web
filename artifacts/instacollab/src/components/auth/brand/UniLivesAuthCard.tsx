import React from 'react';

type Props = {
  children: React.ReactNode;
  className?: string;
};

/** Visual card surface for auth form blocks. No logic. */
export function UniLivesAuthCard({
  children,
  className = 'w-full flex flex-col gap-5',
}: Props) {
  return (
    <div
      className={className}
      data-unilives-auth-card=""
    >
      {children}
    </div>
  );
}
