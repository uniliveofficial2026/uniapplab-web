import React from 'react';
import {
  PRINCESS_ONBOARDING_CONNECT_ART_SIZE,
  PRINCESS_ONBOARDING_CONNECT_BG_EXTEND_SRC,
  PRINCESS_ONBOARDING_CONNECT_LOCKED_SRC,
} from './princessOnboardingConnectAssets';
import './princessOnboardingConnect.css';

type Props = {
  children?: React.ReactNode;
  className?: string;
};

/**
 * Locked princess onboarding Connect Together stage (slide 2).
 * Mobile fills with approved art. Larger screens scale/center art and extend the same background.
 */
export function UniLivesPrincessOnboardingConnectLayout({
  children,
  className = '',
}: Props) {
  return (
    <div
      className={`upc-root ${className}`.trim()}
      data-unilives-princess-onboarding-connect=""
      data-art-w={PRINCESS_ONBOARDING_CONNECT_ART_SIZE.w}
      data-art-h={PRINCESS_ONBOARDING_CONNECT_ART_SIZE.h}
    >
      <div className="upc-extend" aria-hidden>
        <img src={PRINCESS_ONBOARDING_CONNECT_BG_EXTEND_SRC} alt="" />
        <img
          src={PRINCESS_ONBOARDING_CONNECT_LOCKED_SRC}
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

      <div className="upc-frame" data-unilives-princess-onboarding-connect-frame="">
        <img
          className="upc-art"
          src={PRINCESS_ONBOARDING_CONNECT_LOCKED_SRC}
          alt="UniLive’s — Connect Together"
          width={PRINCESS_ONBOARDING_CONNECT_ART_SIZE.w}
          height={PRINCESS_ONBOARDING_CONNECT_ART_SIZE.h}
          decoding="async"
          fetchPriority="high"
        />
        {children}
      </div>
    </div>
  );
}
