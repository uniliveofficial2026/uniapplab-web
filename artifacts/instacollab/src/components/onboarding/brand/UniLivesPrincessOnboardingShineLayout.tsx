import React from 'react';
import {
  PRINCESS_ONBOARDING_SHINE_ART_SIZE,
  PRINCESS_ONBOARDING_SHINE_BG_EXTEND_SRC,
  PRINCESS_ONBOARDING_SHINE_LOCKED_SRC,
} from './princessOnboardingShineAssets';
import './princessOnboardingShine.css';

type Props = {
  children?: React.ReactNode;
  className?: string;
};

/**
 * Locked princess onboarding Shine Your Way stage (slide 3 / final).
 * Mobile fills with approved art. Larger screens scale/center art and extend the same background.
 */
export function UniLivesPrincessOnboardingShineLayout({
  children,
  className = '',
}: Props) {
  return (
    <div
      className={`ups-root ${className}`.trim()}
      data-unilives-princess-onboarding-shine=""
      data-art-w={PRINCESS_ONBOARDING_SHINE_ART_SIZE.w}
      data-art-h={PRINCESS_ONBOARDING_SHINE_ART_SIZE.h}
    >
      <div className="ups-extend" aria-hidden>
        <img src={PRINCESS_ONBOARDING_SHINE_BG_EXTEND_SRC} alt="" />
        <img
          src={PRINCESS_ONBOARDING_SHINE_LOCKED_SRC}
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

      <div className="ups-frame" data-unilives-princess-onboarding-shine-frame="">
        <img
          className="ups-art"
          src={PRINCESS_ONBOARDING_SHINE_LOCKED_SRC}
          alt="UniLive’s — Shine Your Way"
          width={PRINCESS_ONBOARDING_SHINE_ART_SIZE.w}
          height={PRINCESS_ONBOARDING_SHINE_ART_SIZE.h}
          decoding="async"
          fetchPriority="high"
        />
        {children}
      </div>
    </div>
  );
}
