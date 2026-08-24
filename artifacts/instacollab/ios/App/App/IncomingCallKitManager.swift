import UIKit
import CallKit

/**
 * CallKit reporter for UniLive’s Capacitor shell.
 *
 * - Does NOT enable PushKit / voip UIBackgroundModes (blocked until Apple VoIP cert).
 * - CXProvider is created lazily only when FEATURE_ENABLED is true.
 * - Default FEATURE_ENABLED = false — fail closed until device QA.
 *
 * Wire from Capacitor plugin when nativeIncomingCallBridge flags turn on.
 */
@objc final class IncomingCallKitManager: NSObject, CXProviderDelegate {
  @objc static let shared = IncomingCallKitManager()

  /// Keep false until CallKit device QA + entitlements are verified.
  @objc static var FEATURE_ENABLED: Bool = false

  private var provider: CXProvider?
  private let controller = CXCallController()

  @objc func isReady() -> Bool {
    return IncomingCallKitManager.FEATURE_ENABLED
  }

  @objc func presentIncomingCall(
    callId: String,
    callerDisplayName: String,
    isVideo: Bool
  ) -> Bool {
    guard IncomingCallKitManager.FEATURE_ENABLED else { return false }
    guard !callId.isEmpty else { return false }
    ensureProvider()
    guard let provider else { return false }

    let update = CXCallUpdate()
    update.remoteHandle = CXHandle(type: .generic, value: callerDisplayName.isEmpty ? "UniLive’s" : callerDisplayName)
    update.hasVideo = isVideo
    update.localizedCallerName = callerDisplayName

    let uuid = UUID(uuidString: callId) ?? UUID()
    provider.reportNewIncomingCall(with: uuid, update: update) { error in
      _ = error
    }
    return true
  }

  private func ensureProvider() {
    if provider != nil { return }
    let config = CXProviderConfiguration(localizedName: "UniLive’s")
    config.supportsVideo = true
    config.maximumCallsPerCallGroup = 1
    config.supportedHandleTypes = [.generic]
    let cx = CXProvider(configuration: config)
    cx.setDelegate(self, queue: nil)
    provider = cx
  }

  func providerDidReset(_ provider: CXProvider) {}
}
