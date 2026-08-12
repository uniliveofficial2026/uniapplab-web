import React from 'react';

type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onBackToWelcome?: () => void;
  backLabel?: string;
  /** Visual tone for the princess email sheet (signup matches ornate auth UI). */
  mode?: 'login' | 'signup' | 'forgot' | 'reset';
};

/** Lower panel for email / recovery forms over the locked princess stage. */
export function UniLivesPrincessAuthPanel({
  title,
  subtitle,
  children,
  onBackToWelcome,
  backLabel = 'Back',
  mode = 'signup',
}: Props) {
  return (
    <div
      className="upa-panel-card"
      data-unilives-princess-panel=""
      data-panel-mode={mode === 'signup' ? 'signup' : mode}
    >
      <h2 className="upa-panel-title">{title}</h2>
      {subtitle ? <p className="upa-panel-sub">{subtitle}</p> : null}
      {children}
      {onBackToWelcome ? (
        <button type="button" className="upa-back" onClick={onBackToWelcome}>
          {backLabel}
        </button>
      ) : null}
    </div>
  );
}
