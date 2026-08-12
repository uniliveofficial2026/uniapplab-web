import React from 'react';
import { GoogleAuthButton } from '../../launch/GoogleAuthButton';
import { AppleAuthButton } from '../../launch/AppleAuthButton';

type GoogleProps = {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
};

/**
 * Social auth button wrappers — preserve official provider marks and handlers.
 * Do not recolor Google/Apple marks.
 */
export function UniLivesSocialAuthButton(props: GoogleProps) {
  return <GoogleAuthButton {...props} />;
}

export function UniLivesAppleAuthButton(props: GoogleProps) {
  return <AppleAuthButton {...props} />;
}
