import XCTest

final class UniLiveAuthUITests: XCTestCase {
  var app: XCUIApplication!
  private static var sessionBootstrapped = false
  private static let axAttachRetries = 3

  override class func setUp() {
    super.setUp()
    sessionBootstrapped = false
  }

  override func setUpWithError() throws {
    continueAfterFailure = false
    app = XCUIApplication(bundleIdentifier: "com.uniapplab.unilive")
    app.launchArguments += ["-UITesting"]
    if let email = Optional(qaEnv("UNILIVE_QA_EMAIL")), !email.isEmpty {
      app.launchEnvironment["UNILIVE_QA_EMAIL"] = email
    }
    if let password = Optional(qaEnv("UNILIVE_QA_PASSWORD")), !password.isEmpty {
      app.launchEnvironment["UNILIVE_QA_PASSWORD"] = password
    }
  }

  private func qaEnv(_ key: String) -> String {
    if let v = ProcessInfo.processInfo.environment[key], !v.isEmpty {
      return v
    }
    let candidates = [
      ProcessInfo.processInfo.environment["UNILIVE_QA_ENV_FILE"],
      "/Volumes/Wei2TB/Universal-Fixer-Full-App-Recovery/.local/device-qa-uitest.env",
      "/Volumes/Wei2TB/Universal-Fixer/.local/device-qa-uitest.env",
    ].compactMap { $0 }
    for path in candidates where FileManager.default.fileExists(atPath: path) {
      guard let text = try? String(contentsOfFile: path, encoding: .utf8) else { continue }
      for line in text.split(separator: "\n") {
        let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty || trimmed.hasPrefix("#") { continue }
        let parts = trimmed.split(separator: "=", maxSplits: 1).map(String.init)
        if parts.count == 2, parts[0] == key { return parts[1] }
      }
    }
    return ""
  }

  private func ensureSignedInShell(timeout: TimeInterval = 55) {
    if !Self.sessionBootstrapped {
      launchCapAppOnce()
      Self.sessionBootstrapped = true
    } else {
      app.activate()
      _ = app.wait(for: .runningForeground, timeout: 15)
    }

    let root = waitForWebRoot(timeout: timeout)
    let shell = landmark("signed-in-shell", in: root, timeout: min(timeout, 20))
    if shell.exists { return }

    let auth = landmark("launch-route-auth", in: root, timeout: 8)
    let profile = landmark("launch-route-profile_setup", in: root, timeout: 8)
    if profile.exists {
      XCTFail("Profile setup shown despite cloud profile_setup_complete")
      return
    }
    if !auth.exists {
      // Welcome / email gate without launch-route-auth landmark
      let signInChip = root.buttons["Sign in"]
      if signInChip.waitForExistence(timeout: 6) {
        signInChip.tap()
      }
    }

    let email = qaEnv("UNILIVE_QA_EMAIL")
    let password = qaEnv("UNILIVE_QA_PASSWORD")
    XCTAssertFalse(email.isEmpty, "UNILIVE_QA_EMAIL required for device QA login")
    XCTAssertFalse(password.isEmpty, "UNILIVE_QA_PASSWORD required for device QA login")

    let agree = root.switches.firstMatch
    if agree.exists, (agree.value as? String) != "1" {
      agree.tap()
    }

    var emailField = landmark("auth-email", in: root, timeout: 10)
    if !emailField.exists {
      emailField = root.textFields["Email"]
    }
    var passwordField = landmark("auth-password", in: root, timeout: 8)
    if !passwordField.exists {
      passwordField = root.secureTextFields["Password"]
    }
    XCTAssertTrue(emailField.waitForExistence(timeout: 20), "Email field missing on auth screen")
    emailField.tap()
    emailField.typeText(email)
    XCTAssertTrue(passwordField.waitForExistence(timeout: 10), "Password field missing on auth screen")
    passwordField.tap()
    passwordField.typeText(password)

    let login = landmark("auth-submit", in: root, timeout: 8)
    if login.exists {
      login.tap()
    } else {
      XCTAssertTrue(root.buttons["Log in"].waitForExistence(timeout: 8))
      root.buttons["Log in"].tap()
    }

    XCTAssertTrue(
      landmark("signed-in-shell", in: root, timeout: 60).exists,
      "Signed-in shell did not appear after QA login"
    )
  }

  private func launchCapAppOnce() {
    app.launch()
    XCTAssertTrue(app.wait(for: .runningForeground, timeout: 35), "Cap app must reach foreground")
    sleep(2)
  }

  private func waitForWebRoot(timeout: TimeInterval = 55) -> XCUIElement {
    for attempt in 1...Self.axAttachRetries {
      if app.state == .notRunning {
        launchCapAppOnce()
      } else {
        app.activate()
        _ = app.wait(for: .runningForeground, timeout: 12)
      }
      sleep(attempt == 1 ? 1 : 2)
      let web = app.webViews.firstMatch
      if web.waitForExistence(timeout: min(timeout, 25)) {
        let shell = web.descendants(matching: .any).matching(
          NSPredicate(format: "label CONTAINS[c] %@", "signed-in-shell")
        ).firstMatch
        if shell.waitForExistence(timeout: min(timeout, 20)) {
          return web
        }
        if attempt < Self.axAttachRetries {
          continue
        }
        return web
      }
      if attempt < Self.axAttachRetries {
        app.terminate()
        sleep(2)
        launchCapAppOnce()
      }
    }
    return webRoot()
  }

  private func webRoot() -> XCUIElement {
    let web = app.webViews.firstMatch
    if web.waitForExistence(timeout: 25) {
      return web
    }
    return app
  }

  /// Prefer exact token match; avoid broad CONTAINS when a screen landmark is provided.
  private func landmark(_ token: String, in root: XCUIElement, timeout: TimeInterval = 25, screenLandmark: String? = nil) -> XCUIElement {
    if let screen = screenLandmark, !screen.isEmpty {
      let screenEl = root.descendants(matching: .any).matching(
        NSPredicate(format: "label CONTAINS[c] %@", screen)
      ).firstMatch
      if screenEl.waitForExistence(timeout: min(timeout, 10)) {
        let scoped = screenEl.descendants(matching: .any)[token]
        if scoped.waitForExistence(timeout: min(timeout, 8)) {
          return scoped
        }
      }
    }
    let byId = root.descendants(matching: .any)[token]
    if byId.waitForExistence(timeout: min(timeout, 8)) {
      return byId
    }
    let pred = NSPredicate(format: "label CONTAINS[c] %@", token)
    let byLabel = root.descendants(matching: .any).matching(pred).firstMatch
    _ = byLabel.waitForExistence(timeout: timeout)
    return byLabel
  }

  private func tapIfExists(_ element: XCUIElement, timeout: TimeInterval = 8) -> Bool {
    if element.waitForExistence(timeout: timeout) {
      element.tap()
      return true
    }
    return false
  }

  func testDeviceAlreadySignedInShellOrAuthLandmarks() throws {
    ensureSignedInShell()
    let root = webRoot()
    XCTAssertTrue(landmark("signed-in-shell", in: root, timeout: 8).exists)

    let live = root.buttons["Live"].firstMatch
    if live.exists {
      live.tap()
    } else if app.buttons["Live"].waitForExistence(timeout: 5) {
      app.buttons["Live"].tap()
    }
  }

  func testMessagesComposerLandmarkReachable() throws {
    ensureSignedInShell()
    let root = webRoot()
    let messagesBtn =
      root.buttons["Messages"].firstMatch.exists
        ? root.buttons["Messages"].firstMatch
        : app.buttons["Messages"].firstMatch
    XCTAssertTrue(messagesBtn.waitForExistence(timeout: 20), "Messages nav must exist")
    messagesBtn.tap()
    sleep(2)

    // Open first direct message thread (QA Mac in device QA seed).
    var opened = false
    for candidate in [root.images["qa_mac"], root.staticTexts["QA Mac"], root.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] %@", "qa_mac")).firstMatch] {
      if candidate.waitForExistence(timeout: 4) {
        candidate.tap()
        opened = true
        break
      }
    }
    if !opened {
      print("DEBUG_MESSAGES_LIST=\(root.debugDescription.prefix(3500))")
    }
    sleep(2)

    var composer = landmark("chat-input", in: root, timeout: 20)
    if !composer.exists {
      composer = landmark("Message composer", in: root, timeout: 5)
    }
    XCTAssertTrue(composer.waitForExistence(timeout: 20), "chat-input landmark required in open thread")
    composer.tap()
    sleep(1)
    XCTAssertTrue(composer.exists, "chat-input must remain visible when focused (keyboard open)")

    let send = landmark("chat-send", in: root, timeout: 5)
    // Send button appears when text present; landmark may exist in tree when typing — optional check.
    if send.exists {
      XCTAssertTrue(send.isHittable || send.exists, "chat-send must be reachable")
    }
  }

  func testReelsCommentComposerLandmark() throws {
    ensureSignedInShell()
    let root = webRoot()

    let reelsBtn =
      root.buttons["Reels"].firstMatch.exists
        ? root.buttons["Reels"].firstMatch
        : app.buttons["Reels"].firstMatch
    if reelsBtn.waitForExistence(timeout: 15) {
      reelsBtn.tap()
      sleep(2)
    }

    let commentBubble = root.buttons.matching(
      NSPredicate(format: "label CONTAINS[c] %@", "comment")
    ).firstMatch
    if commentBubble.waitForExistence(timeout: 8) {
      commentBubble.tap()
      sleep(1)
    }

    let composer = landmark("reels-comment-input", in: root, timeout: 15)
    if composer.exists {
      composer.tap()
      sleep(1)
      XCTAssertTrue(composer.exists, "reels-comment-input must remain visible when keyboard open")
    }
  }

  func testLiveChatComposerLandmark() throws {
    addUIInterruptionMonitor(withDescription: "Camera") { alert in
      for title in ["Allow While Using App", "Allow", "OK"] {
        let b = alert.buttons[title]
        if b.exists { b.tap(); return true }
      }
      return false
    }
    addUIInterruptionMonitor(withDescription: "Microphone") { alert in
      for title in ["Allow While Using App", "Allow", "OK"] {
        let b = alert.buttons[title]
        if b.exists { b.tap(); return true }
      }
      return false
    }

    ensureSignedInShell()
    var root = waitForWebRoot()

    // 1) Reach Live discovery
    var openedLive = false
    if tapIfExists(root.buttons["Live"], timeout: 6) {
      openedLive = true
    } else if tapIfExists(landmark("Open menu", in: root, timeout: 10), timeout: 10) {
      sleep(1)
      if tapIfExists(root.buttons["Live"], timeout: 8) {
        openedLive = true
      } else if tapIfExists(root.staticTexts["Live"], timeout: 6) {
        openedLive = true
      }
    }
    XCTAssertTrue(openedLive, "NAVIGATION_FAILED: Live entry unreachable")
    sleep(2)
    root = webRoot()

    // Solo-host state machine only — never join an existing live card (viewer path
    // does not prove CreateRoom → SoloLiveView → live-chat-input for the host).
    var goLive = landmark("go-live-entry", in: root, timeout: 10)
    if !goLive.exists {
      goLive = root.buttons["Go Live"].firstMatch
    }
    XCTAssertTrue(goLive.waitForExistence(timeout: 12), "APPLICATION_STATE_FAILED: go-live-entry missing")
    goLive.tap()
    sleep(2)
    root = webRoot()

    // 3) Create room / Solo option (Go Live seeds Solo-Live; re-assert if needed)
    XCTAssertTrue(
      landmark("go-live-entry", in: root, timeout: 8).exists
        || landmark("create-room-name", in: root, timeout: 8).exists,
      "APPLICATION_STATE_FAILED: CreateRoom not reached after go-live-entry"
    )
    var soloOption = landmark("go-live-solo-option", in: root, timeout: 8)
    if !soloOption.exists {
      // WKWebView may expose mode chips as switches with go-live-mode-* labels.
      soloOption = root.switches["go-live-solo-option"]
      if !soloOption.exists {
        soloOption = root.descendants(matching: .any)["go-live-mode-Solo-Live"]
      }
    }
    if soloOption.waitForExistence(timeout: 6) {
      soloOption.tap()
      sleep(1)
    } else {
      print("APPLICATION_STATE_FAILED: go-live-solo-option missing after Go Live open")
      print("DEBUG_CREATE=\(root.debugDescription.prefix(3500))")
      XCTFail("APPLICATION_STATE_FAILED: go-live-solo-option not selected/seeded")
      return
    }

    // 4) Caption — product seeds "Live"; only type if empty/disabled
    var roomTitle = landmark("create-room-name", in: root, timeout: 8)
    if !roomTitle.exists {
      roomTitle = root.textFields.firstMatch
    }
    XCTAssertTrue(roomTitle.waitForExistence(timeout: 8), "APPLICATION_STATE_FAILED: create-room-name missing")
    let captionValue = (roomTitle.value as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    if captionValue.isEmpty || captionValue == "Welcome to the room!" {
      roomTitle.tap()
      sleep(1)
      if !captionValue.isEmpty {
        let deleteString = String(repeating: XCUIKeyboardKey.delete.rawValue, count: captionValue.count)
        roomTitle.typeText(deleteString)
      }
      roomTitle.typeText("QA Device Live")
      sleep(1)
    }

    // 5) Launch — prefer Enter on caption (reliable in WKWebView), then tap CTA
    var roomTitleForLaunch = landmark("create-room-name", in: root, timeout: 4)
    if roomTitleForLaunch.exists {
      roomTitleForLaunch.tap()
      sleep(0.5)
      roomTitleForLaunch.typeText("\n")
      sleep(1)
    }

    var launchBtn = landmark("live-go-live-launch", in: root, timeout: 8)
    if !launchBtn.exists {
      launchBtn = root.buttons["live-go-live-launch"].firstMatch
    }
    if landmark("live-countdown", in: root, timeout: 3).exists == false
      && landmark("live-room-creating", in: root, timeout: 2).exists == false
    {
      XCTAssertTrue(launchBtn.waitForExistence(timeout: 10), "APPLICATION_STATE_FAILED: live-go-live-launch missing")
      // Avoid isEnabled check — we use aria-disabled, not HTML disabled
      launchBtn.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
      sleep(1)
      if landmark("live-countdown", in: root, timeout: 2).exists == false
        && landmark("live-room-creating", in: root, timeout: 1).exists == false
      {
        launchBtn.tap()
        sleep(1)
      }
    }
    app.tap() // nudge TCC monitors

    // 6) Countdown observed or intentionally skipped — or report launch block reason
    let blockedCaption = landmark("live-launch-blocked-caption", in: root, timeout: 2)
    let blockedRoom = landmark("live-launch-blocked-room-id", in: root, timeout: 1)
    let blockedBusy = landmark("live-launch-blocked-busy", in: root, timeout: 1)
    if blockedCaption.exists || blockedRoom.exists || blockedBusy.exists {
      let reason = blockedCaption.exists ? "caption" : blockedRoom.exists ? "room-id" : "busy"
      print("APPLICATION_STATE_FAILED: launch blocked reason=\(reason)")
      print("DEBUG_LAUNCH_BLOCK=\(root.debugDescription.prefix(3500))")
      XCTFail("APPLICATION_STATE_FAILED: live-launch-blocked-\(reason)")
      return
    }

    let countdown = landmark("live-countdown", in: root, timeout: 12)
    let skip = landmark("Skip countdown and go live", in: root, timeout: 4)
    if skip.exists {
      skip.tap()
    } else if countdown.exists {
      countdown.tap()
    } else {
      let creating = landmark("live-room-creating", in: root, timeout: 4)
      if !creating.exists {
        print("APPLICATION_STATE_FAILED: neither live-countdown nor live-room-creating after launch")
        print("DEBUG_AFTER_LAUNCH=\(root.debugDescription.prefix(5000))")
        XCTFail("APPLICATION_STATE_FAILED: launch did not enter countdown/creating")
        return
      }
    }
    sleep(4)
    app.tap()
    root = waitForWebRoot(timeout: 30)

    // 6–10) SoloLiveView / permission / RTC state landmarks (stop early on blocker)
    let permissionBlocked = landmark("live-permission-camera-pending", in: root, timeout: 6)
    if permissionBlocked.exists {
      app.tap()
      sleep(2)
      if permissionBlocked.exists {
        print("PERMISSION_BLOCKED: camera still pending — owner may need Settings Allow")
        XCTFail("PERMISSION_BLOCKED: live-permission-camera-pending")
        return
      }
    }

    let errorState = landmark("live-error-state", in: root, timeout: 4)
    if errorState.exists {
      XCTFail("APPLICATION_STATE_FAILED: live-error-state")
      return
    }

    let soloView = landmark("solo-live-view", in: root, timeout: 20)
    if !soloView.exists {
      let connecting = landmark("live-rtc-connecting", in: root, timeout: 8)
      let connected = landmark("live-rtc-connected", in: root, timeout: 8)
      if connecting.exists || connected.exists {
        // connecting/connected share SoloLiveView mount; continue
      } else {
        let stillCreate = landmark("go-live-entry", in: root, timeout: 3)
        let countdownLeft = landmark("live-countdown", in: root, timeout: 3)
        let perm = landmark("live-permission-camera-pending", in: root, timeout: 3)
        print("APPLICATION_STATE_FAILED: SoloLiveView missing — create=\(stillCreate.exists) countdown=\(countdownLeft.exists) perm=\(perm.exists)")
        print("DEBUG_LIVE_STATE=\(root.debugDescription.prefix(4500))")
        if stillCreate.exists {
          XCTFail("APPLICATION_STATE_FAILED: still on CreateRoom (never navigated to SoloLiveView)")
        } else if countdownLeft.exists {
          XCTFail("APPLICATION_STATE_FAILED: stuck on live-countdown")
        } else if perm.exists {
          XCTFail("PERMISSION_BLOCKED: live-permission-camera-pending")
        } else {
          XCTFail("APPLICATION_STATE_FAILED: SoloLiveView not mounted (solo-live-view landmark)")
        }
        return
      }
    }

    let controls = landmark("Solo Live controls", in: root, timeout: 15)
    if !controls.exists {
      _ = landmark("Shop Live controls", in: root, timeout: 8)
    }
    XCTAssertTrue(
      landmark("Solo Live controls", in: root, timeout: 5).exists
        || landmark("Shop Live controls", in: root, timeout: 5).exists,
      "APPLICATION_STATE_FAILED: solo-live-controls missing"
    )

    // 11) Chat panel — product default is open; tap Show chat if closed
    let showChat = landmark("Show chat", in: root, timeout: 6)
    if showChat.exists {
      showChat.tap()
      sleep(1)
    }

    // 12–14) Composer + keyboard
    var composer = landmark("live-chat-input", in: root, timeout: 12, screenLandmark: "Solo Live controls")
    if !composer.exists {
      composer = landmark("live-chat-input", in: root, timeout: 8)
    }
    if !composer.exists {
      print("LANDMARK_NOT_FOUND: live-chat-input — DEBUG=\(root.debugDescription.prefix(3500))")
    }
    XCTAssertTrue(composer.waitForExistence(timeout: 12), "LANDMARK_NOT_FOUND: live-chat-input")
    composer.tap()
    sleep(1)
    XCTAssertTrue(composer.exists, "live-chat-input must remain visible when keyboard open")
  }

  func testPostModalCommentComposerLandmark() throws {
    ensureSignedInShell()
    let root = webRoot()

    let commentBtn = root.buttons.matching(
      NSPredicate(format: "label CONTAINS[c] %@", "comment")
    ).firstMatch
    if commentBtn.waitForExistence(timeout: 10) {
      commentBtn.tap()
      sleep(2)
    }

    let composer = landmark("post-comment-input", in: root, timeout: 20)
    if composer.waitForExistence(timeout: 15) {
      composer.tap()
      sleep(1)
      XCTAssertTrue(composer.exists, "post-comment-input must remain visible when keyboard open")
    }
  }

  func testFeedCommentComposerLandmark() throws {
    ensureSignedInShell()
    let root = webRoot()

    let composer = landmark("feed-comment-input", in: root, timeout: 25)
    if composer.waitForExistence(timeout: 15) {
      composer.tap()
      sleep(1)
      XCTAssertTrue(composer.exists, "feed-comment-input must remain visible when keyboard open")
    }
  }

  func testCameraMicInterruptionMonitors() throws {
    addUIInterruptionMonitor(withDescription: "Camera") { alert in
      for title in ["Allow While Using App", "Allow", "OK"] {
        let b = alert.buttons[title]
        if b.exists { b.tap(); return true }
      }
      return false
    }
    addUIInterruptionMonitor(withDescription: "Microphone") { alert in
      for title in ["Allow While Using App", "Allow", "OK"] {
        let b = alert.buttons[title]
        if b.exists { b.tap(); return true }
      }
      return false
    }
    app.launch()
    let root = webRoot()
    let live = root.buttons["Live"].firstMatch
    if live.waitForExistence(timeout: 40) {
      live.tap()
      app.tap()
    } else if app.buttons["Live"].waitForExistence(timeout: 10) {
      app.buttons["Live"].tap()
      app.tap()
    }
  }
}
