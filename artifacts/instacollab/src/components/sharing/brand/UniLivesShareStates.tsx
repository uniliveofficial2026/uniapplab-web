import React from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { UniLivesSharingMedia } from './UniLivesSharingMedia';

export function UniLivesShareLoadingState({
  className = '',
  label = 'Preparing share…',
}: {
  className?: string;
  label?: string;
}) {
  return (
    <div className={`flex items-center gap-2 text-sm text-muted-foreground ${className}`} role="status" aria-live="polite" data-unilives-share-loading="">
      <UniLivesSharingMedia kind="loading" legacyNode={<Loader2 className="w-4 h-4 animate-spin" aria-hidden />} imgClassName="w-4 h-4" decorative />
      <span>{label}</span>
    </div>
  );
}

export function UniLivesShareSuccessState({
  className = '',
  label = 'Copied',
}: {
  className?: string;
  label?: string;
}) {
  return (
    <div className={`flex items-center gap-1.5 text-sm font-bold ${className}`} role="status" aria-live="polite" data-unilives-share-success="">
      <UniLivesSharingMedia kind="success" legacyNode={<CheckCircle2 className="w-3.5 h-3.5" aria-hidden />} imgClassName="w-3.5 h-3.5" decorative />
      <span>{label}</span>
    </div>
  );
}

export function UniLivesShareErrorState({
  className = '',
  message = 'Share failed',
}: {
  className?: string;
  message?: string;
}) {
  return (
    <div className={`flex items-center gap-2 text-sm text-destructive ${className}`} role="alert" data-unilives-share-error="">
      <UniLivesSharingMedia kind="error" legacyNode={<AlertCircle className="w-4 h-4" aria-hidden />} imgClassName="w-4 h-4" decorative />
      <span>{message}</span>
    </div>
  );
}
