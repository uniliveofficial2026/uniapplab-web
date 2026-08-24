/**
 * UniLive UI Kit components — React createElement primitives.
 * Provider-neutral, accessible, themeable. Does not redesign production app.
 */
import { createElement as h, useEffect, useId, useRef, useState } from 'react';
import { getTheme, prefersReducedMotion } from './theme.mjs';

function base(extra = {}) {
  const t = getTheme();
  return {
    fontFamily: t.typography.fontFamily,
    color: t.colors.text,
    boxSizing: 'border-box',
    ...extra,
  };
}

function focusRing(el) {
  if (!el) return;
  el.style.outline = `2px solid ${getTheme().colors.focus}`;
  el.style.outlineOffset = '2px';
}

/** @param {{ label: string, onClick?: Function, disabled?: boolean, variant?: string, type?: string, 'aria-label'?: string }} props */
export function Button({ label, onClick, disabled, variant = 'primary', type = 'button', ...rest }) {
  const t = getTheme();
  const bg =
    variant === 'secondary'
      ? t.colors.secondary
      : variant === 'danger'
        ? t.colors.danger
        : variant === 'ghost'
          ? 'transparent'
          : t.colors.primary;
  return h(
    'button',
    {
      type,
      disabled: Boolean(disabled),
      'aria-disabled': Boolean(disabled) || undefined,
      onClick: disabled ? undefined : onClick,
      style: base({
        background: bg,
        border: variant === 'ghost' ? `1px solid ${t.colors.border}` : 'none',
        borderRadius: t.radius.md,
        padding: `${t.spacing[2]}px ${t.spacing[4]}px`,
        fontWeight: t.typography.weights.semibold,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: prefersReducedMotion() ? undefined : `background ${t.motion.fast} ${t.motion.easing}`,
      }),
      ...rest,
    },
    label,
  );
}

export function IconButton({ label, icon = '•', onClick, disabled, ...rest }) {
  return h(Button, {
    label: icon,
    'aria-label': label,
    title: label,
    onClick,
    disabled,
    variant: 'ghost',
    ...rest,
  });
}

export function Input({ label, id, value, onChange, type = 'text', placeholder, disabled, required, ...rest }) {
  const autoId = useId();
  const inputId = id || autoId;
  const t = getTheme();
  return h(
    'label',
    { htmlFor: inputId, style: base({ display: 'grid', gap: t.spacing[1] }) },
    label
      ? h('span', { style: { fontSize: t.typography.sizes.sm, color: t.colors.textMuted } }, label)
      : null,
    h('input', {
      id: inputId,
      type,
      value,
      placeholder,
      disabled,
      required,
      'aria-required': required || undefined,
      onChange: (e) => onChange?.(e.target.value, e),
      style: {
        background: t.colors.surface,
        border: `1px solid ${t.colors.border}`,
        borderRadius: t.radius.sm,
        padding: `${t.spacing[2]}px ${t.spacing[3]}px`,
        color: t.colors.text,
      },
      ...rest,
    }),
  );
}

export function Textarea(props) {
  const t = getTheme();
  const autoId = useId();
  const id = props.id || autoId;
  return h(
    'label',
    { htmlFor: id, style: base({ display: 'grid', gap: t.spacing[1] }) },
    props.label ? h('span', null, props.label) : null,
    h('textarea', {
      id,
      value: props.value,
      rows: props.rows || 4,
      disabled: props.disabled,
      onChange: (e) => props.onChange?.(e.target.value, e),
      style: {
        background: t.colors.surface,
        border: `1px solid ${t.colors.border}`,
        borderRadius: t.radius.sm,
        padding: t.spacing[3],
        color: t.colors.text,
        resize: 'vertical',
      },
    }),
  );
}

export function Select({ label, options = [], value, onChange, id, disabled }) {
  const autoId = useId();
  const selectId = id || autoId;
  const t = getTheme();
  return h(
    'label',
    { htmlFor: selectId, style: base({ display: 'grid', gap: t.spacing[1] }) },
    label ? h('span', null, label) : null,
    h(
      'select',
      {
        id: selectId,
        value,
        disabled,
        onChange: (e) => onChange?.(e.target.value, e),
        style: {
          background: t.colors.surface,
          border: `1px solid ${t.colors.border}`,
          borderRadius: t.radius.sm,
          padding: t.spacing[2],
          color: t.colors.text,
        },
      },
      options.map((o) =>
        h('option', { key: o.value, value: o.value }, o.label ?? o.value),
      ),
    ),
  );
}

export function Checkbox({ label, checked, onChange, disabled, id }) {
  const autoId = useId();
  const boxId = id || autoId;
  return h(
    'label',
    { htmlFor: boxId, style: base({ display: 'inline-flex', gap: 8, alignItems: 'center' }) },
    h('input', {
      id: boxId,
      type: 'checkbox',
      checked: Boolean(checked),
      disabled,
      onChange: (e) => onChange?.(e.target.checked, e),
    }),
    label ? h('span', null, label) : null,
  );
}

export function Tabs({ tabs = [], value, onChange }) {
  const t = getTheme();
  return h(
    'div',
    { role: 'tablist', style: base({ display: 'flex', gap: t.spacing[2] }) },
    tabs.map((tab) =>
      h(
        'button',
        {
          key: tab.id,
          role: 'tab',
          type: 'button',
          'aria-selected': value === tab.id,
          onClick: () => onChange?.(tab.id),
          style: {
            background: value === tab.id ? t.colors.surface : 'transparent',
            border: `1px solid ${t.colors.border}`,
            borderRadius: t.radius.sm,
            padding: `${t.spacing[2]}px ${t.spacing[3]}px`,
            color: t.colors.text,
            cursor: 'pointer',
          },
        },
        tab.label,
      ),
    ),
  );
}

export function Modal({ open, title, onClose, children, labelledBy }) {
  const t = getTheme();
  const titleId = useId();
  const panelRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement;
    panelRef.current?.focus?.();
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (prev && prev.focus) prev.focus();
    };
  }, [open, onClose]);
  if (!open) return null;
  return h(
    'div',
    {
      role: 'presentation',
      style: {
        position: 'fixed',
        inset: 0,
        background: t.colors.overlay,
        zIndex: t.zIndex.modal,
        display: 'grid',
        placeItems: 'center',
      },
      onClick: onClose,
    },
    h(
      'div',
      {
        role: 'dialog',
        'aria-modal': true,
        'aria-labelledby': labelledBy || titleId,
        ref: panelRef,
        tabIndex: -1,
        onClick: (e) => e.stopPropagation(),
        style: base({
          background: t.colors.bgElevated,
          borderRadius: t.radius.lg,
          padding: t.spacing[6],
          minWidth: 280,
          maxWidth: '90vw',
          boxShadow: t.shadow.lg,
        }),
      },
      title ? h('h2', { id: titleId, style: { marginTop: 0 } }, title) : null,
      children,
    ),
  );
}

export function Drawer({ open, title, onClose, children, side = 'right' }) {
  const t = getTheme();
  if (!open) return null;
  return h(
    'div',
    {
      role: 'dialog',
      'aria-modal': true,
      'aria-label': title || 'Drawer',
      style: {
        position: 'fixed',
        top: 0,
        bottom: 0,
        [side]: 0,
        width: 320,
        maxWidth: '90vw',
        background: t.colors.bgElevated,
        zIndex: t.zIndex.modal,
        boxShadow: t.shadow.lg,
        padding: t.spacing[4],
        paddingTop: `calc(${t.spacing[4]}px + ${t.safeArea.top})`,
      },
    },
    h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
      h('strong', { key: 't' }, title || ''),
      h(IconButton, { key: 'c', label: 'Close', icon: '×', onClick: onClose }),
    ]),
    children,
  );
}

export function Toast({ message, open = true, tone = 'info' }) {
  const t = getTheme();
  if (!open) return null;
  const bg =
    tone === 'success' ? t.colors.success : tone === 'danger' ? t.colors.danger : t.colors.surface;
  return h(
    'div',
    {
      role: 'status',
      'aria-live': 'polite',
      style: base({
        position: 'fixed',
        bottom: `calc(${t.spacing[4]}px + ${t.safeArea.bottom})`,
        right: t.spacing[4],
        background: bg,
        padding: t.spacing[3],
        borderRadius: t.radius.md,
        zIndex: t.zIndex.toast,
        boxShadow: t.shadow.md,
      }),
    },
    message,
  );
}

export function Avatar({ name = '?', src, size = 40 }) {
  const t = getTheme();
  const initials = String(name).slice(0, 2).toUpperCase();
  if (src) {
    return h('img', {
      src,
      alt: name,
      width: size,
      height: size,
      style: { borderRadius: t.radius.full, objectFit: 'cover', width: size, height: size },
    });
  }
  return h(
    'div',
    {
      role: 'img',
      'aria-label': name,
      style: base({
        width: size,
        height: size,
        borderRadius: t.radius.full,
        background: t.colors.secondary,
        display: 'grid',
        placeItems: 'center',
        fontSize: size * 0.35,
        fontWeight: t.typography.weights.bold,
      }),
    },
    initials,
  );
}

export function Badge({ children, tone = 'default' }) {
  const t = getTheme();
  const bg =
    tone === 'danger' ? t.colors.danger : tone === 'success' ? t.colors.success : t.colors.surface;
  return h(
    'span',
    {
      style: base({
        display: 'inline-flex',
        alignItems: 'center',
        padding: `0 ${t.spacing[2]}px`,
        minHeight: 20,
        borderRadius: t.radius.full,
        background: bg,
        fontSize: t.typography.sizes.xs,
        fontWeight: t.typography.weights.semibold,
      }),
    },
    children,
  );
}

export function Card({ children, title }) {
  const t = getTheme();
  return h(
    'section',
    {
      style: base({
        background: t.colors.surface,
        border: `1px solid ${t.colors.border}`,
        borderRadius: t.radius.lg,
        padding: t.spacing[4],
        boxShadow: t.shadow.sm,
      }),
    },
    title ? h('h3', { style: { marginTop: 0 } }, title) : null,
    children,
  );
}

export function List({ items = [], renderItem }) {
  return h(
    'ul',
    { style: base({ listStyle: 'none', margin: 0, padding: 0 }) },
    items.map((item, i) =>
      h('li', { key: item.id || i, style: { padding: '8px 0', borderBottom: `1px solid ${getTheme().colors.border}` } }, renderItem ? renderItem(item) : String(item)),
    ),
  );
}

export function EmptyState({ title = 'Nothing here', description }) {
  const t = getTheme();
  return h(
    'div',
    { role: 'status', style: base({ textAlign: 'center', padding: t.spacing[8], color: t.colors.textMuted }) },
    h('strong', { style: { display: 'block', color: t.colors.text } }, title),
    description ? h('p', null, description) : null,
  );
}

export function LoadingState({ label = 'Loading' }) {
  return h('div', { role: 'status', 'aria-live': 'polite', style: base({ padding: 16 }) }, label, '…');
}

export function AuthShell({ children, title = 'Sign in' }) {
  const t = getTheme();
  return h(
    'main',
    {
      style: base({
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: t.colors.bg,
        padding: t.spacing[6],
        paddingBottom: `calc(${t.spacing[6]}px + ${t.safeArea.bottom})`,
      }),
    },
    h(Card, { title }, children),
  );
}

export function SignInForm({ onSubmit, loading }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  return h(
    'form',
    {
      onSubmit: (e) => {
        e.preventDefault();
        onSubmit?.({ email, password });
      },
      style: { display: 'grid', gap: 12 },
    },
    h(Input, { label: 'Email', type: 'email', value: email, onChange: setEmail, required: true, autoComplete: 'username' }),
    h(Input, {
      label: 'Password',
      type: 'password',
      value: password,
      onChange: setPassword,
      required: true,
      autoComplete: 'current-password',
    }),
    h(Button, { label: loading ? 'Signing in…' : 'Sign in', type: 'submit', disabled: loading }),
  );
}

export function ConversationRow({ title, preview, unread = 0, onClick }) {
  return h(
    'button',
    {
      type: 'button',
      onClick,
      style: base({
        width: '100%',
        textAlign: 'left',
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        background: 'transparent',
        border: 'none',
        padding: 12,
        cursor: 'pointer',
      }),
    },
    h(Avatar, { name: title }),
    h('div', { style: { flex: 1 } }, [
      h('div', { key: 't', style: { fontWeight: 600 } }, title),
      h('div', { key: 'p', style: { color: getTheme().colors.textMuted, fontSize: 14 } }, preview),
    ]),
    unread > 0 ? h(Badge, { tone: 'danger' }, unread) : null,
  );
}

export function MessageBubble({ text, mine = false }) {
  const t = getTheme();
  return h(
    'div',
    {
      style: base({
        alignSelf: mine ? 'flex-end' : 'flex-start',
        background: mine ? t.colors.primary : t.colors.surface,
        padding: '8px 12px',
        borderRadius: t.radius.lg,
        maxWidth: '80%',
      }),
    },
    text,
  );
}

export function MessageComposer({ value, onChange, onSend, disabled }) {
  return h(
    'div',
    { style: base({ display: 'flex', gap: 8 }) },
    h(Input, { 'aria-label': 'Message', value, onChange, disabled }),
    h(Button, { label: 'Send', onClick: onSend, disabled }),
  );
}

export function CallControls({ muted, videoOff, onToggleMute, onToggleVideo, onHangup }) {
  return h(
    'div',
    { role: 'toolbar', 'aria-label': 'Call controls', style: base({ display: 'flex', gap: 8, justifyContent: 'center' }) },
    h(Button, { label: muted ? 'Unmute' : 'Mute', onClick: onToggleMute, variant: 'ghost' }),
    h(Button, { label: videoOff ? 'Camera on' : 'Camera off', onClick: onToggleVideo, variant: 'ghost' }),
    h(Button, { label: 'Hang up', onClick: onHangup, variant: 'danger' }),
  );
}

export function CallStatus({ status = 'idle' }) {
  return h('div', { role: 'status', style: base({ textAlign: 'center' }) }, `Call: ${status}`);
}

export function IncomingCall({ callerName, onAccept, onDecline }) {
  return h(
    Card,
    { title: 'Incoming call' },
    h('p', null, callerName || 'Unknown'),
    h('div', { style: { display: 'flex', gap: 8 } }, [
      h(Button, { key: 'a', label: 'Accept', onClick: onAccept }),
      h(Button, { key: 'd', label: 'Decline', onClick: onDecline, variant: 'danger' }),
    ]),
  );
}

export function ParticipantTile({ name, speaking }) {
  const t = getTheme();
  return h(
    'div',
    {
      style: base({
        border: speaking ? `2px solid ${t.colors.success}` : `1px solid ${t.colors.border}`,
        borderRadius: t.radius.md,
        padding: t.spacing[3],
        minHeight: 80,
        display: 'grid',
        placeItems: 'center',
        background: t.colors.bgElevated,
      }),
    },
    h(Avatar, { name }),
    h('span', null, name),
  );
}

export function LiveControlButton({ label, active, onClick }) {
  return h(Button, { label, onClick, variant: active ? 'primary' : 'ghost' });
}

export function ViewerBadge({ count = 0 }) {
  return h(Badge, null, `${count} watching`);
}

export function SeatTile({ seatNumber, occupiedBy }) {
  return h(Card, { title: `Seat ${seatNumber}` }, occupiedBy || h(EmptyState, { title: 'Empty seat' }));
}

export function GuestControls({ onRaiseHand, onLeave }) {
  return h('div', { style: base({ display: 'flex', gap: 8 }) }, [
    h(Button, { key: 'r', label: 'Raise hand', onClick: onRaiseHand, variant: 'secondary' }),
    h(Button, { key: 'l', label: 'Leave', onClick: onLeave, variant: 'ghost' }),
  ]);
}

export function PkScore({ hostScore = 0, opponentScore = 0 }) {
  return h(
    'div',
    { role: 'group', 'aria-label': 'PK score', style: base({ display: 'flex', justifyContent: 'space-between' }) },
    h('span', null, `Host ${hostScore}`),
    h('span', null, `Opp ${opponentScore}`),
  );
}

export function PkTimer({ seconds = 0 }) {
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, '0');
  return h('div', { role: 'timer', 'aria-live': 'off', style: base({ textAlign: 'center', fontWeight: 700 }) }, `${m}:${s}`);
}

export function PkParticipantTile({ name, side }) {
  return h(ParticipantTile, { name: `${side}: ${name}` });
}

export function GiftTile({ name, price, onSelect }) {
  return h(
    'button',
    {
      type: 'button',
      onClick: onSelect,
      style: base({
        border: `1px solid ${getTheme().colors.border}`,
        borderRadius: getTheme().radius.md,
        padding: 12,
        background: getTheme().colors.surface,
        cursor: 'pointer',
      }),
    },
    h('div', null, name),
    h('div', { style: { color: getTheme().colors.textMuted } }, price),
  );
}

export function GiftCombo({ count = 1 }) {
  return h(Badge, { tone: 'danger' }, `x${count}`);
}

export function GiftPanel({ gifts = [], onSelect }) {
  return h(
    'div',
    { role: 'list', 'aria-label': 'Gifts', style: base({ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }) },
    gifts.map((g) => h(GiftTile, { key: g.id, name: g.name, price: g.price, onSelect: () => onSelect?.(g) })),
  );
}

export function EffectTile({ name, active, onSelect }) {
  return h(Button, { label: name, onClick: onSelect, variant: active ? 'primary' : 'ghost' });
}

export function Slider({ label, value, min = 0, max = 100, onChange, id }) {
  const autoId = useId();
  const sliderId = id || autoId;
  return h(
    'label',
    { htmlFor: sliderId, style: base({ display: 'grid', gap: 4 }) },
    label ? h('span', null, label) : null,
    h('input', {
      id: sliderId,
      type: 'range',
      min,
      max,
      value,
      onChange: (e) => onChange?.(Number(e.target.value), e),
      'aria-valuemin': min,
      'aria-valuemax': max,
      'aria-valuenow': value,
    }),
  );
}

export function ProductCard({ title, price, image, onAdd }) {
  return h(Card, null, [
    image ? h('img', { key: 'i', src: image, alt: title, style: { width: '100%', borderRadius: 8 } }) : null,
    h('h3', { key: 't' }, title),
    h(Price, { key: 'p', amount: price }),
    h(Button, { key: 'a', label: 'Add to cart', onClick: onAdd }),
  ]);
}

export function Price({ amount, currency = 'USD' }) {
  const text = typeof amount === 'number' ? new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount) : String(amount);
  return h('span', { style: base({ fontWeight: 700 }) }, text);
}

export function CartLine({ title, quantity, price }) {
  return h(
    'div',
    { style: base({ display: 'flex', justifyContent: 'space-between', gap: 8 }) },
    h('span', null, `${title} × ${quantity}`),
    h(Price, { amount: price }),
  );
}

export function OrderStatus({ status = 'pending' }) {
  return h(Badge, { tone: status === 'paid' ? 'success' : 'default' }, status);
}

export function CheckoutSummary({ lines = [], total }) {
  return h(Card, { title: 'Checkout' }, [
    ...lines.map((l, i) => h(CartLine, { key: l.id || i, ...l })),
    h('div', { key: 'total', style: { marginTop: 12, fontWeight: 700 } }, ['Total ', h(Price, { amount: total })]),
  ]);
}

export { focusRing };
