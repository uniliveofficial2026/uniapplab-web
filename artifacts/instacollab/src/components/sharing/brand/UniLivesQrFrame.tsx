import React from 'react';

type Props = {
  /** Authoritative QR graphic already encoded by the parent — never regenerated here. */
  children: React.ReactNode;
  className?: string;
  /** Preserve quiet zone — default padding must not crop modules. */
  quietZoneClassName?: string;
  label?: string;
};

/**
 * Decorative frame around an existing QR graphic.
 * Does not encode payloads. No logo overlay (product has no QR logo renderer).
 */
export function UniLivesQrFrame({
  children,
  className = 'inline-flex',
  quietZoneClassName = 'p-3 bg-white rounded-xl',
  label,
}: Props) {
  return (
    <figure
      className={`${className}`.trim()}
      data-unilives-qr-frame=""
      aria-label={label || 'QR code'}
    >
      <div className={`${quietZoneClassName} pointer-events-none`.trim()}>{children}</div>
      {label ? <figcaption className="sr-only">{label}</figcaption> : null}
    </figure>
  );
}
