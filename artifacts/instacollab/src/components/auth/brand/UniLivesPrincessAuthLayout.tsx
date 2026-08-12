import React from 'react';
import {
  PRINCESS_AUTH_ART_SIZE,
  PRINCESS_AUTH_BG_EXTEND_SRC,
  PRINCESS_AUTH_LOCKED_SRC,
} from './princessAuthAssets';
import './princessAuth.css';

type Props = {
  children?: React.ReactNode;
  /** When true, show the lower email/form panel region. */
  showPanel?: boolean;
  panel?: React.ReactNode;
  className?: string;
  'data-unilives-auth-mode'?: string;
};

/**
 * Locked princess auth stage.
 * Mobile fills with approved art. Larger screens scale/center art and extend the same background.
 */
export function UniLivesPrincessAuthLayout({
  children,
  showPanel = false,
  panel,
  className = '',
  'data-unilives-auth-mode': authMode,
}: Props) {
  return (
    <div
      className={`upa-root ${className}`.trim()}
      data-unilives-princess-auth=""
      data-unilives-auth-mode={authMode}
      data-art-w={PRINCESS_AUTH_ART_SIZE.w}
      data-art-h={PRINCESS_AUTH_ART_SIZE.h}
    >
      <div className="upa-extend" aria-hidden>
        <img src={PRINCESS_AUTH_BG_EXTEND_SRC} alt="" />
        <img
          src={PRINCESS_AUTH_LOCKED_SRC}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
            opacity: 0.55,
            filter: 'blur(28px) saturate(1.15)',
            transform: 'scale(1.12)',
          }}
        />
      </div>

      <div className="upa-frame" data-unilives-princess-frame="">
        <img
          className="upa-art"
          src={PRINCESS_AUTH_LOCKED_SRC}
          alt="UniLive’s — Welcome"
          width={PRINCESS_AUTH_ART_SIZE.w}
          height={PRINCESS_AUTH_ART_SIZE.h}
          decoding="async"
          fetchPriority="high"
        />
        {children}
        {showPanel && panel ? <div className="upa-panel">{panel}</div> : null}
      </div>
    </div>
  );
}
