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

  private func any(_ id: String, in root: XCUIElement) -> XCUIElement {
    root.descendants(matching: .any)[id]
  }

  func testDeviceAlreadySignedInShellOrAuthLandmarks() throws {
    app.launch()
    let root = webRoot()

    let shell = any("signed-in-shell", in: root)
    let auth = any("launch-route-auth", in: root)
    let profile = any("launch-route-profile_setup", in: root)
    let home = root.staticTexts["Home"].firstMatch
    let live = root.buttons["Live"].firstMatch
    let liveAny = app.buttons["Live"].firstMatch

    let landed =
      shell.waitForExistence(timeout: 55) ||
      auth.waitForExistence(timeout: 15) ||
      profile.waitForExistence(timeout: 15) ||
      home.waitForExistence(timeout: 15) ||
      live.waitForExistence(timeout: 15) ||
      liveAny.waitForExistence(timeout: 15)

    if !landed {
      // Help triage Cap WebView accessibility without secrets.
      print("DEBUG_APP=\(app.debugDescription.prefix(4000))")
    }
    XCTAssertTrue(landed, "Expected shell/auth/profile/home/live landmark after launch")

    if profile.exists {
      XCTFail("Profile setup shown despite cloud profile_setup_complete")
    }

    if live.exists {
      live.tap()
    } else if liveAny.exists {
      liveAny.tap()
    } else if app.buttons["Live"].waitForExistence(timeout: 5) {
      app.buttons["Live"].tap()
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
