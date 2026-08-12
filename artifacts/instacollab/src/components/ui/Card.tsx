import React from 'react';
import { unilivesCardClass } from './classes';

type Props = React.HTMLAttributes<HTMLDivElement>;

/** Surface card chrome — no data logic. */
export function UniLivesCard({ className = '', children, ...rest }: Props) {
  return (
    <div className={`${unilivesCardClass} ${className}`} data-unilives-card="" {...rest}>
      {children}
    </div>
  );
}

export { unilivesCardClass };
