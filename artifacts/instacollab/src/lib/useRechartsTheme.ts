import { useMemo } from 'react';
import { useDB } from './useDB';

/** Resolved colors for Recharts — SVG attrs cannot use hsl(var(--token)). */
export type RechartsTheme = {
  grid: string;
  tick: string;
  series: string;
  seriesFillTop: string;
  seriesFillBottom: string;
  previous: string;
  previousFillTop: string;
  previousFillBottom: string;
  cursor: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipFg: string;
  tooltipMuted: string;
  dotStroke: string;
  barFill: string;
};

export function getRechartsTheme(isDark: boolean): RechartsTheme {
  return isDark
    ? {
        grid: 'rgba(255, 255, 255, 0.14)',
        tick: 'rgba(255, 255, 255, 0.72)',
        series: 'rgba(255, 255, 255, 0.95)',
        seriesFillTop: 'rgba(255, 255, 255, 0.38)',
        seriesFillBottom: 'rgba(255, 255, 255, 0)',
        previous: 'rgba(255, 255, 255, 0.45)',
        previousFillTop: 'rgba(255, 255, 255, 0.14)',
        previousFillBottom: 'rgba(255, 255, 255, 0)',
        cursor: 'rgba(255, 255, 255, 0.1)',
        tooltipBg: 'rgba(15, 23, 42, 0.94)',
        tooltipBorder: 'rgba(255, 255, 255, 0.22)',
        tooltipFg: '#f8fafc',
        tooltipMuted: 'rgba(248, 250, 252, 0.65)',
        dotStroke: '#020617',
        barFill: '#3b82f6',
      }
    : {
        grid: 'rgba(15, 23, 42, 0.12)',
        tick: '#475569',
        series: '#2563eb',
        seriesFillTop: 'rgba(37, 99, 235, 0.45)',
        seriesFillBottom: 'rgba(37, 99, 235, 0)',
        previous: '#64748b',
        previousFillTop: 'rgba(100, 116, 139, 0.28)',
        previousFillBottom: 'rgba(100, 116, 139, 0)',
        cursor: 'rgba(15, 23, 42, 0.06)',
        tooltipBg: 'rgba(255, 255, 255, 0.96)',
        tooltipBorder: 'rgba(15, 23, 42, 0.12)',
        tooltipFg: '#0f172a',
        tooltipMuted: '#64748b',
        dotStroke: '#f8fafc',
        barFill: '#2563eb',
      };
}

export function useRechartsTheme(): RechartsTheme {
  const db = useDB();
  const isDark = db.settings.theme === 'dark';
  return useMemo(() => getRechartsTheme(isDark), [isDark]);
}

export function rechartsTooltipProps(theme: RechartsTheme) {
  return {
    cursor: { fill: theme.cursor, opacity: 1 },
    contentStyle: {
      backgroundColor: theme.tooltipBg,
      border: `1px solid ${theme.tooltipBorder}`,
      borderRadius: '16px',
      color: theme.tooltipFg,
      fontSize: '11px',
      fontWeight: 'bold' as const,
      boxShadow: '0 12px 24px -8px rgba(0, 0, 0, 0.25)',
      padding: '10px 14px',
    },
    itemStyle: { color: theme.tooltipFg, fontWeight: 'bold' as const },
    labelStyle: {
      color: theme.tooltipMuted,
      fontWeight: 'bold' as const,
      marginBottom: '6px',
      fontSize: '10px',
    },
  };
}
