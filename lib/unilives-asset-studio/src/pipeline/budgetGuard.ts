import { getSafetyConfig } from '../config/env.js';

export class BudgetGuard {
  private paidCallsUsed = 0;

  get used(): number {
    return this.paidCallsUsed;
  }

  /** Returns true if a paid call may proceed. Never auto-retries. */
  tryConsumePaidCall(): { allowed: boolean; reason?: string } {
    const safety = getSafetyConfig();
    if (safety.dryRun) {
      return { allowed: false, reason: 'ASSET_STUDIO_DRY_RUN=true — paid calls blocked' };
    }
    if (safety.autoRetry) {
      return { allowed: false, reason: 'ASSET_STUDIO_AUTO_RETRY must remain false' };
    }
    if (this.paidCallsUsed >= safety.maxPaidCalls) {
      return {
        allowed: false,
        reason: `Paid call budget exhausted (max=${safety.maxPaidCalls})`,
      };
    }
    this.paidCallsUsed += 1;
    return { allowed: true };
  }

  snapshot() {
    const safety = getSafetyConfig();
    return {
      dryRun: safety.dryRun,
      maxPaidCalls: safety.maxPaidCalls,
      autoRetry: safety.autoRetry,
      paidCallsUsed: this.paidCallsUsed,
    };
  }
}

export const sharedBudgetGuard = new BudgetGuard();
