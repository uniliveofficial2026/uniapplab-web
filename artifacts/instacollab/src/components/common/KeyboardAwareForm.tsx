import React from 'react';
import { keyboardComposerClassName } from './keyboardLayout';

type KeyboardAwareFormProps = React.FormHTMLAttributes<HTMLFormElement>;

/** Scrollable form shell with composer-safe bottom inset when anchored. */
export function KeyboardAwareForm({ className = '', ...props }: KeyboardAwareFormProps) {
  return (
    <form
      className={`app-screen-scroll ${keyboardComposerClassName} ${className}`.trim()}
      {...props}
    />
  );
}
