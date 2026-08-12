import React from 'react';
import {
  LEGAL_AGE_DISCLAIMER,
  LEGAL_AGREEMENT_CHECKBOX_LABEL,
  LEGAL_AGE_REQUIREMENT_YEARS,
  openPrivacyPolicy,
  openTermsOfService,
} from '../../lib/legalDocs';
import { UniLivesLegalConsentCard } from './brand/UniLivesLegalConsentCard';
import { UniLivesLegalNavigation } from './brand/UniLivesLegalNavigation';

type LegalAgreementCheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
  className?: string;
};

/** Required 18+ + Terms/Privacy acceptance control for profile setup. */
export function LegalAgreementCheckbox({
  checked,
  onChange,
  id = 'legal-agreement',
  className = '',
}: LegalAgreementCheckboxProps) {
  return (
    <UniLivesLegalConsentCard className={className}>
      <p className="text-[11px] leading-relaxed text-[color:var(--color-unilives-text-muted)]">{LEGAL_AGE_DISCLAIMER}</p>
      <UniLivesLegalNavigation
        items={[
          { label: 'Privacy Policy', onClick: openPrivacyPolicy, kind: 'privacy' },
          { label: 'Terms of Service & User Agreement', onClick: openTermsOfService, kind: 'terms' },
        ]}
      />
      <label htmlFor={id} className="flex items-start gap-3 cursor-pointer select-none">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 rounded border-[color:var(--color-unilives-border)] accent-[color:var(--color-unilives-primary)]"
        />
        <span className="text-xs leading-relaxed text-[color:var(--color-unilives-text)] font-medium">
          {LEGAL_AGREEMENT_CHECKBOX_LABEL}
        </span>
      </label>
      <p className="text-[10px] text-[color:var(--color-unilives-text-muted)]">
        Required · {LEGAL_AGE_REQUIREMENT_YEARS}+ only · protects the developer, service, and app from
        underage-use liability
      </p>
    </UniLivesLegalConsentCard>
  );
}
