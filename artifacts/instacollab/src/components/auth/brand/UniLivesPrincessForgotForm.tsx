import React from 'react';

type Props = {
  email: string;
  busy?: boolean;
  onEmailChange: (value: string) => void;
  onSubmit: () => void;
  onBackToSignIn: () => void;
};

/**
 * Interactive controls locked to the approved forgot-password artwork.
 * Visual chrome stays in the art — these only handle typing, submit, and back.
 */
export function UniLivesPrincessForgotForm({
  email,
  busy = false,
  onEmailChange,
  onSubmit,
  onBackToSignIn,
}: Props) {
  const filled = email.trim().length > 0;

  return (
    <form
      className="upf-actions"
      data-unilives-princess-forgot-form=""
      onSubmit={(e) => {
        e.preventDefault();
        if (busy) return;
        onSubmit();
      }}
    >
      <div className="upf-email-wrap" data-filled={filled ? 'true' : 'false'}>
        <label className="upf-sr" htmlFor="upf-email-input">
          Email address
        </label>
        <input
          id="upf-email-input"
          className="upf-email"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          enterKeyHint="send"
          value={email}
          disabled={busy}
          placeholder=" "
          required
          aria-label="Email address"
          onChange={(e) => onEmailChange(e.target.value)}
        />
      </div>

      <button
        type="submit"
        className="upf-hit upf-hit-submit"
        disabled={busy}
        aria-label="Send Reset Link"
      />

      <button
        type="button"
        className="upf-hit upf-hit-back"
        disabled={busy}
        aria-label="Back to Sign In"
        onClick={onBackToSignIn}
      />
    </form>
  );
}
