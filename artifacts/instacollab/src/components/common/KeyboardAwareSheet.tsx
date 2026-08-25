import React from 'react';
import { keyboardAwareSheetClassName, keyboardComposerClassName } from './keyboardLayout';

type KeyboardAwareSheetProps = React.HTMLAttributes<HTMLDivElement> & {
  tall?: boolean;
};

/** Bottom sheet container capped by visual viewport height. */
export function KeyboardAwareSheet({
  className = '',
  tall = false,
  children,
  ...props
}: KeyboardAwareSheetProps) {
  const sheetClass = tall
    ? 'max-h-[min(85dvh,calc(var(--app-vv-height,100dvh)*0.92))]'
    : keyboardAwareSheetClassName;
  return (
    <div
      className={`fixed inset-x-0 bottom-0 flex flex-col ${sheetClass} ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
}

export function KeyboardAwareSheetFooter({
  className = '',
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`${keyboardComposerClassName} ${className}`.trim()} {...props} />;
}
