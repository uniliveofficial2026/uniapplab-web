import { useCallback, useMemo, useState } from 'react';
import { CreditCard, Loader2, Lock, ShoppingBag, X } from 'lucide-react';
import { CoinIcon } from '../../components/common/CoinIcon';
import { isStripeCommerceConfigured, startStripeCommerceCheckout } from '../../lib/commercePayments';
import { useDB } from '../../lib/useDB';
import { useLiveCoinsBalance } from '../../hooks/useLiveCoinsBalance';
import type {
  CommercePaymentMethod,
  CommerceProduct,
  CommerceShippingInfo,
} from '../utils/liveRoomTypes';
import { createCommerceOrderId, formatCommercePrice, normalizeCommerceProduct } from '../utils/liveRoomTypes';

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=160&h=160&fit=crop';

export type CommerceCheckoutResult = {
  shipping: CommerceShippingInfo;
  paymentMethod: CommercePaymentMethod;
  paid: boolean;
};

type CommerceLiveCheckoutModalProps = {
  open: boolean;
  product: CommerceProduct;
  roomId: string;
  hostUserId: string;
  buyerUserId: string;
  buyerDisplayName: string;
  onClose: () => void;
  onComplete: (result: CommerceCheckoutResult) => void;
};

type PaymentStep = 'form' | 'processing';

export function CommerceLiveCheckoutModal({
  open,
  product,
  roomId,
  hostUserId,
  buyerUserId,
  buyerDisplayName,
  onClose,
  onComplete,
}: CommerceLiveCheckoutModalProps) {
  const db = useDB();
  const coinsBalance = useLiveCoinsBalance(buyerUserId);
  const cashBalance = db.load('cash_balance', 0);
  const normalized = useMemo(() => normalizeCommerceProduct(product), [product]);
  const stripeEnabled = isStripeCommerceConfigured();

  const [fullName, setFullName] = useState(buyerDisplayName);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('');
  const [useSecureCard, setUseSecureCard] = useState(true);
  const [paymentStep, setPaymentStep] = useState<PaymentStep>('form');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resetPaymentState = useCallback(() => {
    setPaymentStep('form');
    setErrorMessage(null);
  }, []);

  if (!open) return null;

  const buildShipping = (): CommerceShippingInfo | null => {
    const shipping: CommerceShippingInfo = {
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      addressLine1: addressLine1.trim(),
      addressLine2: addressLine2.trim() || undefined,
      city: city.trim(),
      state: state.trim(),
      postalCode: postalCode.trim(),
      country: country.trim(),
    };
    if (
      !shipping.fullName ||
      !shipping.email ||
      !shipping.phone ||
      !shipping.addressLine1 ||
      !shipping.city ||
      !shipping.state ||
      !shipping.postalCode ||
      !shipping.country
    ) {
      return null;
    }
    return shipping;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    resetPaymentState();

    const shipping = buildShipping();
    if (!shipping) {
      setErrorMessage('Fill in your contact info and shipping address.');
      return;
    }

    if (normalized.priceType === 'coins') {
      const price = normalized.priceCoins ?? 0;
      if (coinsBalance < price) {
        setErrorMessage('Not enough coins for this item.');
        return;
      }
      onComplete({ shipping, paymentMethod: 'coins', paid: true });
      return;
    }

    const priceUsd = normalized.priceUsd ?? 0;
    if (useSecureCard) {
      if (!stripeEnabled) {
        setErrorMessage('Global card payments are not configured yet. Use cash balance or ask the host.');
        return;
      }
      setPaymentStep('processing');
      try {
        const orderId = createCommerceOrderId();
        const session = await startStripeCommerceCheckout({
          amountUsd: priceUsd,
          productId: normalized.id,
          productTitle: normalized.title,
          roomId,
          hostUserId,
          orderId,
          buyerUserId,
          pendingOrder: {
            product: normalized,
            shipping,
            hostUserId,
            orderId,
            buyerUserId,
            buyerDisplayName,
            paymentMethod: 'card' as const,
          },
        });
        window.location.assign(session.url);
      } catch (error) {
        setPaymentStep('form');
        setErrorMessage(
          error instanceof Error ? error.message : 'Could not start secure payment checkout.',
        );
      }
      return;
    }

    if (cashBalance < priceUsd) {
      setErrorMessage('Insufficient cash balance. Use secure card payment or add funds.');
      return;
    }
    onComplete({ shipping, paymentMethod: 'cash_balance', paid: true });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label="Close checkout"
        onClick={onClose}
      />

      <div className="relative z-10 flex max-h-[min(92vh,720px)] w-full max-w-md flex-col overflow-hidden rounded-t-[28px] border border-amber-400/25 bg-[#121212] shadow-2xl sm:rounded-[28px]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-amber-300" />
            <h3 className="text-sm font-black text-white">Checkout</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-white/60 hover:bg-white/10"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
            <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
              <img
                src={normalized.imageUrl || FALLBACK_IMAGE}
                alt=""
                className="h-16 w-16 shrink-0 rounded-xl object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-white">{normalized.title}</p>
                {normalized.description ? (
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-white/60">{normalized.description}</p>
                ) : null}
                <p className="mt-1 inline-flex items-center gap-1 text-sm font-bold text-amber-200">
                  {normalized.priceType === 'coins' ? (
                    <>
                      <CoinIcon className="h-4 w-4" />
                      {normalized.priceCoins}
                    </>
                  ) : (
                    formatCommercePrice(normalized)
                  )}
                </p>
              </div>
            </div>

            {paymentStep === 'processing' ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
                <p className="text-sm font-semibold text-white">Opening secure global checkout…</p>
              </div>
            ) : (
              <>
                <section className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-amber-300">
                    Personal information
                  </p>
                  <input
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Full name"
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-xs text-white placeholder:text-white/35"
                    required
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="Email"
                      type="email"
                      className="rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-xs text-white placeholder:text-white/35"
                      required
                    />
                    <input
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="Phone"
                      className="rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-xs text-white placeholder:text-white/35"
                      required
                    />
                  </div>
                </section>

                <section className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-amber-300">
                    Shipping address
                  </p>
                  <input
                    value={addressLine1}
                    onChange={(event) => setAddressLine1(event.target.value)}
                    placeholder="Street address"
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-xs text-white placeholder:text-white/35"
                    required
                  />
                  <input
                    value={addressLine2}
                    onChange={(event) => setAddressLine2(event.target.value)}
                    placeholder="Apt, suite (optional)"
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-xs text-white placeholder:text-white/35"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={city}
                      onChange={(event) => setCity(event.target.value)}
                      placeholder="City"
                      className="rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-xs text-white placeholder:text-white/35"
                      required
                    />
                    <input
                      value={state}
                      onChange={(event) => setState(event.target.value)}
                      placeholder="State / region"
                      className="rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-xs text-white placeholder:text-white/35"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={postalCode}
                      onChange={(event) => setPostalCode(event.target.value)}
                      placeholder="Postal code"
                      className="rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-xs text-white placeholder:text-white/35"
                      required
                    />
                    <input
                      value={country}
                      onChange={(event) => setCountry(event.target.value)}
                      placeholder="Country"
                      className="rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-xs text-white placeholder:text-white/35"
                      required
                    />
                  </div>
                </section>

                {normalized.priceType === 'coins' ? (
                  <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white/70">
                    Pay with coins · Balance:{' '}
                    <span className="inline-flex items-center gap-1 font-bold text-amber-200">
                      <CoinIcon className="h-3.5 w-3.5" />
                      {coinsBalance}
                    </span>
                  </p>
                ) : (
                  <section className="space-y-2 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-300">
                        Payment
                      </p>
                      <p className="text-[11px] text-white/60">
                        Cash balance: ${cashBalance.toFixed(2)}
                      </p>
                    </div>

                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={useSecureCard}
                        onChange={(event) => setUseSecureCard(event.target.checked)}
                        className="rounded border-white/20"
                      />
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-white">
                        <Lock className="h-3.5 w-3.5 text-indigo-300" />
                        Pay securely with card (global)
                      </span>
                    </label>

                    {useSecureCard ? (
                      <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[11px] text-white/65">
                        <div className="mb-1 inline-flex items-center gap-1.5 font-bold text-indigo-300">
                          <CreditCard className="h-3.5 w-3.5" />
                          Stripe secure checkout
                        </div>
                        <p>
                          You will continue to Stripe for global card payments. Your shipping details
                          are saved and the order is created after payment succeeds.
                        </p>
                      </div>
                    ) : (
                      <p className="text-[11px] text-white/55">
                        Or pay from your cash wallet balance (${(normalized.priceUsd ?? 0).toFixed(2)}).
                      </p>
                    )}
                  </section>
                )}

                {errorMessage ? (
                  <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] font-semibold text-red-200">
                    {errorMessage}
                  </p>
                ) : null}
              </>
            )}
          </div>

          {paymentStep !== 'processing' ? (
            <div className="border-t border-white/10 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button
                type="submit"
                className="w-full rounded-full bg-amber-500 py-3 text-xs font-black uppercase tracking-wide text-black shadow-lg active:scale-[0.98]"
              >
                {normalized.priceType === 'coins'
                  ? `Buy for ${normalized.priceCoins} coins`
                  : useSecureCard
                    ? `Pay ${formatCommercePrice(normalized)} securely`
                    : `Buy for ${formatCommercePrice(normalized)}`}
              </button>
            </div>
          ) : null}
        </form>
      </div>
    </div>
  );
}
