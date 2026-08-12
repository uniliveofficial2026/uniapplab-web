import React from 'react';

type Props = {
  agreed: boolean;
  busy?: boolean;
  onToggleAgree: () => void;
  /** Called when Google/Email is tapped without accepting Terms. */
  onNeedAgree?: () => void;
  onGoogle: () => void;
  onEmailSignup: () => void;
  onForgotPassword: () => void;
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
};

/**
 * Interactive hit targets locked to the approved princess artwork controls.
 * Visual chrome stays in the art — these only handle taps/clicks + a11y.
 * Geometry measured from princess-auth-locked.jpg (576×1024) gold button frames.
 * Google / Email require the Terms checkbox before proceeding.
 */
export function UniLivesPrincessAuthActions({
  agreed,
  busy = false,
  onToggleAgree,
  onNeedAgree,
  onGoogle,
  onEmailSignup,
  onForgotPassword,
  onOpenTerms,
  onOpenPrivacy,
}: Props) {
  const [nudge, setNudge] = React.useState(false);

  const requireAgree = (action: () => void) => {
    if (!agreed) {
      setNudge(true);
      window.setTimeout(() => setNudge(false), 1400);
      onNeedAgree?.();
      return;
    }
    action();
  };

  return (
    <div
      className="upa-actions"
      data-unilives-princess-actions=""
      data-agreed={agreed ? 'true' : 'false'}
      data-nudge-agree={nudge ? 'true' : 'false'}
    >
      {/* Google + Email: blocked until Terms checkbox is checked */}
      <div className="upa-buttons-row" data-unilives-princess-buttons="">
        <button
          type="button"
          className="upa-hit upa-hit-google"
          disabled={busy}
          aria-disabled={!agreed || busy}
          aria-label="Continue with Google"
          onClick={() => requireAgree(onGoogle)}
        />
        <button
          type="button"
          className="upa-hit upa-hit-email"
          disabled={busy}
          aria-disabled={!agreed || busy}
          aria-label="Sign Up with Email"
          onClick={() => requireAgree(onEmailSignup)}
        />
      </div>

      <button
        type="button"
        className="upa-hit upa-hit-forgot"
        disabled={busy}
        aria-label="Forgot Password?"
        onClick={onForgotPassword}
      />

      {/* Checkbox hit locks exactly to the painted empty square; checkmark is clipped inside it. */}
      <button
        type="button"
        className="upa-hit upa-hit-checkbox"
        data-unilives-legal-agree=""
        aria-pressed={agreed}
        aria-required="true"
        aria-label={agreed ? 'Agreed to Terms and Privacy Policy' : 'Agree to Terms and Privacy Policy'}
        onClick={onToggleAgree}
      >
        <span className="upa-check" data-checked={agreed ? 'true' : 'false'} aria-hidden>
          <svg viewBox="0 0 16 16" width="100%" height="100%" focusable="false">
            <path
              d="M3.2 8.4 6.4 11.4 12.8 4.6"
              fill="none"
              stroke="#fff"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      <button
        type="button"
        className="upa-hit upa-hit-agree-label"
        aria-label="Agree to Terms and Privacy Policy"
        aria-pressed={agreed}
        onClick={onToggleAgree}
      />

      <button
        type="button"
        className="upa-hit upa-hit-terms-link"
        aria-label="Open Terms"
        onClick={onOpenTerms}
      />

      <button
        type="button"
        className="upa-hit upa-hit-privacy-link"
        aria-label="Open Privacy Policy"
        onClick={onOpenPrivacy}
      />
    </div>
  );
}
