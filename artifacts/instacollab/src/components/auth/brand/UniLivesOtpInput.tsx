/**
 * OTP field visual helper — does not own OTP state.
 * Parent still renders the real input with autocomplete="one-time-code".
 */
export function unilivesOtpInputClass(baseClass: string): string {
  return `${baseClass} text-center text-lg tracking-[0.35em] font-black`;
}
