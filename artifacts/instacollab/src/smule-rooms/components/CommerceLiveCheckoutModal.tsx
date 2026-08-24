import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, Copy, CreditCard, MapPin, PackageCheck, Truck, X } from 'lucide-react';
import { isPlatformApiAvailable } from '../../lib/platformApi';
import { isStripeCommerceConfigured, startStripeCommerceCheckout } from '../../lib/commercePayments';
import {
  createCommerceOrderId,
  formatCommercePrice,
  type CommercePaymentMethod,
  type CommerceProduct,
  type CommerceShippingInfo,
} from '../utils/liveRoomTypes';
import './commerce-live-approved.css';
import { CommerceProductArt } from './CommerceProductArt';

export type CommerceCheckoutResult = {
  paid: boolean;
  paymentMethod: CommercePaymentMethod;
  shipping: CommerceShippingInfo;
  quantity: number;
};

export type CommerceLiveCheckoutModalProps = {
  open: boolean;
  product: CommerceProduct;
  roomId: string;
  hostUserId?: string;
  buyerUserId: string;
  buyerDisplayName?: string;
  onClose: () => void;
  onComplete: (result: CommerceCheckoutResult) => void | Promise<void>;
};

const emptyShipping = (name = ''): CommerceShippingInfo => ({
  fullName: name,
  email: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'United States',
});

type Step = 'checkout' | 'shipping' | 'payment' | 'review' | 'processing' | 'placed' | 'order' | 'tracking';

function defaultPaymentMethod(product: CommerceProduct): CommercePaymentMethod {
  return product.priceType === 'coins' ? 'coins' : 'card';
}

export function CommerceLiveCheckoutModal({
  open,
  product,
  roomId,
  hostUserId = '',
  buyerUserId,
  buyerDisplayName = '',
  onClose,
  onComplete,
}: CommerceLiveCheckoutModalProps) {
  const [step, setStep] = useState<Step>('checkout');
  const [qty, setQty] = useState(1);
  const [shipping, setShipping] = useState(() => emptyShipping(buyerDisplayName));
  const [method, setMethod] = useState<CommercePaymentMethod>(() => defaultPaymentMethod(product));
  const [orderId] = useState(() => createCommerceOrderId());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep('checkout');
    setQty(1);
    setShipping(emptyShipping(buyerDisplayName));
    setMethod(defaultPaymentMethod(product));
    setError(null);
    setBusy(false);
  }, [open, product.id, buyerDisplayName, product.priceType]);

  const unitAmount = useMemo(() => {
    if (product.priceType === 'cash') return `$${(product.priceUsd ?? 0).toFixed(2)}`;
    return `${product.priceCoins ?? 0} UniCoins`;
  }, [product]);

  const totalAmount = useMemo(() => {
    if (product.priceType === 'cash') return `$${((product.priceUsd ?? 0) * qty).toFixed(2)}`;
    return `${(product.priceCoins ?? 0) * qty} UniCoins`;
  }, [product, qty]);

  const cardAvailable =
    product.priceType === 'cash' &&
    isStripeCommerceConfigured() &&
    isPlatformApiAvailable() &&
    Boolean(hostUserId.trim()) &&
    Boolean(buyerUserId.trim()) &&
    Boolean(roomId.trim());

  if (!open) return null;

  const next = () =>
    setStep((current) =>
      current === 'checkout' ? 'shipping' : current === 'shipping' ? 'payment' : current === 'payment' ? 'review' : current,
    );

  const pay = async () => {
    setError(null);
    setBusy(true);
    setStep('processing');
    try {
      if (method === 'card') {
        if (!cardAvailable) {
          throw new Error('Secure card checkout is unavailable. Check Stripe configuration and try again.');
        }
        const amountUsd = (product.priceUsd ?? 0) * qty;
        if (amountUsd < 0.5) {
          throw new Error('Card checkout requires at least $0.50');
        }
        const session = await startStripeCommerceCheckout({
          amountUsd,
          productId: product.id,
          productTitle: product.title,
          roomId,
          hostUserId,
          orderId,
          buyerUserId,
          pendingOrder: {
            product,
            shipping,
            hostUserId,
            orderId,
            buyerUserId,
            buyerDisplayName,
            paymentMethod: 'card' as const,
            quantity: qty,
          },
        });
        window.location.assign(session.url);
        return;
      }

      await Promise.resolve(
        onComplete({
          paid: true,
          paymentMethod: method,
          shipping,
          quantity: qty,
        }),
      );
      setStep('placed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
      setStep('review');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ul-commerce-overlay" role="dialog" aria-modal="true" data-ui-id={`commerce.checkout.${step}`}>
      <div className="ul-commerce-sheet ul-commerce-checkout-sheet">
        <header>
          <button
            type="button"
            onClick={() => (step === 'checkout' ? onClose() : setStep('checkout'))}
            aria-label="Back"
            disabled={busy}
          >
            <ChevronLeft />
          </button>
          <strong>
            {step === 'placed'
              ? 'Order Placed'
              : step === 'order'
                ? 'My Order'
                : step === 'tracking'
                  ? 'Track Shipment'
                  : step === 'processing'
                    ? 'Processing Payment'
                    : step[0].toUpperCase() + step.slice(1)}
          </strong>
          <button type="button" onClick={onClose} aria-label="Close" disabled={busy}>
            <X />
          </button>
        </header>

        {step === 'checkout' ? (
          <>
            <Product product={product} />
            <div className="ul-commerce-qty">
              <span>Quantity</span>
              <div>
                <button type="button" onClick={() => setQty(Math.max(1, qty - 1))} disabled={busy}>
                  −
                </button>
                <b>{qty}</b>
                <button type="button" onClick={() => setQty(qty + 1)} disabled={busy}>
                  +
                </button>
              </div>
            </div>
            <Summary unit={unitAmount} total={totalAmount} />
            <Primary onClick={next} disabled={busy}>
              Next: Shipping Info
            </Primary>
          </>
        ) : null}

        {step === 'shipping' ? (
          <>
            <h3>Shipping Information</h3>
            <div className="ul-commerce-form">
              {(
                [
                  ['fullName', 'Full Name'],
                  ['phone', 'Phone Number'],
                  ['addressLine1', 'Address'],
                  ['addressLine2', 'Apt, Suite, etc. (Optional)'],
                  ['city', 'City'],
                  ['state', 'State'],
                  ['postalCode', 'ZIP Code'],
                  ['country', 'Country'],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  <span>{label}</span>
                  <input
                    value={shipping[key] ?? ''}
                    onChange={(event) => setShipping({ ...shipping, [key]: event.target.value })}
                    disabled={busy}
                  />
                </label>
              ))}
            </div>
            <Primary onClick={next} disabled={busy || !shipping.fullName.trim() || !shipping.addressLine1.trim()}>
              Next: Payment Method
            </Primary>
          </>
        ) : null}

        {step === 'payment' ? (
          <>
            <h3>Payment Method</h3>
            <div className="ul-commerce-payment-list">
              {product.priceType === 'coins' ? (
                <Choice active={method === 'coins'} onClick={() => setMethod('coins')}>
                  UniCoins Balance
                </Choice>
              ) : null}
              {product.priceType === 'cash' ? (
                <>
                  <Choice active={method === 'card'} onClick={() => setMethod('card')}>
                    <CreditCard aria-hidden="true" /> Credit / Debit Card (USD)
                  </Choice>
                  <Choice active={method === 'cash_balance'} onClick={() => setMethod('cash_balance')}>
                    Cash Balance (USD)
                  </Choice>
                </>
              ) : null}
            </div>
            {method === 'card' && !cardAvailable ? (
              <p className="ul-commerce-checkout-hint">
                Secure Stripe card checkout needs API + Stripe publishable key. Cash balance still works for USD.
              </p>
            ) : null}
            <Primary onClick={next} disabled={busy || (method === 'card' && !cardAvailable)}>
              Next: Review Order
            </Primary>
          </>
        ) : null}

        {step === 'review' ? (
          <>
            <h3>Review Order</h3>
            <Product product={product} />
            <div className="ul-commerce-review">
              <p>
                <span>Shipping To</span>
                <b>{shipping.fullName || buyerDisplayName}</b>
                <small>
                  {shipping.addressLine1} {shipping.city} {shipping.state} {shipping.postalCode}
                </small>
              </p>
              <p>
                <span>Payment Method</span>
                <b>
                  {method === 'coins'
                    ? 'UniCoins Balance'
                    : method === 'card'
                      ? 'Credit / Debit Card (Stripe)'
                      : 'Cash Balance'}
                </b>
              </p>
            </div>
            <Summary unit={unitAmount} total={totalAmount} />
            {error ? <p className="ul-commerce-checkout-error">{error}</p> : null}
            <Primary onClick={() => void pay()} disabled={busy}>
              {method === 'card' ? `Pay ${totalAmount} with Card` : `Pay ${totalAmount}`}
            </Primary>
          </>
        ) : null}

        {step === 'processing' ? (
          <div className="ul-commerce-state">
            <div className="ul-commerce-gift-orb">🎁</div>
            <h2>{method === 'card' ? 'Redirecting to secure checkout…' : 'Processing Payment'}</h2>
            <p>
              {method === 'card'
                ? 'You will complete payment with real card details on Stripe.'
                : 'Please wait while we process your payment…'}
            </p>
            <div className="ul-commerce-spinner" />
            <small>Do not close this panel</small>
          </div>
        ) : null}

        {step === 'placed' ? (
          <div className="ul-commerce-state">
            <div className="ul-commerce-success">
              <Check />
            </div>
            <h2>Order Placed Successfully!</h2>
            <p className="ul-commerce-order-id">
              Order ID <b>#{orderId}</b>
              <Copy size={14} aria-hidden="true" />
            </p>
            <Primary onClick={() => setStep('order')}>View My Order</Primary>
          </div>
        ) : null}

        {step === 'order' ? (
          <>
            <div className="ul-commerce-order-head">
              <span>#{orderId}</span>
              <b>Confirmed</b>
            </div>
            <Product product={product} />
            <dl className="ul-commerce-detail-grid">
              <dt>Status</dt>
              <dd>Confirmed</dd>
              <dt>Shipping To</dt>
              <dd>
                {shipping.fullName}
                <br />
                {shipping.addressLine1}
                <br />
                {shipping.city}, {shipping.state} {shipping.postalCode}
              </dd>
              <dt>Total</dt>
              <dd>{totalAmount}</dd>
            </dl>
            <Primary onClick={() => setStep('tracking')}>Track Shipment</Primary>
          </>
        ) : null}

        {step === 'tracking' ? (
          <>
            <div className="ul-commerce-tracking">
              <div className="done">
                <Check />
                Confirmed
              </div>
              <div className="done">
                <PackageCheck />
                Packed
              </div>
              <div className="active">
                <Truck />
                Shipped
              </div>
              <div>
                <MapPin />
                Delivered
              </div>
            </div>
            <div className="ul-commerce-state">
              <Truck size={74} />
              <h2>Your order is on the way!</h2>
              <dl className="ul-commerce-detail-grid">
                <dt>Tracking Number</dt>
                <dd>Pending carrier assignment</dd>
                <dt>Estimated Delivery</dt>
                <dd>Updates after shipment</dd>
              </dl>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function Product({ product }: { product: CommerceProduct }) {
  return (
    <div className="ul-commerce-product-row">
      <div><CommerceProductArt product={product} fallback={<PackageCheck aria-hidden="true" />} /></div>
      <p>
        <strong>{product.title}</strong>
        <small>{product.description || 'Premium live product'}</small>
      </p>
      <b>{formatCommercePrice(product)}</b>
    </div>
  );
}

function Summary({ unit, total }: { unit: string; total: string }) {
  return (
    <div className="ul-commerce-summary">
      <p>
        <span>Unit price</span>
        <b>{unit}</b>
      </p>
      <p>
        <span>Shipping Fee</span>
        <b>Calculated at checkout</b>
      </p>
      <p className="total">
        <span>Total</span>
        <b>{total}</b>
      </p>
    </div>
  );
}

function Primary({
  children,
  onClick,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button className="ul-commerce-primary" type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function Choice({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`ul-commerce-choice ${active ? 'active' : ''}`} onClick={onClick}>
      {children}
      <span>{active ? '✓' : '○'}</span>
    </button>
  );
}
