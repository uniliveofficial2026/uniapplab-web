/**
 * Public legal documents for UniLive / UniappLab.
 * HTML pages are the canonical public URLs; this module holds in-app copy + acceptance helpers.
 */
import { APP_DISPLAY_NAME, WORKSPACE_DISPLAY_NAME } from './appBrand';

/** Bump when material terms change so users can be re-prompted later if needed. */
export const LEGAL_AGREEMENT_VERSION = '2026-07-09';

export const PRIVACY_POLICY_PATH = '/privacy-policy.html';
export const TERMS_OF_SERVICE_PATH = '/terms-of-service.html';

export const PRIVACY_POLICY_TITLE = 'Privacy Policy';
export const TERMS_OF_SERVICE_TITLE = 'Terms of Service & User Agreement';

export const LEGAL_AGE_REQUIREMENT_YEARS = 18;

export const LEGAL_AGE_DISCLAIMER =
  `You must be at least ${LEGAL_AGE_REQUIREMENT_YEARS} years old to create an account or use ${APP_DISPLAY_NAME}. ` +
  `If you are under ${LEGAL_AGE_REQUIREMENT_YEARS}, you are not permitted to use this service. ` +
  `The developer, ${WORKSPACE_DISPLAY_NAME}, ${APP_DISPLAY_NAME}, and related operators accept no responsibility ` +
  `or liability for any use of the app, website, or services by anyone under ${LEGAL_AGE_REQUIREMENT_YEARS}.`;

export const LEGAL_AGREEMENT_CHECKBOX_LABEL =
  `I confirm I am ${LEGAL_AGE_REQUIREMENT_YEARS} years of age or older, and I agree to the Privacy Policy and the Terms of Service & User Agreement. ` +
  `I understand that underage use is prohibited and that the developer, service, and app are not responsible for underage users.`;

export function privacyPolicyUrl(origin?: string): string {
  const base = (origin ?? (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
  return `${base}${PRIVACY_POLICY_PATH}`;
}

export function termsOfServiceUrl(origin?: string): string {
  const base = (origin ?? (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
  return `${base}${TERMS_OF_SERVICE_PATH}`;
}

export function openPrivacyPolicy(): void {
  window.open(privacyPolicyUrl(), '_blank', 'noopener,noreferrer');
}

export function openTermsOfService(): void {
  window.open(termsOfServiceUrl(), '_blank', 'noopener,noreferrer');
}

export type LegalAcceptanceRecord = {
  accepted: boolean;
  acceptedAt: number | null;
  version: string | null;
};

export function readLegalAcceptanceFromStorage(userId: string): LegalAcceptanceRecord {
  if (!userId || typeof localStorage === 'undefined') {
    return { accepted: false, acceptedAt: null, version: null };
  }
  try {
    const raw = localStorage.getItem(`legal_agreement:${userId}`);
    if (!raw) return { accepted: false, acceptedAt: null, version: null };
    const parsed = JSON.parse(raw) as { acceptedAt?: number; version?: string };
    const acceptedAt = typeof parsed.acceptedAt === 'number' ? parsed.acceptedAt : null;
    const version = typeof parsed.version === 'string' ? parsed.version : null;
    return {
      accepted: Boolean(acceptedAt && version),
      acceptedAt,
      version,
    };
  } catch {
    return { accepted: false, acceptedAt: null, version: null };
  }
}

export function writeLegalAcceptanceToStorage(userId: string, at = Date.now()): LegalAcceptanceRecord {
  const record: LegalAcceptanceRecord = {
    accepted: true,
    acceptedAt: at,
    version: LEGAL_AGREEMENT_VERSION,
  };
  if (userId && typeof localStorage !== 'undefined') {
    localStorage.setItem(
      `legal_agreement:${userId}`,
      JSON.stringify({ acceptedAt: at, version: LEGAL_AGREEMENT_VERSION }),
    );
  }
  return record;
}
