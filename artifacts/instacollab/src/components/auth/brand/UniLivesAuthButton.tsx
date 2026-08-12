import React from 'react';
import { LaunchPrimaryButton, LaunchTextButton } from '../../launch/launchUi';

type PrimaryProps = {
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
};

/** Primary CTA visual tone for auth — handlers stay on the parent. */
export function UniLivesAuthButton(props: PrimaryProps) {
  return <LaunchPrimaryButton tone="onboarding" {...props} />;
}

type TextProps = {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
};

export function UniLivesAuthTextButton(props: TextProps) {
  return <LaunchTextButton tone="onboarding" {...props} />;
}
