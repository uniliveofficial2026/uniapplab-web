import { useEffect, useState } from 'react';
import { Check, Coins, CreditCard, Loader2, ShieldCheck, X } from 'lucide-react';
import { useCurrentUser } from '../../lib/useCurrentUser';
import { isCloudAuthUserId } from '../../lib/auth/cloudProfile';
import {
  createRechargeCheckoutSession,
  fetchRechargePackages,
  isPlatformApiAvailable,
  verifyRechargeCheckoutSession,
} from '../../lib/platformApi';
import { RECHARGE_PACKAGES_FALLBACK } from '../../lib/live/giftStudioCatalog';
import { COIN_RATE_LABEL, usdPriceForCoins } from '../../lib/coinPricing';
import { addWalletCoins } from '../../lib/walletKstarSync';
import { syncServerWalletBalance } from '../../lib/walletServerSync';

type RechargePack = {
  id: string;
  coins: number;
  priceUsd: number;
  bonusCoins: number;
  isPopular?: boolean;
};

type LiveGiftRechargeModalProps = {
  open: boolean;
  onClose: () => void;
  /** Called after local/dev credit or before Stripe redirect. */
  onCredited?: (coins: number) => void;
  zIndexClass?: string;
};

/** Verify Stripe return on any surface that can open gift recharge. */
export function useGiftRechargeReturnSync(userId: string) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id') || params.get('recharge_session');
    const recharge = params.get('recharge');
    if (!sessionId || (recharge !== '1' && !params.has('recharge_session'))) return;
    if (!isCloudAuthUserId(userId)) return;
    let cancelled = false;
    void (async () => {
      try {
        const result = await verifyRechargeCheckoutSession(sessionId);
        if (cancelled) return;
        if (result.paid || result.credited) {
          await syncServerWalletBalance(userId);
          window.dispatchEvent(new CustomEvent('wallet-coins-updated'));
          window.dispatchEvent(
            new CustomEvent('app-toast', { detail: 'Coins added to your wallet' }),
          );
        }
      } catch {
        /* ignore — wallet screen can retry */
      } finally {
        if (cancelled) return;
        const url = new URL(window.location.href);
        url.searchParams.delete('session_id');
        url.searchParams.delete('recharge_session');
        url.searchParams.delete('recharge');
        window.history.replaceState({}, '', url.toString());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);
}

export function LiveGiftRechargeModal({
  open,
  onClose,
  onCredited,
  zIndexClass = 'z-[220]',
}: LiveGiftRechargeModalProps) {
  const appUser = useCurrentUser();
  const [packs, setPacks] = useState<RechargePack[]>(
    RECHARGE_PACKAGES_FALLBACK.map((pack) => ({ ...pack })),
  );
  const [selectedPack, setSelectedPack] = useState<RechargePack | null>(packs[1] ?? packs[0] ?? null);
  const [customCoins, setCustomCoins] = useState('');
  const [paymentStep, setPaymentStep] = useState<'select' | 'submitting' | 'success'>('select');
  const [error, setError] = useState<string | null>(null);
  const [creditedCoins, setCreditedCoins] = useState(0);

  useEffect(() => {
    if (!open) return;
    setPaymentStep('select');
    setError(null);
    let cancelled = false;
    void (async () => {
      if (!isPlatformApiAvailable()) return;
      try {
        const { packages } = await fetchRechargePackages();
        if (cancelled || !packages?.length) return;
        const next = packages.map((pkg) => ({
          id: pkg.id,
          coins: pkg.coins,
          bonusCoins: pkg.bonusCoins,
          priceUsd: pkg.priceUsdCents / 100,
          isPopular: Boolean(pkg.badge),
        }));
        setPacks(next);
        setSelectedPack(next.find((row) => row.isPopular) ?? next[0] ?? null);
      } catch {
        /* keep fallback */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const customCoinsNum = parseInt(customCoins, 10) || 0;
  const getCustomBonus = (_coinsNum: number) => 0;
  const getCustomPrice = (coinsNum: number) => usdPriceForCoins(coinsNum);

  const customBonus = getCustomBonus(customCoinsNum);
  const customPrice = getCustomPrice(customCoinsNum);
  const priceToPay = selectedPack ? selectedPack.priceUsd : customPrice;
  const totalCoinsToReceive = selectedPack
    ? selectedPack.coins + selectedPack.bonusCoins
    : customCoinsNum + customBonus;

  const handleSubmit = () => {
    if (!selectedPack && customCoinsNum <= 0) return;
    setPaymentStep('submitting');
    setError(null);

    void (async () => {
      const canStripe =
        Boolean(selectedPack?.id) && isPlatformApiAvailable() && isCloudAuthUserId(appUser.id);

      if (canStripe && selectedPack?.id) {
        try {
          const origin = window.location.origin;
          const path = window.location.pathname;
          const { url } = await createRechargeCheckoutSession({
            packageId: selectedPack.id,
            successUrl: `${origin}${path}?recharge=1&session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${origin}${path}?recharge=cancel`,
          });
          if (url) {
            window.location.assign(url);
            return;
          }
          setError('Checkout unavailable. Try again.');
          setPaymentStep('select');
          return;
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Checkout failed');
          setPaymentStep('select');
          return;
        }
      }

      if (isPlatformApiAvailable() && isCloudAuthUserId(appUser.id)) {
        setError('Stripe checkout is required. Pick a package (custom amounts need Wallet).');
        setPaymentStep('select');
        return;
      }

      // Local/dev only
      window.setTimeout(() => {
        addWalletCoins(appUser.id, totalCoinsToReceive);
        window.dispatchEvent(new CustomEvent('wallet-coins-updated'));
        setCreditedCoins(totalCoinsToReceive);
        onCredited?.(totalCoinsToReceive);
        setPaymentStep('success');
      }, 800);
    })();
  };

  return (
    <div className={`fixed inset-0 ${zIndexClass} flex items-center justify-center bg-black/70 p-4`}>
      <div className="relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 font-sans text-neutral-100 shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-800 p-4">
          <div className="flex items-center gap-2">
            <Coins className="text-emerald-400" size={20} />
            <h3 className="text-base font-extrabold tracking-wide text-white">Coin Recharge</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-800 hover:text-white"
            aria-label="Close recharge"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[420px] flex-1 overflow-y-auto p-5 no-scrollbar">
          {paymentStep === 'select' ? (
            <div className="flex flex-col gap-4">
              <p className="text-xs leading-relaxed text-neutral-400">
                Buy coin packages to send animated gifts in any live room. {COIN_RATE_LABEL}.
              </p>

              <div className="grid grid-cols-2 gap-3">
                {packs.map((pack) => {
                  const isSelected = selectedPack?.id === pack.id;
                  return (
                    <button
                      key={pack.id}
                      type="button"
                      onClick={() => {
                        setSelectedPack(pack);
                        setCustomCoins('');
                      }}
                      className={`relative flex flex-col items-start rounded-xl border p-3.5 text-left transition ${
                        isSelected
                          ? 'scale-[1.01] border-emerald-500 bg-neutral-800/80 shadow-md shadow-emerald-500/5'
                          : 'border-neutral-800 bg-neutral-950/40 hover:border-neutral-700 hover:bg-neutral-950/70'
                      }`}
                    >
                      {pack.isPopular ? (
                        <span className="absolute right-1.5 top-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-emerald-400">
                          Popular
                        </span>
                      ) : null}
                      <div className="flex items-center gap-1.5 font-mono text-base font-extrabold text-white">
                        <Coins size={14} className="text-amber-500" />
                        <span>{pack.coins.toLocaleString()}</span>
                      </div>
                      {pack.bonusCoins > 0 ? (
                        <span className="mt-0.5 text-[10px] font-semibold text-emerald-400">
                          +{pack.bonusCoins.toLocaleString()} bonus
                        </span>
                      ) : null}
                      <span className="mt-3 rounded-md border border-neutral-800 bg-neutral-900 px-2 py-0.5 font-mono text-xs font-black text-neutral-300">
                        ${pack.priceUsd.toFixed(2)}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-col gap-3 border-t border-neutral-800/60 pt-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                  Or custom amount (local/dev)
                </span>
                <div className="relative">
                  <Coins size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-500" />
                  <input
                    type="number"
                    min={1}
                    placeholder="e.g. 2500"
                    value={customCoins}
                    onChange={(event) => {
                      setCustomCoins(event.target.value);
                      setSelectedPack(null);
                    }}
                    className={`w-full rounded-xl border bg-neutral-950/40 py-3 pl-10 pr-4 font-mono text-xs font-extrabold text-white outline-none transition-all ${
                      !selectedPack && customCoinsNum > 0
                        ? 'border-emerald-500/60 bg-neutral-900/50 shadow-sm shadow-emerald-500/10'
                        : 'border-neutral-800 focus:border-emerald-500/70'
                    }`}
                  />
                </div>
                {customCoinsNum > 0 && !selectedPack ? (
                  <div className="grid grid-cols-2 gap-2.5 rounded-xl border border-neutral-800 bg-neutral-950/60 p-3">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">Price</span>
                      <span className="font-mono text-sm font-extrabold text-white">${customPrice.toFixed(2)}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">Total</span>
                      <span className="font-mono text-sm font-black text-emerald-400">
                        {totalCoinsToReceive.toLocaleString()} coins
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex items-center gap-1.5 rounded-xl border border-neutral-800/80 bg-neutral-950/60 p-3 text-xs text-neutral-300">
                <CreditCard size={13} />
                <span>Secure Stripe checkout when signed in</span>
              </div>

              {error ? <p className="text-xs font-bold text-rose-400">{error}</p> : null}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={selectedPack ? false : customCoinsNum <= 0}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 py-3 text-xs font-black text-neutral-950 shadow-lg shadow-emerald-500/10 transition hover:brightness-105 active:scale-[0.99] disabled:opacity-40"
              >
                <ShieldCheck size={14} />
                <span>Pay ${priceToPay.toFixed(2)} USD</span>
              </button>
            </div>
          ) : null}

          {paymentStep === 'submitting' ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Loader2 className="mb-4 h-12 w-12 animate-spin text-emerald-500" />
              <h4 className="mb-1.5 text-sm font-extrabold text-white">Processing…</h4>
              <p className="max-w-xs text-xs text-neutral-400">Opening secure checkout. Please wait.</p>
            </div>
          ) : null}

          {paymentStep === 'success' ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border-2 border-emerald-400 bg-emerald-500/10 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                <Check size={28} className="stroke-[3]" />
              </div>
              <h4 className="mb-1.5 text-lg font-black text-white">Payment Successful</h4>
              <p className="max-w-xs text-xs leading-relaxed text-neutral-400">
                Wallet credited with{' '}
                <span className="font-mono font-bold text-white">{creditedCoins.toLocaleString()} coins</span>.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-6 rounded-lg border border-neutral-700 bg-neutral-800 px-6 py-2 text-xs font-bold text-white transition hover:bg-neutral-700"
              >
                Back to gifts
              </button>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-center gap-1.5 border-t border-neutral-800 bg-neutral-950 p-3.5 text-[10px] text-neutral-500">
          <ShieldCheck size={12} className="shrink-0 text-emerald-400" />
          <span>Encrypted payment · coins sync to your wallet</span>
        </div>
      </div>
    </div>
  );
}
