import React from 'react';
import {
  PRINCESS_ONBOARDING_WELCOME_ART_SIZE,
  PRINCESS_ONBOARDING_WELCOME_BG_EXTEND_SRC,
  PRINCESS_ONBOARDING_WELCOME_LOCKED_SRC,
} from './princessOnboardingWelcomeAssets';
import './princessOnboardingWelcome.css';

type Props = {
  children?: React.ReactNode;
  className?: string;
};

/**
 * Locked princess onboarding welcome stage (slide 1).
 * Mobile fills with approved art. Larger screens scale/center art and extend the same background.
 */
export function UniLivesPrincessOnboardingWelcomeLayout({
  children,
  className = '',
}: Props) {
  return (
    <div
      className={`upw-root ${className}`.trim()}
      data-unilives-princess-onboarding-welcome=""
      data-art-w={PRINCESS_ONBOARDING_WELCOME_ART_SIZE.w}
      data-art-h={PRINCESS_ONBOARDING_WELCOME_ART_SIZE.h}
    >
      <div className="upw-extend" aria-hidden>
        <img src={PRINCESS_ONBOARDING_WELCOME_BG_EXTEND_SRC} alt="" />
        <img
          src={PRINCESS_ONBOARDING_WELCOME_LOCKED_SRC}
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

      <div className="upw-frame" data-unilives-princess-onboarding-welcome-frame="">
        <img
          className="upw-art"
          src={PRINCESS_ONBOARDING_WELCOME_LOCKED_SRC}
          alt="UniLive’s — Go Live"
          width={PRINCESS_ONBOARDING_WELCOME_ART_SIZE.w}
          height={PRINCESS_ONBOARDING_WELCOME_ART_SIZE.h}
          decoding="async"
          fetchPriority="high"
        />
        {children}
      </div>
    </div>
  );
}
