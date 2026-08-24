import React from 'react';
import { useOptionalI18n } from '../../lib/i18n';

export type LiveLifecycleConfirmKind = 'leave' | 'end';

export function LiveLifecycleConfirmOverlay({
  open,
  kind,
  confirmationKey,
  pending,
  pkActive,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  kind: LiveLifecycleConfirmKind;
  confirmationKey: string;
  pending: boolean;
  pkActive?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const i18n = useOptionalI18n();
  const t = (key: string) => i18n?.t(key) ?? key;
  if (!open) return null;
  const title = kind === 'end' ? t('live.endLive') : t('common.leaveRoom');
  const body =
    kind === 'end'
      ? t(pkActive ? 'live.end.confirm.pk' : 'live.end.confirm')
      : t(confirmationKey || 'live.leave.confirm.viewer');
  return (
    <div className="pointer-events-auto fixed inset-0 z-[240] flex items-end justify-center p-4 sm:items-center" data-node-id={kind === 'end' ? 'node.live.host.end-live-confirmation' : 'node.live.shared.leave-confirmation'}>
      <button type="button" className="absolute inset-0 bg-black/60" aria-label={t('common.cancel')} onClick={pending ? undefined : onCancel} />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#120818]/95 p-4 text-gray-100 shadow-2xl">
        <h2 className="text-base font-black">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/80">{body}</p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={onCancel}
            className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm font-semibold text-white/90 hover:bg-white/5 disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onConfirm}
            className={`flex-1 rounded-xl py-2.5 text-sm font-black text-white disabled:opacity-50 ${kind === 'end' ? 'bg-red-600 hover:bg-red-500' : 'bg-purple-600 hover:bg-purple-500'}`}
          >
            {pending ? t('common.loading') : kind === 'end' ? t('live.endLive') : t('common.leaveRoom')}
          </button>
        </div>
      </div>
    </div>
  );
}
