import React from 'react';

type Props = {
  children: React.ReactNode;
  className?: string;
};

/** Visual card surface for profile setup form blocks. No logic. */
export function UniLivesProfileSetupCard({
  children,
  className = 'w-full flex flex-col gap-5',
}: Props) {
  return (
    <div className={className} data-unilives-profile-setup-card="">
      {children}
    </div>
  );
}
