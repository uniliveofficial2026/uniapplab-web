package com.uniapplab.unilive.call

/**
 * Scaffold only — not registered as Telecom ConnectionService or FGS.
 * Keep FEATURE_ENABLED false until certificates, Play FGS types, and device QA pass.
 * JS bridge: artifacts/instacollab/src/lib/chat/nativeIncomingCallBridge.ts
 */
object IncomingCallBridgeStub {
  const val FEATURE_ENABLED: Boolean = false

  fun isProductionReady(): Boolean = false

  /**
   * Never return true until a real ConnectionService + FGS path is wired and flagged on.
   */
  fun presentIncomingCall(
    callId: String,
    callerDisplayName: String,
    isVideo: Boolean,
  ): Boolean {
    if (!FEATURE_ENABLED) return false
    if (callId.isBlank()) return false
    // Real Telecom / FGS path not implemented.
    return false
  }
}
