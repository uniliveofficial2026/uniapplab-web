import React, { useState } from 'react';
import { useDB } from '../../lib/useDB';
import { useCurrentUser } from '../../lib/useCurrentUser';
import { addWalletCoins, saveWalletCoinsBalance, spendWalletCoins } from '../../lib/walletKstarSync';
import { 
  Coins, 
  DollarSign, 
  ArrowRightLeft, 
  Check, 
  CreditCard,
  X,
  Lock,
  Loader2,
  Sparkles
} from 'lucide-react';

export function BuyExchangeTab() {
  const db = useDB();
  const appUser = useCurrentUser();
  
  const coinsBalance = db.load('coins_balance', 4200);
  const cashBalance = db.load('cash_balance', 180.50);
  const transactions = db.load('wallet_transactions', []);

  // Exchange fields state
  const [exchangeType, setExchangeType] = useState<'cash_to_coins' | 'coins_to_cash'>('cash_to_coins');
  const [exchangeAmount, setExchangeAmount] = useState<string>('');
  const [exchangeSuccess, setExchangeSuccess] = useState<string | null>(null);

  // Coins bundle selectors
  const COINS_BUNDLES = [
    { coins: 500, price: 4.99, label: 'Starter Bundle', badge: 'Popular' },
    { coins: 1200, price: 9.99, label: 'Super pack', badge: 'Bonus +20%' },
    { coins: 3000, price: 24.99, label: 'Elite Vault', badge: 'Best Value' },
    { coins: 6500, price: 49.99, label: 'Whale Cache', badge: 'Super Saver' },
  ];

  // Secure payment checkout modal state
  const [selectedBundle, setSelectedBundle] = useState<typeof COINS_BUNDLES[0] | null>(null);
  const [paymentStep, setPaymentStep] = useState<'input' | 'processing' | 'success'>('input');
  
  // Simulated Card Fields
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [cardName, setCardName] = useState('');

  // Handle bundle selection click
  const handleSelectBundle = (bundle: typeof COINS_BUNDLES[0]) => {
    setSelectedBundle(bundle);
    setPaymentStep('input');
    // Pre-populate with typical mock values for convenience
    setCardNumber('4111 2222 3333 4444');
    setCardExpiry('12/28');
    setCardCvc('321');
    setCardName(db.currentUser?.displayName || 'Cardholder');
  };

  // Perform purchase delivery
  const processPurchasePayment = () => {
    if (!selectedBundle) return;
    setPaymentStep('processing');
    
    setTimeout(() => {
      // Deliver coins
      const currentCoins = db.load('coins_balance', 4200);
      addWalletCoins(appUser.id, selectedBundle.coins);

      // Record transaction
      const currentTrans = db.load('wallet_transactions', []);
      const newTransaction = {
        id: `t_${Date.now()}`,
        type: 'Coins Bought',
        amount: `+${selectedBundle.coins} Coins`,
        status: 'Completed',
        date: new Date().toISOString().replace('T', ' ').substring(0, 16),
        cost: `$${selectedBundle.price.toFixed(2)} USD`
      };
      db.save('wallet_transactions', [newTransaction, ...currentTrans]);

      setPaymentStep('success');
    }, 1200); // Quick professional processing delay
  };

  // Live currency calculators
  // Cash to Coins rate: $1.00 USD = 100 Coins
  // Coins to Cash rate: 100 Coins = $1.00 USD (With 1% processing fee subtracted during exchange)
  const amtNum = parseFloat(exchangeAmount) || 0;
  const computedReturn = exchangeType === 'cash_to_coins' 
    ? (amtNum * 100) 
    : (amtNum * 0.01 * 0.99); // Subtract 1% conversion adjustment

  const handleExecuteExchange = (e: React.FormEvent) => {
    e.preventDefault();
    if (amtNum <= 0) return;

    if (exchangeType === 'cash_to_coins') {
      if (cashBalance < amtNum) {
        alert('Insufficient Cash USD Balance to purchase coins!');
        return;
      }
      // Deduct cash, add coins
      const nextCash = cashBalance - amtNum;
      const nextCoins = coinsBalance + Math.floor(computedReturn);
      db.save('cash_balance', nextCash);
      saveWalletCoinsBalance(appUser.id, nextCoins);

      const trans = db.load('wallet_transactions', []);
      db.save('wallet_transactions', [{
        id: `t_${Date.now()}`,
        type: 'Exchanged Cash to Coins',
        amount: `+${Math.floor(computedReturn)} Coins`,
        status: 'Completed',
        date: new Date().toISOString().replace('T', ' ').substring(0, 16),
        cost: `-$${amtNum.toFixed(2)} USD`
      }, ...trans]);

      setExchangeSuccess(`Exchanged $${amtNum.toFixed(2)} USD for ${Math.floor(computedReturn)} Coins!`);
      setExchangeAmount('');
      setTimeout(() => setExchangeSuccess(null), 4000);
    } else {
      if (coinsBalance < amtNum) {
        alert('Insufficient Coins Balance for exchange!');
        return;
      }
      // Deduct coins, add cash
      const nextCoins = coinsBalance - amtNum;
      const nextCash = cashBalance + computedReturn;
      saveWalletCoinsBalance(appUser.id, nextCoins);
      db.save('cash_balance', nextCash);

      const trans = db.load('wallet_transactions', []);
      db.save('wallet_transactions', [{
        id: `t_${Date.now()}`,
        type: 'Exchanged Coins to Cash',
        amount: `+$${computedReturn.toFixed(2)} USD`,
        status: 'Completed',
        date: new Date().toISOString().replace('T', ' ').substring(0, 16),
        cost: `-${amtNum} Coins`
      }, ...trans]);

      setExchangeSuccess(`Exchanged ${amtNum} Coins for $${computedReturn.toFixed(2)} USD!`);
      setExchangeAmount('');
      setTimeout(() => setExchangeSuccess(null), 4000);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-left animate-in fade-in duration-300">
      
      {/* 1. Buying Coins Package Selector */}
      <div className="space-y-6">
        <div>
          <h3 className="text-xl font-black text-foreground">Purchase Stream Coin Bundles</h3>
          <p className="text-xs text-muted-foreground font-semibold mt-1">Load gold coins into your stream reserve with visual credit card processing.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {COINS_BUNDLES.map(bundle => (
            <div 
              key={bundle.coins}
              onClick={() => handleSelectBundle(bundle)}
              className="relative p-5 bg-card hover:bg-secondary/25 border border-border rounded-2xl cursor-pointer hover:border-amber-500/40 hover:-translate-y-0.5 transition-all flex flex-col justify-between h-40 group"
            >
              {bundle.badge && (
                <span className="absolute top-3 right-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full select-none shadow">
                  {bundle.badge}
                </span>
              )}
              <div className="space-y-1">
                <p className="text-xs font-bold text-muted-foreground">{bundle.label}</p>
                <div className="flex items-center gap-1.5 pt-1.5">
                  <div className="p-1 px-1.5 bg-amber-500/10 text-amber-500 rounded-lg text-xs font-black flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5" />
                  </div>
                  <h4 className="text-xl font-black text-foreground">{bundle.coins.toLocaleString()} Coins</h4>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="text-lg font-black text-foreground">${bundle.price.toFixed(2)} <span className="text-[10px] text-muted-foreground font-semibold">USD</span></span>
                <span className="text-[11px] font-black text-primary group-hover:underline flex items-center gap-1">
                  Buy Now →
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Coin ⇄ Cash Conversion Desk */}
      <div className="space-y-6">
        <div>
          <h3 className="text-xl font-black text-foreground">Liquidation & Conversion Desk</h3>
          <p className="text-xs text-muted-foreground font-semibold mt-1">Swap between instant streaming coins and withdrawable cash USD holdings instantly.</p>
        </div>

        <form onSubmit={handleExecuteExchange} className="bg-card border border-border rounded-[32px] p-6 space-y-5 shadow-sm">
          {/* Toggle Type */}
          <div className="bg-secondary/40 p-1 rounded-xl border border-border flex">
            <button
              type="button"
              onClick={() => { setExchangeType('cash_to_coins'); setExchangeAmount(''); }}
              className={`flex-1 py-2 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-2 ${
                exchangeType === 'cash_to_coins'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-secondary/60'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" /> Cash → Coins
            </button>
            <button
              type="button"
              onClick={() => { setExchangeType('coins_to_cash'); setExchangeAmount(''); }}
              className={`flex-1 py-2 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-2 ${
                exchangeType === 'coins_to_cash'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-secondary/60'
              }`}
            >
              <Coins className="w-3.5 h-3.5" /> Coins → Cash
            </button>
          </div>

          <div className="space-y-3">
            {/* Input card */}
            <div className="bg-secondary/20 p-4 rounded-2xl border border-border/65">
              <label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest block mb-1">
                You Transact
              </label>
              <div className="flex items-center justify-between gap-2 overflow-hidden">
                <input
                  type="number"
                  value={exchangeAmount}
                  onChange={e => setExchangeAmount(e.target.value)}
                  placeholder="0.00"
                  step={exchangeType === 'cash_to_coins' ? '0.01' : '1'}
                  className="bg-transparent border-0 text-2xl font-black text-foreground focus:ring-0 focus:outline-none p-0 min-w-0 flex-1"
                />
                <div className="flex items-center gap-1.5 shrink-0 select-none">
                  {exchangeType === 'cash_to_coins' ? (
                    <>
                      <span className="p-1 px-1.5 bg-emerald-500/10 text-emerald-500 rounded-lg text-xs font-black">USD</span>
                      <span className="text-[10px] text-muted-foreground font-bold">Max: ${cashBalance.toFixed(2)}</span>
                    </>
                  ) : (
                    <>
                      <span className="p-1 px-1.5 bg-amber-500/10 text-amber-500 rounded-lg text-xs font-black">Coins</span>
                      <span className="text-[10px] text-muted-foreground font-bold">Max: {coinsBalance}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Down conversion arrow */}
            <div className="flex justify-center -my-1">
              <div className="p-2 rounded-full border border-border bg-card shadow text-muted-foreground">
                <ArrowRightLeft className="w-4 h-4" />
              </div>
            </div>

            {/* Return Output Card */}
            <div className="bg-secondary/40 p-4 rounded-2xl border border-border/65">
              <label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest block mb-1">
                You Receive (Estimate)
              </label>
              <div className="flex items-center justify-between">
                <h4 className="text-2xl font-black text-foreground">
                  {exchangeType === 'cash_to_coins'
                    ? computedReturn.toLocaleString()
                    : `$${computedReturn.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
                  }
                </h4>
                <div>
                  {exchangeType === 'cash_to_coins' ? (
                    <span className="p-1 px-1.5 bg-amber-500/10 text-amber-500 rounded-lg text-xs font-black">Coins</span>
                  ) : (
                    <span className="p-1 px-1.5 bg-emerald-500/10 text-emerald-500 rounded-lg text-xs font-black">USD</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Pricing parameters info */}
          <div className="text-[10px] font-semibold text-muted-foreground space-y-1">
            <div className="flex justify-between">
              <span>Conversion Rate</span>
              <span>100 Coins = $1.00 USD</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Dynamic Platform Exchange Fee</span>
              <span>{exchangeType === 'cash_to_coins' ? '0%' : '1%'}</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={amtNum <= 0}
            className="w-full py-4 bg-primary text-primary-foreground font-black rounded-2xl hover:opacity-95 active:scale-[0.99] transition-all text-sm shadow-md shadow-primary/20 disabled:opacity-50"
          >
            Execute Liquidity Swap
          </button>

          {exchangeSuccess && (
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs font-bold text-emerald-500 text-center animate-in face-in duration-300">
              {exchangeSuccess}
            </div>
          )}
        </form>
      </div>

      {/* 3. Secure Stripe Credit Card Checkout Modal */}
      {selectedBundle && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setSelectedBundle(null)}
          />
          
          <div className="w-full max-w-md bg-card border border-border rounded-[32px] overflow-hidden shadow-2xl relative z-10 p-6 flex flex-col gap-5 animate-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-indigo-500" />
                <h3 className="text-lg font-black text-foreground">Secure Payment Gateway</h3>
              </div>
              <button 
                onClick={() => setSelectedBundle(null)}
                className="p-1.5 bg-secondary/80 rounded-lg text-muted-foreground hover:bg-secondary transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {paymentStep === 'input' && (
              <div className="space-y-4 text-left">
                <div className="p-4 bg-indigo-500/5 border border-indigo-500/15 rounded-2xl flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black text-indigo-500 uppercase">Item Description</p>
                    <h4 className="text-sm font-black text-foreground">{selectedBundle.label} ({selectedBundle.coins} Coins)</h4>
                  </div>
                  <h4 className="text-base font-black text-indigo-500">${selectedBundle.price.toFixed(2)}</h4>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Cardholder Name</label>
                    <input
                      type="text"
                      value={cardName}
                      onChange={e => setCardName(e.target.value)}
                      className="w-full mt-1 bg-secondary/40 border border-border rounded-xl p-2.5 text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="Jane Doe"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Card Number</label>
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={e => setCardNumber(e.target.value)}
                      className="w-full mt-1 bg-secondary/40 border border-border rounded-xl p-2.5 text-xs font-bold font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="4111 2222 3333 4444"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Expiry Date</label>
                      <input
                        type="text"
                        value={cardExpiry}
                        onChange={e => setCardExpiry(e.target.value)}
                        className="w-full mt-1 bg-secondary/40 border border-border rounded-xl p-2.5 text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder="MM/YY"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Secure CVC</label>
                      <input
                        type="password"
                        value={cardCvc}
                        onChange={e => setCardCvc(e.target.value)}
                        className="w-full mt-1 bg-secondary/40 border border-border rounded-xl p-2.5 text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder="3-digit"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 py-1 text-[10px] text-muted-foreground font-semibold">
                  <Lock className="w-3 h-3 text-indigo-500" />
                  Your connection is securely encrypted by certified merchant protocols.
                </div>

                <button
                  onClick={processPurchasePayment}
                  className="w-full py-3 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 transition-all text-sm shadow-md shadow-indigo-600/15"
                >
                  Pay ${selectedBundle.price.toFixed(2)} USD Securely
                </button>
              </div>
            )}

            {paymentStep === 'processing' && (
              <div className="py-12 flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
                <div className="text-center">
                  <h4 className="text-sm font-black text-foreground">Processing Secure Transaction</h4>
                  <p className="text-[11px] text-muted-foreground font-semibold mt-1">Interrogating card issuing node bank...</p>
                </div>
              </div>
            )}

            {paymentStep === 'success' && (
              <div className="py-6 flex flex-col items-center justify-center gap-4 text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-500 mb-2">
                  <Check className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="text-base font-black text-foreground">Transaction Successful!</h4>
                  <p className="text-xs text-muted-foreground font-semibold mt-1">
                    Added <span className="text-amber-500 font-bold">+{selectedBundle.coins} coins</span> to your wallet immediately.
                  </p>
                </div>
                <button
                  onClick={() => setSelectedBundle(null)}
                  className="w-full py-2.5 mt-3 bg-secondary text-foreground hover:bg-secondary/80 font-black rounded-xl transition-all text-xs"
                >
                  Return to Dashboard
                </button>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
