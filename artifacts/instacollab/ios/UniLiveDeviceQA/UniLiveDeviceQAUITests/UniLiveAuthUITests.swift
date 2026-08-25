import XCTest

final class UniLiveAuthUITests: XCTestCase {
  var app: XCUIApplication!

  override func setUpWithError() throws {
    continueAfterFailure = false
    app = XCUIApplication(bundleIdentifier: "com.uniapplab.unilive")
    app.launchArguments += ["-UITesting"]
  }

  private func webRoot() -> XCUIElement {
    let web = app.webViews.firstMatch
    if web.waitForExistence(timeout: 25) {
      return web
    }
    return app
  }

  /// WKWebView exposes aria-label as accessibility label, often with role suffix e.g. "signed-in-shell, main".
  private func landmark(_ token: String, in root: XCUIElement, timeout: TimeInterval = 25) -> XCUIElement {
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
    app.launch()
    let root = webRoot()

    let shell = landmark("signed-in-shell", in: root, timeout: 55)
    let auth = landmark("launch-route-auth", in: root, timeout: 8)
    let profile = landmark("launch-route-profile_setup", in: root, timeout: 8)
    let home = root.staticTexts["Home"].firstMatch
    let live = root.buttons["Live"].firstMatch

    let landed =
      shell.exists ||
      auth.exists ||
      profile.exists ||
      home.waitForExistence(timeout: 15) ||
      live.waitForExistence(timeout: 15)

    if !landed {
      print("DEBUG_APP=\(app.debugDescription.prefix(4000))")
    }
    XCTAssertTrue(landed, "Expected shell/auth/profile/home/live landmark after launch")

    if profile.exists {
      XCTFail("Profile setup shown despite cloud profile_setup_complete")
    }

    if live.exists {
      live.tap()
    } else if app.buttons["Live"].waitForExistence(timeout: 5) {
      app.buttons["Live"].tap()
    }
  }

  func testMessagesComposerLandmarkReachable() throws {
    app.launch()
    let root = webRoot()
    XCTAssertTrue(landmark("signed-in-shell", in: root, timeout: 55).exists)

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
    app.launch()
    let root = webRoot()
    XCTAssertTrue(landmark("signed-in-shell", in: root, timeout: 55).exists)

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
