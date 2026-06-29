import React from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';

export function RoomSettingsShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="smule-room-settings-shell h-full flex flex-col text-foreground pb-8">
      {children}
    </div>
  );
}

export function RoomSettingsHeader({
  title,
  subtitle,
  onBack,
  rightAction,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  rightAction?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 flex items-center border-b border-border bg-background/70 backdrop-blur-xl px-4 py-4">
      <button
        type="button"
        onClick={onBack}
        className="absolute left-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-card/60 text-foreground backdrop-blur-md transition hover:bg-secondary/80"
        aria-label="Go back"
      >
        <ArrowLeft size={20} />
      </button>
      <div className="w-full text-center">
        <h1 className="text-lg font-bold tracking-tight truncate px-12">{title}</h1>
        {subtitle ? (
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate px-12">
            {subtitle}
          </p>
        ) : null}
      </div>
      {rightAction ? <div className="absolute right-4 z-10">{rightAction}</div> : null}
    </header>
  );
}

export function RoomSettingsScroll({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 space-y-6 overflow-y-auto px-4 pb-[10px] pt-[10px] scrollbar-hide">
      {children}
    </div>
  );
}

export function RoomSettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 px-1 text-sm font-extrabold uppercase tracking-tight text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function RoomSettingsGlassCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-[24px] border border-border bg-card/75 shadow-lg backdrop-blur-xl ${className}`}
    >
      {children}
    </div>
  );
}

export function RoomSettingsHeroCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-[24px] border border-border bg-card/60 p-5 shadow-xl backdrop-blur-2xl">
      <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-6 h-32 w-32 rounded-full bg-accent/10 blur-3xl" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export function RoomSettingsDetailRow({
  label,
  subtitle,
  value,
  hasArrow = true,
}: {
  label: string;
  subtitle?: string;
  value?: React.ReactNode;
  hasArrow?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 bg-transparent p-4 last:border-0">
      <div className="min-w-0">
        <span className="block text-sm font-bold text-foreground">{label}</span>
        {subtitle ? (
          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{subtitle}</span>
        ) : null}
      </div>
      <div className="ml-3 flex shrink-0 items-center text-muted-foreground">
        {value ? <div className="mr-2">{value}</div> : null}
        {hasArrow ? <ChevronRight size={18} className="text-muted-foreground/60" /> : null}
      </div>
    </div>
  );
}

export function RoomSettingsEditRow({
  label,
  value,
  onClick,
  hasArrow = true,
}: {
  label: string;
  value?: React.ReactNode;
  onClick?: () => void;
  hasArrow?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between border-b border-border/60 bg-transparent p-4 text-left transition last:border-0 hover:bg-secondary/40"
    >
      <span className="font-medium text-foreground">{label}</span>
      <div className="flex items-center text-muted-foreground">
        {value ? (
          <span
            className={`mr-2 max-w-[10rem] truncate text-sm ${
              typeof value === 'string' && (value === 'Not set' || value.startsWith('No '))
                ? 'text-muted-foreground/70 italic'
                : 'text-muted-foreground'
            }`}
          >
            {value}
          </span>
        ) : null}
        {hasArrow ? <ChevronRight size={20} className="text-muted-foreground/60" /> : null}
      </div>
    </button>
  );
}

export function RoomSettingsProgressTrack({
  value,
  className = 'bg-primary',
}: {
  value: number;
  className?: string;
}) {
  return (
    <div className="h-[5px] overflow-hidden rounded-full bg-secondary/70 shadow-inner backdrop-blur-sm">
      <div
        className={`h-full rounded-full transition-all duration-500 ${className}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export function RoomSettingsMiniProgressTrack({
  value,
  className = 'bg-primary',
}: {
  value: number;
  className?: string;
}) {
  return (
    <div className="h-1 overflow-hidden rounded-full bg-secondary/70 shadow-inner backdrop-blur-sm">
      <div
        className={`h-full rounded-full transition-all duration-500 ${className}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export function RoomSettingsPill({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-background/50 px-2.5 py-1 shadow-sm backdrop-blur-md ${className}`}
    >
      {children}
    </div>
  );
}
