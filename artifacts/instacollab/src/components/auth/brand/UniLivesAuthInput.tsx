import React from 'react';
import { LaunchField } from '../../launch/launchUi';
import { unilivesAuthInputClass } from './authResolve';

type Props = {
  label: string;
  children: React.ReactNode;
};

/** Label wrapper — preserves LaunchField structure. */
export function UniLivesAuthInput({ label, children }: Props) {
  return <LaunchField label={label}>{children}</LaunchField>;
}

export { unilivesAuthInputClass };
