import React, { useState } from 'react';
import { useDB } from '../../lib/useDB';
import { 
  DollarSign, 
  ArrowUpRight, 
  CheckCircle2, 
  CreditCard, 
  Building, 
  Globe, 
  ArrowRight,
  ShieldCheck,
  Building2,
  Lock
} from 'lucide-react';

export function WithdrawTab() {
  const db = useDB();
  const cashBalance = db.load('cash_balance', 180.50);

  // Form Fields
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [bankName, setBankName] = useState<string>('Chase Bank');
  const [routingNumber, setRoutingNumber] = useState<string>('021000021');
  const [accountNumber, setAccountNumber] = useState<string>('*********4320');
  const [payoutMethod, setPayoutMethod] = useState<'ACH' | 'PayPal'>('ACH');
  const [paypalEmail, setPaypalEmail] = useState<string>('');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const withdrawAmountVal = parseFloat(withdrawAmount) || 0;
  
  // Withdraw rules: $1.50 processing fee flat
  const withdrawFee = withdrawAmountVal > 0 ? 1.50 : 0;
  const netReceiptAmount = Math.max(0, withdrawAmountVal - withdrawFee);

  const handleWithdrawInitiated = (e: React.FormEvent) => {
    e.preventDefault();
    if (withdrawAmountVal <= 0) return;
    if (withdrawAmountVal > cashBalance) {
      alert('Withdrawal value exceeds current Cash balance.');
      return;
    }
    if (withdrawAmountVal < 10) {
      alert('The minimum withdrawal limit is $10.00 USD.');
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      // Deduct cash
      const currentCash = db.load('cash_balance', 180.50);
      const nextCash = currentCash - withdrawAmountVal;
      db.save('cash_balance', nextCash);

      // Save transaction
      const currentTrans = db.load('wallet_transactions', []);
      const description = payoutMethod === 'ACH' 
        ? `ACH transfer to ${bankName}` 
        : `PayPal transfer to ${paypalEmail || 'PayPal Account'}`;
      
      const newTransaction = {
        id: `t_${Date.now()}`,
        type: 'Payout Transferred',
        amount: `-$${withdrawAmountVal.toFixed(2)} USD`,
        status: 'Completed',
        date: new Date().toISOString().replace('T', ' ').substring(0, 16),
        cost: description
      };
      db.save('wallet_transactions', [newTransaction, ...currentTrans]);

      setIsLoading(false);
      setSuccessMsg(`Successfully processed wire transfer of $${netReceiptAmount.toFixed(2)} USD (after $1.50 regulatory handling fee)!`);
      setWithdrawAmount('');
    }, 1500); // Realistic processing feel
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-left animate-in fade-in duration-300">
      
      {/* 1. Withdrawal Form Workspace */}
      <div className="space-y-6">
        <div>
          <h3 className="text-xl font-black text-foreground">Cash Withdrawal Center</h3>
          <p className="text-xs text-muted-foreground font-semibold mt-1">Siphon clear fiat earnings safely to verified commercial bank routing accounts or verified online PayPal addresses.</p>
        </div>

        <form onSubmit={handleWithdrawInitiated} className="bg-card border border-border rounded-[32px] p-6 space-y-5 shadow-sm">
          {/* Output Mode Selector */}
          <div className="flex gap-2.5 bg-secondary/40 p-1 rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setPayoutMethod('ACH')}
              className={`flex-1 py-1.5 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                payoutMethod === 'ACH'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-secondary/60'
              }`}
            >
              <Building className="w-3.5 h-3.5" /> Commercial Bank (ACH)
            </button>
            <button
              type="button"
              onClick={() => setPayoutMethod('PayPal')}
              className={`flex-1 py-1.5 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                payoutMethod === 'PayPal'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-secondary/60'
              }`}
            >
              <Globe className="w-3.5 h-3.5" /> PayPal payout
            </button>
          </div>

          {/* Amount input card */}
          <div className="bg-secondary/20 p-4 border border-border rounded-xl">
            <label className="text-[10px] uppercase font-black text-muted-foreground block mb-1">
              Amount to Cash Out
            </label>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center">
                <span className="text-2xl font-black text-foreground mr-1">$</span>
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={e => setWithdrawAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  className="bg-transparent border-0 text-2xl font-black text-foreground focus:ring-0 focus:outline-none p-0 w-44"
                />
              </div>
              <button 
                type="button" 
                onClick={() => setWithdrawAmount(cashBalance.toFixed(2))}
                className="px-2.5 py-1 bg-secondary hover:bg-secondary/80 border border-border rounded-lg text-[10px] font-black text-primary transition-all shrink-0"
              >
                Cash Out Max
              </button>
            </div>
          </div>

          {/* Dynamic specific forms */}
          {payoutMethod === 'ACH' ? (
            <div className="space-y-3.5">
              <div>
                <label className="text-[10px] uppercase font-black text-muted-foreground mb-1 block">Full Commercial Bank Name</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={e => setBankName(e.target.value)}
                  className="w-full bg-secondary/35 border border-border rounded-xl p-2.5 text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary/45"
                  placeholder="Chase, Bank of America, etc."
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-black text-muted-foreground mb-1 block">Routing Key (9 Digits)</label>
                  <input
                    type="text"
                    value={routingNumber}
                    onChange={e => setRoutingNumber(e.target.value)}
                    className="w-full bg-secondary/35 border border-border rounded-xl p-2.5 text-xs font-black text-foreground focus:outline-none focus:ring-1 focus:ring-primary/45 font-mono"
                    maxLength={9}
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-black text-muted-foreground mb-1 block">Account Number</label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={e => setAccountNumber(e.target.value)}
                    className="w-full bg-secondary/35 border border-border rounded-xl p-2.5 text-xs font-black text-foreground focus:outline-none focus:ring-1 focus:ring-primary/45 font-mono"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label className="text-[10px] uppercase font-black text-muted-foreground mb-1 block">PayPal Receiving Email Address</label>
              <input
                type="email"
                value={paypalEmail}
                onChange={e => setPaypalEmail(e.target.value)}
                className="w-full bg-secondary/35 border border-border rounded-xl p-2.5 text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary/45"
                placeholder="e.g. payout@streamwallet.com"
                required={payoutMethod === 'PayPal'}
              />
            </div>
          )}

          {/* Pricing breakdowns */}
          <div className="border-t border-border pt-4 space-y-2 text-[10px] font-bold text-muted-foreground">
            <div className="flex justify-between">
              <span>Gross Withdrawal Amount</span>
              <span className="text-foreground font-black">${withdrawAmountVal.toFixed(2)} USD</span>
            </div>
            <div className="flex justify-between text-red-500">
              <span>Flat Transaction Processing Fee</span>
              <span>-${withdrawFee.toFixed(2)} USD</span>
            </div>
            <div className="flex justify-between text-emerald-500 border-t border-dashed border-border/80 pt-2 text-xs">
              <span>Net Wire Payment Delivery</span>
              <span className="font-black">${netReceiptAmount.toFixed(2)} USD</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || withdrawAmountVal <= 0}
            className="w-full py-4 bg-primary text-primary-foreground font-black rounded-2xl hover:opacity-95 active:scale-[0.99] transition-all text-sm shadow-md shadow-primary/20 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Building2 className="w-4 h-4 animate-bounce" /> Authenticating Bank Credentials...
              </>
            ) : (
              'Initiate Instant Security Cash Out'
            )}
          </button>

          {successMsg && (
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs font-bold text-emerald-500 text-center animate-in face-in duration-300">
              {successMsg}
            </div>
          )}
        </form>
      </div>

      {/* 2. Side Panel details Security & Verification */}
      <div className="space-y-6">
        <div>
          <h3 className="text-xl font-black text-foreground">Compliance & Security Policy</h3>
          <p className="text-xs text-muted-foreground font-semibold mt-1">Our system operates high level financial ledgers. Review security policies for instant payout verification.</p>
        </div>

        <div className="bg-card border border-border rounded-[32px] p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl mt-0.5 shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-black text-foreground">Instant ACH Clearing</h4>
              <p className="text-[11px] text-muted-foreground font-semibold mt-0.5">Most ACH drafts post instantly but your banking entity may take up to 24 billing hours depending on wire verification cycles.</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl mt-0.5 shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-black text-foreground">Fencible Security Measures</h4>
              <p className="text-[11px] text-muted-foreground font-semibold mt-0.5">We use automated fraud flags. Accounts transacting more than $10,000 USD gross monthly are subject to standard automated KYC identity updates.</p>
            </div>
          </div>

          <div className="p-4 bg-secondary/35 border border-border/80 rounded-2xl text-center flex flex-col items-center justify-center">
            <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl mb-2">
              <Building2 className="w-5 h-5" />
            </div>
            <p className="text-[11px] font-black text-foreground">Regulatory Wire Guarantee</p>
            <p className="text-[10px] text-muted-foreground font-semibold mt-1 max-w-xs leading-relaxed">
              We are registered with the Federal Financial Network. All client funds reside in separate FDIC-insured FDIC broker banks in strict non-commingling pools.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
