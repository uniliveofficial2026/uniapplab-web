import React from 'react';
import {
  PRINCESS_FORGOT_ART_SIZE,
  PRINCESS_FORGOT_BG_EXTEND_SRC,
  PRINCESS_FORGOT_LOCKED_SRC,
} from './princessForgotAssets';
import './princessForgot.css';

type Props = {
  children?: React.ReactNode;
  className?: string;
  'data-unilives-auth-mode'?: string;
};

/**
 * Locked princess forgot-password stage.
 * Mobile fills with approved art. Larger screens scale/center art and extend the same background.
 */
export function UniLivesPrincessForgotLayout({
  children,
  className = '',
  'data-unilives-auth-mode': authMode,
}: Props) {
  return (
    <div
      className={`upf-root ${className}`.trim()}
      data-unilives-princess-forgot=""
      data-unilives-auth-mode={authMode}
      data-art-w={PRINCESS_FORGOT_ART_SIZE.w}
      data-art-h={PRINCESS_FORGOT_ART_SIZE.h}
    >
      <div className="upf-extend" aria-hidden>
        <img src={PRINCESS_FORGOT_BG_EXTEND_SRC} alt="" />
        <img
          src={PRINCESS_FORGOT_LOCKED_SRC}
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

      <div className="upf-frame" data-unilives-princess-forgot-frame="">
        <img
          className="upf-art"
          src={PRINCESS_FORGOT_LOCKED_SRC}
          alt="UniLive’s — Forgot Password"
          width={PRINCESS_FORGOT_ART_SIZE.w}
          height={PRINCESS_FORGOT_ART_SIZE.h}
          decoding="async"
          fetchPriority="high"
        />
        {children}
      </div>
    </div>
  );
}
