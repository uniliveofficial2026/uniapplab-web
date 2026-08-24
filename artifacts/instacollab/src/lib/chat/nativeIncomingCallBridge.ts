/**
 * Production-path scaffolding for native incoming calls.
 *
 * Assessment (Capacitor WebView under artifacts/instacollab/ios|android):
 * - iOS CallKit / PushKit: NOT PRESENT (UIBackgroundModes = audio only)
 * - Android Telecom / ConnectionService: NOT PRESENT
 * - Android mic/camera foreground service: NOT PRESENT
 *
 * Verdict: required for reliable background/killed-state incoming calls on store
 * builds. Foreground in-app + browser Notification paths remain the only live path.
 *
 * This module never reports success when the native bridge is disabled or missing.
 * Do not declare VoIP / FGS entitlements until a real implementation + certs exist.
 */

export type NativeIncomingCallPlatform = 'ios' | 'android' | 'web';

export type NativeIncomingCallCapability =
  | 'callkit'
  | 'pushkit'
  | 'telecom'
  | 'foreground_service_mic'
  | 'foreground_service_camera'
  | 'in_app_ring';

export type NativeIncomingCallFeatureFlags = {
  /**
   * Master gate. Remains false until CallKit/PushKit (iOS) and FGS/Telecom
   * (Android) are implemented, certificated, and device-tested.
   */
  nativeIncomingCallBridge: boolean;
  /** Present system UI via CallKit (iOS) when bridge is ready. */
  iosCallKit: boolean;
  /** VoIP push via PushKit (iOS) — requires Apple VoIP cert. */
  iosPushKit: boolean;
  /** ConnectionService / Telecom (Android). */
  androidTelecom: boolean;
  /** microphone|camera foreground service while call is active (Android 14+). */
  androidCallForegroundService: boolean;
};

export type NativeIncomingCallReadiness = {
  platform: NativeIncomingCallPlatform;
  /** True only when feature flags allow AND native stub reports ready. Never faked. */
  ready: boolean;
  featureFlags: NativeIncomingCallFeatureFlags;
  missing: NativeIncomingCallCapability[];
  blockers: string[];
  notes: string;
};

export type NativeIncomingCallPresentRequest = {
  callId: string;
  chatId: string;
  fromUserId: string;
  callKind: 'audio' | 'video';
  callerDisplayName?: string;
};

export type NativeIncomingCallPresentResult = {
  accepted: boolean;
  reason: string;
};

const DEFAULT_FLAGS: NativeIncomingCallFeatureFlags = {
  nativeIncomingCallBridge: false,
  iosCallKit: false,
  iosPushKit: false,
  androidTelecom: false,
  androidCallForegroundService: false,
};

let flags: NativeIncomingCallFeatureFlags = { ...DEFAULT_FLAGS };

function detectPlatform(): NativeIncomingCallPlatform {
  if (typeof window === 'undefined') return 'web';
  const cap = (window as Window & {
    Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
  }).Capacitor;
  const native =
    Boolean(cap?.isNativePlatform?.()) ||
    window.location.protocol === 'capacitor:' ||
    window.location.protocol === 'ionic:';
  if (!native) return 'web';
  const p = String(cap?.getPlatform?.() ?? '').toLowerCase();
  if (p === 'ios') return 'ios';
  if (p === 'android') return 'android';
  return 'web';
}

export function getNativeIncomingCallFeatureFlags(): NativeIncomingCallFeatureFlags {
  return { ...flags };
}

export function setNativeIncomingCallFeatureFlags(
  patch: Partial<NativeIncomingCallFeatureFlags>,
): NativeIncomingCallFeatureFlags {
  flags = { ...flags, ...patch };
  return getNativeIncomingCallFeatureFlags();
}

export function resetNativeIncomingCallFeatureFlags(): void {
  flags = { ...DEFAULT_FLAGS };
}

function readEnvFlag(name: string): boolean {
  try {
    const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
    const raw = env?.[name];
    if (raw == null) return false;
    return raw === '1' || raw.toLowerCase() === 'true';
  } catch {
    return false;
  }
}

/** Merge compile-time env into runtime flags (still defaults to off). */
export function hydrateNativeIncomingCallFlagsFromEnv(): NativeIncomingCallFeatureFlags {
  return setNativeIncomingCallFeatureFlags({
    nativeIncomingCallBridge: readEnvFlag('VITE_NATIVE_INCOMING_CALL_BRIDGE'),
    iosCallKit: readEnvFlag('VITE_NATIVE_IOS_CALLKIT'),
    iosPushKit: readEnvFlag('VITE_NATIVE_IOS_PUSHKIT'),
    androidTelecom: readEnvFlag('VITE_NATIVE_ANDROID_TELECOM'),
    androidCallForegroundService: readEnvFlag('VITE_NATIVE_ANDROID_CALL_FGS'),
  });
}

/**
 * Probe native plugin if present. Capacitor stubs must return ready:false until
 * real CallKit/Telecom wiring ships — never invent success.
 */
function probeNativePluginReady(): { present: boolean; ready: boolean; detail: string } {
  if (typeof window === 'undefined') {
    return { present: false, ready: false, detail: 'ssr' };
  }
  const cap = (
    window as Window & {
      Capacitor?: {
        Plugins?: {
          UniLiveIncomingCall?: {
            getReadiness?: () => Promise<{ ready?: boolean } | boolean> | { ready?: boolean } | boolean;
          };
        };
      };
    }
  ).Capacitor;
  const plugin = cap?.Plugins?.UniLiveIncomingCall;
  if (!plugin) {
    return { present: false, ready: false, detail: 'plugin_absent' };
  }
  try {
    const sync = plugin.getReadiness?.();
    if (sync && typeof sync === 'object' && 'then' in sync) {
      return { present: true, ready: false, detail: 'plugin_async_pending' };
    }
    if (typeof sync === 'boolean') {
      return { present: true, ready: sync, detail: sync ? 'plugin_ready' : 'plugin_not_ready' };
    }
    if (sync && typeof sync === 'object' && 'ready' in sync) {
      return {
        present: true,
        ready: Boolean(sync.ready),
        detail: sync.ready ? 'plugin_ready' : 'plugin_not_ready',
      };
    }
  } catch {
    return { present: true, ready: false, detail: 'plugin_probe_error' };
  }
  return { present: true, ready: false, detail: 'plugin_no_readiness_api' };
}

export function assessNativeIncomingCallReadiness(
  platformOverride?: NativeIncomingCallPlatform,
): NativeIncomingCallReadiness {
  const platform: NativeIncomingCallPlatform = platformOverride ?? detectPlatform();
  const featureFlags = getNativeIncomingCallFeatureFlags();
  const missing: NativeIncomingCallCapability[] = [];
  const blockers: string[] = [];

  if (platform === 'web') {
    return {
      platform,
      ready: false,
      featureFlags,
      missing: ['callkit', 'pushkit', 'telecom', 'foreground_service_mic', 'foreground_service_camera'],
      blockers: ['web_uses_in_app_and_browser_notifications_only'],
      notes: 'Native CallKit/Telecom not applicable on web; in-app ring remains active.',
    };
  }

  const probe = probeNativePluginReady();

  if (platform === 'ios') {
    if (!featureFlags.iosCallKit || !probe.ready) missing.push('callkit');
    if (!featureFlags.iosPushKit || !probe.ready) missing.push('pushkit');
    if (!featureFlags.nativeIncomingCallBridge) {
      blockers.push('feature_flag_nativeIncomingCallBridge_false');
    }
    if (!probe.present) blockers.push('capacitor_plugin_UniLiveIncomingCall_absent');
    if (probe.present && !probe.ready) blockers.push(probe.detail);
    blockers.push('apple_voip_push_certificate_required');
    blockers.push('physical_device_callkit_verification_required');
  } else if (platform === 'android') {
    if (!featureFlags.androidTelecom || !probe.ready) missing.push('telecom');
    if (!featureFlags.androidCallForegroundService || !probe.ready) {
      missing.push('foreground_service_mic', 'foreground_service_camera');
    }
    if (!featureFlags.nativeIncomingCallBridge) {
      blockers.push('feature_flag_nativeIncomingCallBridge_false');
    }
    if (!probe.present) blockers.push('capacitor_plugin_UniLiveIncomingCall_absent');
    if (probe.present && !probe.ready) blockers.push(probe.detail);
    blockers.push('android_fgs_types_microphone_camera_declaration_required');
    blockers.push('physical_device_telecom_verification_required');
  }

  const ready =
    featureFlags.nativeIncomingCallBridge &&
    probe.ready &&
    ((platform === 'ios' && featureFlags.iosCallKit && featureFlags.iosPushKit) ||
      (platform === 'android' &&
        featureFlags.androidTelecom &&
        featureFlags.androidCallForegroundService));

  return {
    platform,
    ready,
    featureFlags,
    missing: [...new Set(missing)],
    blockers,
    notes: ready
      ? 'Native incoming-call bridge ready.'
      : 'Native incoming calls not production-ready; use in-app/browser notify path only.',
  };
}

/**
 * Attempt native system incoming UI. Always returns accepted:false when not ready.
 * Callers must keep the existing in-app ring path.
 */
export function tryPresentNativeIncomingCall(
  request: NativeIncomingCallPresentRequest,
): NativeIncomingCallPresentResult {
  const readiness = assessNativeIncomingCallReadiness();
  if (!request.callId?.trim() || !request.chatId?.trim() || !request.fromUserId?.trim()) {
    return { accepted: false, reason: 'invalid_request' };
  }
  if (!readiness.ready) {
    return {
      accepted: false,
      reason: readiness.blockers[0] || 'native_incoming_call_not_ready',
    };
  }
  // Real Capacitor plugin invoke lands here in a later slice. Never claim success without it.
  return { accepted: false, reason: 'native_plugin_invoke_not_implemented' };
}

export function isNativeIncomingCallRequiredForProductionStore(): boolean {
  return true;
}
