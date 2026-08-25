import React from 'react';
import { keyboardComposerClassName } from './keyboardLayout';

type KeyboardAwareComposerProps = React.ComponentPropsWithoutRef<'div'>;

/** Bottom-anchored composer shell wired to --app-composer-bottom-inset. */
export function KeyboardAwareComposer({
  className = '',
  ...props
}: KeyboardAwareComposerProps) {
  return (
    <div
      className={`${keyboardComposerClassName} ${className}`.trim()}
      {...props}
    />
  );
}
