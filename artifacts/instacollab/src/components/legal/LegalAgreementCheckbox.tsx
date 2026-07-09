import React from 'react';
import {
  LEGAL_AGE_DISCLAIMER,
  LEGAL_AGREEMENT_CHECKBOX_LABEL,
  LEGAL_AGE_REQUIREMENT_YEARS,
  openPrivacyPolicy,
  openTermsOfService,
} from '../../lib/legalDocs';

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
    <div
      className={`rounded-2xl border border-border bg-secondary/20 p-4 space-y-3 text-left ${className}`}
    >
      <p className="text-[11px] leading-relaxed text-muted-foreground">{LEGAL_AGE_DISCLAIMER}</p>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold">
        <button
          type="button"
          onClick={openPrivacyPolicy}
          className="text-primary hover:underline underline-offset-2"
        >
          Privacy Policy
        </button>
        <button
          type="button"
          onClick={openTermsOfService}
          className="text-primary hover:underline underline-offset-2"
        >
          Terms of Service &amp; User Agreement
        </button>
      </div>
      <label htmlFor={id} className="flex items-start gap-3 cursor-pointer select-none">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 rounded border-border accent-primary"
        />
        <span className="text-xs leading-relaxed text-foreground font-medium">
          {LEGAL_AGREEMENT_CHECKBOX_LABEL}
        </span>
      </label>
      <p className="text-[10px] text-muted-foreground">
        Required · {LEGAL_AGE_REQUIREMENT_YEARS}+ only · protects the developer, service, and app from
        underage-use liability
      </p>
    </div>
  );
}
