import { isStandaloneDisplayMode } from './pwaRegister';

export type RuntimeOs = 'ios' | 'android' | 'mac' | 'windows' | 'linux' | 'unknown';
export type RuntimeForm = 'phone' | 'tablet' | 'desktop';
export type RuntimeShell = 'pwa' | 'browser';

export type RuntimePlatform = {
  os: RuntimeOs;
  form: RuntimeForm;
  shell: RuntimeShell;
  touch: boolean;
  label: string;
};

function detectOs(ua: string): RuntimeOs {
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'mac';
  if (/Windows/i.test(ua)) return 'windows';
  if (/Linux/i.test(ua)) return 'linux';
  return 'unknown';
}

function detectForm(ua: string, width: number): RuntimeForm {
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (width >= 768 && 'ontouchstart' in window)) {
    return 'tablet';
  }
  if (width < 768 || /iPhone|iPod|Android.*Mobile/i.test(ua)) return 'phone';
  return 'desktop';
}

/** Cross-platform runtime hint for telemetry + ML handoff (web, PWA, iOS, Android, desktop). */
export function getRuntimePlatform(): RuntimePlatform {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return { os: 'unknown', form: 'desktop', shell: 'browser', touch: false, label: 'unknown' };
  }

  const ua = navigator.userAgent;
  const width = window.innerWidth;
  const os = detectOs(ua);
  const form = detectForm(ua, width);
  const shell: RuntimeShell = isStandaloneDisplayMode() ? 'pwa' : 'browser';
  const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const label = `${shell}_${os}_${form}`;

  return { os, form, shell, touch, label };
}

export function platformMetaForTelemetry(): Record<string, string | boolean> {
  const p = getRuntimePlatform();
  return {
    platform: p.label,
    os: p.os,
    form: p.form,
    shell: p.shell,
    touch: p.touch,
  };
}
