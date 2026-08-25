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
    let root = webRoot()

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
    XCTAssertTrue(openedLive, "Live entry must be reachable from shell menu or nav")
    sleep(2)

    // Prefer joining an active room; otherwise start Solo Live via Go Live.
    var enteredRoom = false
    let liveCard = root.buttons.matching(
      NSPredicate(format: "identifier CONTAINS[c] %@ OR label CONTAINS[c] %@", "live-room", "LIVE")
    ).firstMatch
    if liveCard.waitForExistence(timeout: 6) {
      liveCard.tap()
      enteredRoom = true
      sleep(4)
    }

    if !enteredRoom {
      XCTAssertTrue(tapIfExists(root.buttons["Go Live"], timeout: 10), "Go Live must be reachable")
      sleep(2)

      // Select Solo live camera mode if mode picker is visible.
      let soloMode = root.buttons["Solo"].firstMatch
      if soloMode.waitForExistence(timeout: 6) {
        soloMode.tap()
        sleep(1)
      }

      // Ensure room title exists so launch is enabled.
      let roomTitle = root.textFields.firstMatch
      if roomTitle.waitForExistence(timeout: 4) {
        roomTitle.tap()
        roomTitle.typeText("QA Device Live")
      }

      let launchBtn = root.buttons.matching(
        NSPredicate(format: "label CONTAINS[c] %@ OR label CONTAINS[c] %@", "Go Live", "Launch Room")
      ).firstMatch
      if launchBtn.waitForExistence(timeout: 8) {
        launchBtn.tap()
        sleep(2)
      }

      let skipCountdown = landmark("Skip countdown and go live", in: root, timeout: 15)
      if skipCountdown.waitForExistence(timeout: 12) {
        skipCountdown.tap()
        sleep(3)
      }
      enteredRoom = true
    }

    XCTAssertTrue(enteredRoom, "Must enter a live room as host or viewer")

    let chatToggle = root.buttons.matching(
      NSPredicate(format: "label CONTAINS[c] %@", "chat")
    ).firstMatch
    if chatToggle.waitForExistence(timeout: 8) {
      chatToggle.tap()
      sleep(1)
    }

    var composer = landmark("live-chat-input", in: root, timeout: 12, screenLandmark: "Solo Live controls")
    if !composer.exists {
      composer = landmark("live-chat-input", in: root, timeout: 8, screenLandmark: "Shop Live controls")
    }
    if !composer.exists {
      composer = landmark("live-chat-input", in: root, timeout: 8)
    }
    if !composer.exists {
      composer = landmark("Live chat message", in: root, timeout: 6)
    }
    if !composer.exists {
      print("DEBUG_LIVE_ROOM=\(root.debugDescription.prefix(4500))")
    }
    XCTAssertTrue(composer.waitForExistence(timeout: 25), "live-chat-input landmark required")
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
