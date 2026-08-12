import React from 'react';
import { unilivesInputClass } from './classes';

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;
type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

/** Visual input — preserves all native input attributes via spread. */
export function UniLivesInput({ className = '', ...rest }: InputProps) {
  return <input className={`${unilivesInputClass} ${className}`} {...rest} />;
}

/** Visual textarea — preserves native textarea attributes. */
export function UniLivesTextarea({ className = '', ...rest }: TextareaProps) {
  return (
    <textarea
      className={`${unilivesInputClass} min-h-[88px] resize-none ${className}`}
      {...rest}
    />
  );
}

export { unilivesInputClass };
