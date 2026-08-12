import React from 'react';
import { UniLivesShareCard } from './UniLivesShareCard';

type Props = {
  className?: string;
  children: React.ReactNode;
};

export function UniLivesProfileShareCard({ className = '', children }: Props) {
  return (
    <UniLivesShareCard className={className} kind="profile">
      {children}
    </UniLivesShareCard>
  );
}

export function UniLivesRoomShareCard({ className = '', children }: Props) {
  return (
    <UniLivesShareCard className={className} kind="party">
      {children}
    </UniLivesShareCard>
  );
}

export function UniLivesPostShareCard({ className = '', children }: Props) {
  return (
    <UniLivesShareCard className={className} kind="post">
      {children}
    </UniLivesShareCard>
  );
}

export function UniLivesInviteShareCard({ className = '', children }: Props) {
  return (
    <UniLivesShareCard className={className} kind="invite">
      {children}
    </UniLivesShareCard>
  );
}
