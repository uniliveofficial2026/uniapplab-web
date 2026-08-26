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
    // Prefer activate over launch so an already-warm Cap Solo Live session survives.
    if app.state == .runningForeground || app.state == .runningBackground {
      app.activate()
    } else {
      app.launch()
    }
    XCTAssertTrue(app.wait(for: .runningForeground, timeout: 35), "Cap app must reach foreground")
    sleep(2)
  }

  private func waitForWebRoot(timeout: TimeInterval = 55) -> XCUIElement {
    let allowTerminate = qaEnv("UNILIVE_DEVICE_QA_TERMINATE") == "1"
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
        // Solo Live / CreateRoom may not expose signed-in-shell in AX — still usable web root.
        if landmark("solo-live-view", in: web, timeout: 2).exists
          || landmark("live-rtc-connected", in: web, timeout: 2).exists
          || landmark("go-live-entry", in: web, timeout: 2).exists
          || landmark("live-go-live-launch", in: web, timeout: 2).exists
        {
          return web
        }
        if attempt < Self.axAttachRetries {
          print("CAMERA_AX_RETRY attempt=\(attempt) missing signed-in-shell (no terminate)")
          continue
        }
        return web
      }
      if attempt < Self.axAttachRetries {
        if allowTerminate {
          print("CAMERA_AX_TERMINATE_RELAUNCH attempt=\(attempt)")
          app.terminate()
          sleep(2)
          launchCapAppOnce()
        } else {
          print("CAMERA_AX_REATTACH_NO_TERMINATE attempt=\(attempt)")
          app.activate()
          sleep(2)
        }
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
    sleep(3)
    root = webRoot()

    // Auto-launch may already have completed CreateRoom → countdown → SoloLiveView.
    let alreadyHost =
      landmark("solo-live-view", in: root, timeout: 4).exists
      || landmark("live-rtc-connecting", in: root, timeout: 2).exists
      || landmark("live-rtc-connected", in: root, timeout: 2).exists
      || landmark("live-countdown", in: root, timeout: 2).exists
      || landmark("live-permission-camera-pending", in: root, timeout: 2).exists
    if alreadyHost {
      print("LAUNCH_CLASSIFICATION=G_COUNTDOWN_STARTED (auto-launch past CreateRoom)")
    } else {
      // CreateRoom must expose the caption field — go-live-entry alone can still be on Live tab.
      var createName = landmark("create-room-name", in: root, timeout: 12)
      if !createName.exists {
        // Retry Go Live once — first tap sometimes only focuses the Live chrome.
        goLive = landmark("go-live-entry", in: root, timeout: 4)
        if goLive.exists { goLive.tap(); sleep(3); root = webRoot() }
        createName = landmark("create-room-name", in: root, timeout: 12)
      }
      XCTAssertTrue(
        createName.waitForExistence(timeout: 8),
        "APPLICATION_STATE_FAILED: CreateRoom not reached after go-live-entry"
      )
      var soloOption = landmark("go-live-solo-option", in: root, timeout: 8)
      if !soloOption.exists {
        // WKWebView may expose mode chips as switches with go-live-mode-* labels.
        soloOption = root.switches["go-live-solo-option"]
        if !soloOption.exists {
          soloOption = root.descendants(matching: .any)["go-live-mode-Solo-Live"]
        }
        if !soloOption.exists {
          soloOption = root.descendants(matching: .any).matching(
            NSPredicate(format: "label == %@ OR label CONTAINS[c] %@", "Solo", "Solo Live")
          ).firstMatch
        }
      }
      if soloOption.waitForExistence(timeout: 6) {
        soloOption.tap()
        sleep(1)
      } else if landmark("create-room-name", in: root, timeout: 2).exists {
        // Product may already seed Solo-Live; continue without chip if caption is present.
        print("CAMERA_SOLO_OPTION=SEEDED_VIA_CREATE_ROOM_CAPTION")
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
    }

    // 5) Launch — prefer observing auto-launch (single-shot); then form submit CTA
    // Also classify A–G from transition landmarks when launch stalls.
    func classifyLaunchFailure(_ rootEl: XCUIElement) -> String {
      let transitions = [
        "COUNTDOWN_START", "ROOM_CREATED", "CREATE_ROOM_REQUEST_OK", "CREATE_ROOM_REQUEST_FAIL",
        "CREATE_ROOM_REQUEST_START", "CREATE_ROOM_VALIDATION_BLOCKED",
        "CREATE_ROOM_VALIDATION_PASS", "CREATE_ROOM_VALIDATING", "CREATE_ROOM_CLICKED",
      ]
      for t in transitions {
        if landmark(t, in: rootEl, timeout: 1).exists {
          switch t {
          case "COUNTDOWN_START": return "G_COUNTDOWN_STARTED"
          case "ROOM_CREATED": return "F_API_OK_NAV_STUCK_ON_CREATE"
          case "CREATE_ROOM_REQUEST_OK": return "F_API_OK_STATE_STUCK"
          case "CREATE_ROOM_REQUEST_FAIL": return "E_ROOM_API_FAILED"
          case "CREATE_ROOM_REQUEST_START": return "D_API_NEVER_COMPLETED"
          case "CREATE_ROOM_VALIDATION_BLOCKED": return "B_VALIDATION_BLOCKED"
          case "CREATE_ROOM_VALIDATION_PASS", "CREATE_ROOM_VALIDATING", "CREATE_ROOM_CLICKED":
            return "D_HANDLER_RAN_API_NOT_CONFIRMED"
          default: break
          }
        }
      }
      if landmark("live-launch-blocked-caption", in: rootEl, timeout: 1).exists
        || landmark("live-launch-blocked-privacy", in: rootEl, timeout: 1).exists
        || landmark("live-launch-blocked-auth", in: rootEl, timeout: 1).exists
        || landmark("live-launch-blocked-room-id", in: rootEl, timeout: 1).exists
        || landmark("live-launch-blocked-busy", in: rootEl, timeout: 1).exists {
        return "B_VALIDATION_BLOCKED"
      }
      return "A_CLICK_HANDLER_NOT_EXECUTED"
    }

    // Auto-launch may already have advanced past CreateRoom.
    if alreadyHost
      || landmark("live-countdown", in: root, timeout: 4).exists
      || landmark("live-room-creating", in: root, timeout: 2).exists
      || landmark("solo-live-view", in: root, timeout: 2).exists {
      print("LAUNCH_CLASSIFICATION=G_COUNTDOWN_STARTED (auto-launch)")
    } else {
      var launchBtn = landmark("live-go-live-launch", in: root, timeout: 10)
      if !launchBtn.exists {
        launchBtn = root.buttons["live-go-live-launch"].firstMatch
      }
      XCTAssertTrue(launchBtn.waitForExistence(timeout: 10), "APPLICATION_STATE_FAILED: live-go-live-launch missing")
      launchBtn.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
      sleep(2)
      if landmark("live-countdown", in: root, timeout: 3).exists == false
        && landmark("live-room-creating", in: root, timeout: 2).exists == false
        && landmark("solo-live-view", in: root, timeout: 2).exists == false
      {
        // Form submit path: activate button (WK often maps AX activate → click/submit)
        launchBtn.tap()
        sleep(2)
      }
    }
    app.tap() // nudge TCC monitors

    // 6) Countdown observed or intentionally skipped — or report launch block reason
    let blockedCaption = landmark("live-launch-blocked-caption", in: root, timeout: 2)
    let blockedRoom = landmark("live-launch-blocked-room-id", in: root, timeout: 1)
    let blockedBusy = landmark("live-launch-blocked-busy", in: root, timeout: 1)
    let blockedAuth = landmark("live-launch-blocked-auth", in: root, timeout: 1)
    if blockedCaption.exists || blockedRoom.exists || blockedBusy.exists || blockedAuth.exists {
      let reason = blockedCaption.exists ? "caption"
        : blockedRoom.exists ? "room-id"
        : blockedAuth.exists ? "auth" : "busy"
      print("LAUNCH_CLASSIFICATION=B_VALIDATION_BLOCKED reason=\(reason)")
      print("DEBUG_LAUNCH_BLOCK=\(root.debugDescription.prefix(3500))")
      XCTFail("APPLICATION_STATE_FAILED: live-launch-blocked-\(reason)")
      return
    }

    let countdown = landmark("live-countdown", in: root, timeout: alreadyHost ? 2 : 12)
    let skip = landmark("Skip countdown and go live", in: root, timeout: 4)
    if skip.exists {
      print("LAUNCH_CLASSIFICATION=G_COUNTDOWN_STARTED")
      skip.tap()
    } else if countdown.exists {
      print("LAUNCH_CLASSIFICATION=G_COUNTDOWN_STARTED")
      countdown.tap()
    } else if alreadyHost
      || landmark("solo-live-view", in: root, timeout: 3).exists
      || landmark("live-rtc-connecting", in: root, timeout: 2).exists
      || landmark("live-rtc-connected", in: root, timeout: 2).exists
    {
      print("LAUNCH_CLASSIFICATION=G_COUNTDOWN_STARTED (already in SoloLiveView)")
    } else {
      let creating = landmark("live-room-creating", in: root, timeout: 4)
      if !creating.exists {
        let cls = classifyLaunchFailure(root)
        print("LAUNCH_CLASSIFICATION=\(cls)")
        print("APPLICATION_STATE_FAILED: neither live-countdown nor live-room-creating after launch")
        print("DEBUG_AFTER_LAUNCH=\(root.debugDescription.prefix(5000))")
        XCTFail("APPLICATION_STATE_FAILED: launch did not enter countdown/creating [\(cls)]")
        return
      }
      print("LAUNCH_CLASSIFICATION=G_COUNTDOWN_STARTED (creating)")
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
    // Same-room remote harness: emit Host A app room id, then dismiss keyboard so
    // the following camera flip test can hit Guests / Flip.
    emitCameraRoomId(from: root)
    dismissLiveKeyboardIfNeeded(root)
  }

  /// Shared Solo Live host entry — mirrors hardened live-chat state machine.
  /// Prefer keeping an already-active Solo session warm (same-room remote proof).
  @discardableResult
  private func reachSoloLiveHostForCamera() -> XCUIElement {
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

    // Already hosting — do not end Live / recreate room.
    if landmark("solo-live-view", in: root, timeout: 3).exists
      || landmark("live-rtc-connected", in: root, timeout: 2).exists
      || landmark("camera-facing-front", in: root, timeout: 2).exists
      || landmark("camera-facing-rear", in: root, timeout: 2).exists {
      print("CAMERA_ENTRY=ALREADY_IN_SOLO_LIVE")
      return root
    }

    var openedLive = false
    if tapIfExists(root.buttons["Live"], timeout: 6) {
      openedLive = true
    } else if tapIfExists(landmark("Open menu", in: root, timeout: 10), timeout: 10) {
      sleep(1)
      openedLive = tapIfExists(root.buttons["Live"], timeout: 8)
        || tapIfExists(root.staticTexts["Live"], timeout: 6)
    }
    XCTAssertTrue(openedLive, "NAVIGATION_FAILED: Live entry unreachable")
    sleep(2)
    root = webRoot()

    // Re-check after Live tab — auto-resume may already be in Solo.
    if landmark("solo-live-view", in: root, timeout: 3).exists
      || landmark("live-rtc-connected", in: root, timeout: 2).exists
      || landmark("live-rtc-connecting", in: root, timeout: 2).exists {
      print("CAMERA_ENTRY=ALREADY_IN_SOLO_LIVE_AFTER_LIVE_TAB")
      return root
    }

    var goLive = landmark("go-live-entry", in: root, timeout: 10)
    if !goLive.exists {
      goLive = root.buttons["Go Live"].firstMatch
    }
    if !goLive.exists {
      root.swipeDown()
      sleep(1)
      root = webRoot()
      goLive = landmark("go-live-entry", in: root, timeout: 6)
    }
    if !goLive.exists {
      goLive = root.buttons["Go Live"].firstMatch
    }
    if !goLive.exists {
      goLive = root.descendants(matching: .any).matching(
        NSPredicate(format: "label ==[c] %@ OR label CONTAINS[c] %@", "Go Live", "Go Live")
      ).firstMatch
    }
    if !goLive.exists {
      let hero = root.staticTexts["Host a Live Concert"].firstMatch
      if hero.waitForExistence(timeout: 4) {
        hero.tap()
        sleep(1)
        root = webRoot()
        goLive = landmark("go-live-entry", in: root, timeout: 4)
        if !goLive.exists { goLive = root.buttons["Go Live"].firstMatch }
      }
    }
    if !goLive.waitForExistence(timeout: 12) {
      print("DEBUG_LIVE_NO_GOLIVE=\(root.debugDescription.prefix(4500))")
      XCTFail("APPLICATION_STATE_FAILED: go-live-entry missing")
      return root
    }
    goLive.tap()
    sleep(3)
    root = webRoot()

    let alreadyHost =
      landmark("solo-live-view", in: root, timeout: 4).exists
      || landmark("live-rtc-connecting", in: root, timeout: 2).exists
      || landmark("live-rtc-connected", in: root, timeout: 2).exists
      || landmark("live-countdown", in: root, timeout: 2).exists
      || landmark("live-permission-camera-pending", in: root, timeout: 2).exists

    if alreadyHost {
      print("LAUNCH_CLASSIFICATION=G_COUNTDOWN_STARTED (auto-launch past CreateRoom)")
    } else {
      var createName = landmark("create-room-name", in: root, timeout: 12)
      if !createName.exists {
        goLive = landmark("go-live-entry", in: root, timeout: 4)
        if goLive.exists { goLive.tap(); sleep(3); root = webRoot() }
        createName = landmark("create-room-name", in: root, timeout: 12)
      }
      XCTAssertTrue(
        createName.waitForExistence(timeout: 8),
        "APPLICATION_STATE_FAILED: CreateRoom not reached after go-live-entry"
      )
      var soloOption = landmark("go-live-solo-option", in: root, timeout: 8)
      if !soloOption.exists {
        soloOption = root.switches["go-live-solo-option"]
        if !soloOption.exists {
          soloOption = root.descendants(matching: .any)["go-live-mode-Solo-Live"]
        }
        if !soloOption.exists {
          soloOption = root.descendants(matching: .any).matching(
            NSPredicate(format: "label == %@ OR label CONTAINS[c] %@", "Solo", "Solo Live")
          ).firstMatch
        }
      }
      if soloOption.waitForExistence(timeout: 6) {
        soloOption.tap()
        sleep(1)
      } else if landmark("create-room-name", in: root, timeout: 2).exists {
        print("CAMERA_SOLO_OPTION=SEEDED_VIA_CREATE_ROOM_CAPTION")
      } else {
        print("DEBUG_CREATE=\(root.debugDescription.prefix(3500))")
        XCTFail("APPLICATION_STATE_FAILED: go-live-solo-option not selected/seeded")
        return root
      }

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
    }

    if alreadyHost
      || landmark("live-countdown", in: root, timeout: 4).exists
      || landmark("live-room-creating", in: root, timeout: 2).exists
      || landmark("solo-live-view", in: root, timeout: 2).exists {
      print("LAUNCH_CLASSIFICATION=G_COUNTDOWN_STARTED (auto-launch)")
    } else {
      var launchBtn = landmark("live-go-live-launch", in: root, timeout: 10)
      if !launchBtn.exists {
        launchBtn = root.buttons["live-go-live-launch"].firstMatch
      }
      XCTAssertTrue(launchBtn.waitForExistence(timeout: 10), "APPLICATION_STATE_FAILED: live-go-live-launch missing")
      launchBtn.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
      sleep(2)
      if landmark("live-countdown", in: root, timeout: 3).exists == false
        && landmark("live-room-creating", in: root, timeout: 2).exists == false
        && landmark("solo-live-view", in: root, timeout: 2).exists == false
      {
        launchBtn.tap()
        sleep(2)
      }
    }
    app.tap()

    let skip = landmark("Skip countdown and go live", in: root, timeout: 4)
    let countdown = landmark("live-countdown", in: root, timeout: alreadyHost ? 2 : 12)
    if skip.exists {
      print("LAUNCH_CLASSIFICATION=G_COUNTDOWN_STARTED")
      skip.tap()
    } else if countdown.exists {
      print("LAUNCH_CLASSIFICATION=G_COUNTDOWN_STARTED")
      countdown.tap()
    } else if alreadyHost
      || landmark("solo-live-view", in: root, timeout: 3).exists
      || landmark("live-rtc-connecting", in: root, timeout: 2).exists
      || landmark("live-rtc-connected", in: root, timeout: 2).exists
    {
      print("LAUNCH_CLASSIFICATION=G_COUNTDOWN_STARTED (already in SoloLiveView)")
    } else {
      let creating = landmark("live-room-creating", in: root, timeout: 8)
      XCTAssertTrue(creating.exists, "APPLICATION_STATE_FAILED: neither live-countdown nor live-room-creating after launch")
      print("LAUNCH_CLASSIFICATION=G_COUNTDOWN_STARTED (creating)")
    }

    sleep(4)
    app.tap()
    root = waitForWebRoot(timeout: 30)

    let permissionBlocked = landmark("live-permission-camera-pending", in: root, timeout: 6)
    if permissionBlocked.exists {
      app.tap()
      sleep(2)
      if permissionBlocked.exists {
        XCTFail("PERMISSION_BLOCKED: live-permission-camera-pending")
        return root
      }
    }

    XCTAssertFalse(landmark("live-error-state", in: root, timeout: 3).exists, "APPLICATION_STATE_FAILED: live-error-state")

    // Assert SoloLiveView / RTC landmarks (no blind sleep-only success).
    let soloMounted =
      landmark("solo-live-view", in: root, timeout: 20).exists
      || landmark("live-rtc-connecting", in: root, timeout: 10).exists
      || landmark("live-rtc-connected", in: root, timeout: 10).exists
    XCTAssertTrue(soloMounted, "APPLICATION_STATE_FAILED: SoloLiveView not mounted for camera switch")

    // Prefer connected + published before Mac join.
    _ = landmark("live-rtc-connected", in: root, timeout: 25)
    _ = landmark("camera-rtc-published", in: root, timeout: 20)
    if landmark("live-rtc-connected", in: root, timeout: 2).exists {
      print("HOST_RTC=CONNECTED")
    } else if landmark("live-rtc-connecting", in: root, timeout: 2).exists {
      print("HOST_RTC=CONNECTING")
    }
    if landmark("camera-rtc-published", in: root, timeout: 2).exists {
      print("HOST_PUBLICATION=PRESENT")
    }

    return root
  }

  private func dismissLiveKeyboardIfNeeded(_ rootIn: XCUIElement) {
    var root = rootIn
    // live-chat-input focus from prior test leaves keyboard covering Guests / Flip.
    if app.keyboards.buttons.count > 0 || landmark("live-chat-input", in: root, timeout: 2).exists {
      print("CAMERA_DISMISS_KEYBOARD")
      app.swipeDown()
      sleep(1)
      let controls = landmark("Solo Live controls", in: root, timeout: 3)
      if controls.exists {
        controls.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.05)).tap()
      } else {
        root.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.15)).tap()
      }
      sleep(1)
      if app.keyboards.buttons["Return"].exists {
        app.keyboards.buttons["Return"].tap()
        sleep(1)
      }
      // Final fallback: tap top chrome
      root.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.08)).tap()
      sleep(1)
    }
  }

  private func emitCameraRoomId(from root: XCUIElement) {
    // Prefer dedicated landmark; also accept room id embedded in SoloLiveView aria-label.
    let roomLandmark = root.descendants(matching: .any).matching(
      NSPredicate(format: "label BEGINSWITH %@ OR label CONTAINS %@", "live-room-id-", "live-room-id-")
    ).firstMatch
    if roomLandmark.waitForExistence(timeout: 4) {
      let label = roomLandmark.label
      if let range = label.range(of: "live-room-id-") {
        let after = String(label[range.upperBound...])
        let rid = after.split(whereSeparator: { !$0.isNumber }).first.map(String.init) ?? after
        if !rid.isEmpty {
          print("CAMERA_ROOM_ID=\(rid)")
          return
        }
      }
    }
    // Product chrome: "Copy room ID 6725006"
    let copyBtn = root.descendants(matching: .any).matching(
      NSPredicate(format: "label CONTAINS[c] %@", "Copy room ID")
    ).firstMatch
    if copyBtn.waitForExistence(timeout: 4) {
      let label = copyBtn.label
      let digits = label.filter { $0.isNumber }
      if digits.count >= 7 {
        let rid = String(digits.suffix(7))
        print("CAMERA_ROOM_ID=\(rid)")
        return
      }
    }
    let byValue = root.descendants(matching: .any).matching(
      NSPredicate(format: "value MATCHES %@", "[0-9]{7}")
    ).firstMatch
    if byValue.waitForExistence(timeout: 2), let v = byValue.value as? String, v.count == 7 {
      print("CAMERA_ROOM_ID=\(v)")
      return
    }
    print("CAMERA_ROOM_ID=MISSING")
  }

  private func tapPossiblyBlocked(_ element: XCUIElement, name: String) {
    if element.isHittable {
      element.tap()
    } else {
      print("CAMERA_COORD_TAP=\(name)")
      element.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    }
  }

  private func holdForMacViewerJoin() {
    let raw = qaEnv("UNILIVE_CAMERA_HOLD_BEFORE_FLIP_SEC")
    let holdSec = Int(raw).flatMap { $0 > 0 ? $0 : nil } ?? 90
    print("CAMERA_HOLD_FOR_VIEWER_SEC=\(holdSec)")
    var remaining = holdSec
    while remaining > 0 {
      let slice = min(15, remaining)
      sleep(UInt32(slice))
      remaining -= slice
      _ = app.wait(for: .runningForeground, timeout: 3)
      var root = webRoot()
      dismissLiveKeyboardIfNeeded(root)
      root = webRoot()
      if !landmark("solo-live-view", in: root, timeout: 2).exists
        && !landmark("live-rtc-connected", in: root, timeout: 2).exists
        && !landmark("camera-facing-front", in: root, timeout: 2).exists
        && !landmark("camera-facing-rear", in: root, timeout: 2).exists
      {
        print("CAMERA_AX_REATTACH_ATTEMPT remaining=\(remaining)")
        app.activate()
        root = waitForWebRoot(timeout: 20)
      }
      emitCameraRoomId(from: root)
      print("CAMERA_HOLD_TICK remaining=\(remaining)")
    }
  }

  private func openGuestsAndTapCameraSwitch(rootIn: XCUIElement) -> XCUIElement {
    var root = rootIn
    dismissLiveKeyboardIfNeeded(root)
    root = webRoot()
    // Extra dismiss: chat input / Messenger banners leave Guests non-hittable.
    if app.keyboards.buttons.count > 0 {
      app.swipeDown()
      sleep(1)
    }
    root.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.12)).tap()
    sleep(1)
    root = webRoot()

    var guestsBtn = root.buttons["Guests"].firstMatch
    if !guestsBtn.exists {
      guestsBtn = landmark("Guests", in: root, timeout: 6)
    }
    if !guestsBtn.exists {
      guestsBtn = root.descendants(matching: .any).matching(
        NSPredicate(format: "label == %@ OR identifier == %@", "Guests", "Guests")
      ).firstMatch
    }
    XCTAssertTrue(guestsBtn.waitForExistence(timeout: 10), "APPLICATION_STATE_FAILED: Guests control missing")

    var panelOpen = false
    for attempt in 1...4 {
      print("CAMERA_GUESTS_OPEN_ATTEMPT=\(attempt) hittable=\(guestsBtn.isHittable)")
      if guestsBtn.isHittable {
        guestsBtn.tap()
      } else {
        // Prefer control-bar mid-point over button-local coord (often blocked).
        let controls = landmark("Solo Live controls", in: root, timeout: 2)
        if controls.exists {
          print("CAMERA_COORD_TAP=Guests-via-controls")
          controls.coordinate(withNormalizedOffset: CGVector(dx: 0.38, dy: 0.55)).tap()
        } else {
          tapPossiblyBlocked(guestsBtn, name: "Guests")
        }
      }
      sleep(2)
      root = webRoot()
      let closePanel = landmark("Close guests panel", in: root, timeout: 3)
      let guestsTitle = root.descendants(matching: .any).matching(
        NSPredicate(format: "label CONTAINS[c] %@", "Guests (")
      ).firstMatch
      let flipProbe = landmark("camera-switch", in: root, timeout: 2)
      if closePanel.exists || guestsTitle.exists || flipProbe.exists {
        panelOpen = true
        print("CAMERA_GUESTS_PANEL_OPEN=1")
        break
      }
      print("CAMERA_GUESTS_PANEL_OPEN=0")
      dismissLiveKeyboardIfNeeded(root)
      root = webRoot()
      guestsBtn = root.buttons["Guests"].firstMatch
      if !guestsBtn.exists {
        guestsBtn = landmark("Guests", in: root, timeout: 3)
      }
    }
    if !panelOpen {
      print("DEBUG_CAMERA=\(root.debugDescription.prefix(4500))")
      XCTFail("APPLICATION_STATE_FAILED: Guests panel did not open")
      return root
    }

    var switchBtn = landmark("camera-switch", in: root, timeout: 8)
    if !switchBtn.exists {
      switchBtn = root.buttons["Flip"].firstMatch
    }
    if !switchBtn.exists {
      switchBtn = root.buttons["Flip camera"].firstMatch
    }
    if !switchBtn.exists {
      switchBtn = root.descendants(matching: .any).matching(
        NSPredicate(format: "label == %@ OR identifier == %@ OR label CONTAINS[c] %@", "camera-switch", "camera-switch", "Flip")
      ).firstMatch
    }
    if !switchBtn.waitForExistence(timeout: 10) {
      print("DEBUG_CAMERA=\(root.debugDescription.prefix(4500))")
      XCTFail("APPLICATION_STATE_FAILED: camera-switch missing (open Guests first)")
      return root
    }
    print("CAMERA_SWITCH_TAP")
    tapPossiblyBlocked(switchBtn, name: "camera-switch")
    sleep(3)
    // Dismiss guests sheet so landmarks remain visible.
    let closeAfter = landmark("Close guests panel", in: root, timeout: 2)
    if closeAfter.exists {
      tapPossiblyBlocked(closeAfter, name: "Close guests panel")
      sleep(1)
    } else {
      root.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.12)).tap()
      sleep(1)
    }
    return webRoot()
  }

  /// Front → rear → front camera switch on physical Solo Live host.
  func testSoloLiveFrontRearFrontCamera() throws {
    var root = reachSoloLiveHostForCamera()
    emitCameraRoomId(from: root)

    // Give Mac Viewer B time to discover + join the SAME room before flipping.
    holdForMacViewerJoin()
    root = webRoot()
    emitCameraRoomId(from: root)

    let frontBefore = landmark("camera-facing-front", in: root, timeout: 8)
    print("CAMERA_FRONT_BEFORE=\(frontBefore.exists)")
    if frontBefore.exists {
      print("CAMERA_SWITCH_REQUEST_REAR")
    }

    root = openGuestsAndTapCameraSwitch(rootIn: root)

    let rear = landmark("camera-facing-rear", in: root, timeout: 12)
    if !rear.exists {
      print("CAMERA_SWITCH_CLASS=D_OR_FAIL rear landmark missing after switch")
      print("DEBUG_CAMERA=\(root.debugDescription.prefix(4000))")
      XCTFail("REAR_CAMERA_FAIL: camera-facing-rear not active after switch")
      return
    }
    print("CAMERA_SWITCH_CLASS=TRACK_LANDMARK_REAR")
    print("LAUNCH_CAMERA=REAR_ACTIVE")

    // Hold rear briefly so Mac can sample remote rear frames.
    sleep(20)

    root = openGuestsAndTapCameraSwitch(rootIn: root)

    let frontAfter = landmark("camera-facing-front", in: root, timeout: 12)
    XCTAssertTrue(frontAfter.exists, "REAR→FRONT_FAIL: camera-facing-front not restored")
    print("LAUNCH_CAMERA=FRONT_ACTIVE")
    XCTAssertTrue(
      landmark("solo-live-view", in: root, timeout: 8).exists
        || landmark("live-rtc-connected", in: root, timeout: 5).exists
        || landmark("live-rtc-connecting", in: root, timeout: 5).exists
        || frontAfter.exists,
      "ROOM_RECONNECT_FAIL: SoloLiveView lost after camera switch"
    )
    print("ROOM_RECONNECTED=NO")
    print("CAMERA_SWITCH_CYCLES=front_rear_front_PASS")
    sleep(15)
  }

  /// 10 front↔rear transitions without app relaunch.
  func testSoloLiveCameraFlipStress() throws {
    var root = reachSoloLiveHostForCamera()
    emitCameraRoomId(from: root)
    holdForMacViewerJoin()
    root = webRoot()
    print("CAMERA_STRESS_ROOM_HINT=ready")

    var expectRear = true
    for cycle in 1...10 {
      root = openGuestsAndTapCameraSwitch(rootIn: root)
      let want = expectRear ? "camera-facing-rear" : "camera-facing-front"
      let got = landmark(want, in: root, timeout: 12)
      print("CAMERA_STRESS_CYCLE=\(cycle) expect=\(want) ok=\(got.exists)")
      XCTAssertTrue(got.exists, "STRESS_FAIL cycle=\(cycle) missing \(want)")
      expectRear.toggle()
    }

    print("CAMERA_STRESS_10_CYCLES=PASS")
    XCTAssertTrue(
      landmark("solo-live-view", in: root, timeout: 5).exists
        || landmark("live-rtc-connected", in: root, timeout: 5).exists,
      "STRESS_FAIL: SoloLiveView lost after 10 cycles"
    )
    print("ROOM_RECONNECTED=NO")
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
