import XCTest

/// Physical-device auth + shell landmarks for UniLive Cap.
/// Credentials from scheme env (never committed):
///   UNILIVE_QA_EMAIL / UNILIVE_QA_PASSWORD
final class UniLiveAuthUITests: XCTestCase {
  var app: XCUIApplication!

  override func setUpWithError() throws {
    continueAfterFailure = false
    app = XCUIApplication(bundleIdentifier: "com.uniapplab.unilive")
    app.launchArguments += ["-UITesting"]
    if let email = ProcessInfo.processInfo.environment["UNILIVE_QA_EMAIL"], !email.isEmpty {
      app.launchEnvironment["UNILIVE_QA_EMAIL"] = email
    }
    if let password = ProcessInfo.processInfo.environment["UNILIVE_QA_PASSWORD"], !password.isEmpty {
      app.launchEnvironment["UNILIVE_QA_PASSWORD"] = password
    }
    app.launch()
  }

  func testSignedInShellOrLoginThenHome() throws {
    let shell = app.otherElements["signed-in-shell"]
    let auth = app.otherElements["launch-route-auth"]
    let profile = app.otherElements["launch-route-profile_setup"]

    let landed = shell.waitForExistence(timeout: 45)
      || auth.waitForExistence(timeout: 45)
      || profile.waitForExistence(timeout: 45)
    XCTAssertTrue(landed, "Expected signed-in shell, auth, or profile setup")

    if shell.exists {
      return
    }

    if profile.exists {
      XCTFail("Profile setup shown despite cloud profile_setup_complete — launch SSOT regression")
      return
    }

    // Auth path: agree → email → password → Log in
    let agree = app.switches.firstMatch
    if agree.exists && agree.value as? String != "1" {
      agree.tap()
    }
    // Welcome may need Sign in first
    let signInChip = app.buttons["Sign in"]
    if signInChip.waitForExistence(timeout: 5) {
      signInChip.tap()
    }

    let email = ProcessInfo.processInfo.environment["UNILIVE_QA_EMAIL"] ?? ""
    let password = ProcessInfo.processInfo.environment["UNILIVE_QA_PASSWORD"] ?? ""
    XCTAssertFalse(email.isEmpty, "UNILIVE_QA_EMAIL required")
    XCTAssertFalse(password.isEmpty, "UNILIVE_QA_PASSWORD required")

    let emailField = app.textFields["Email"]
    let passwordField = app.secureTextFields["Password"]
    XCTAssertTrue(emailField.waitForExistence(timeout: 20), "Email field missing")
    emailField.tap()
    emailField.typeText(email)
    XCTAssertTrue(passwordField.waitForExistence(timeout: 10), "Password field missing")
    passwordField.tap()
    passwordField.typeText(password)

    let login = app.buttons["Log in"]
    XCTAssertTrue(login.waitForExistence(timeout: 10))
    login.tap()

    XCTAssertTrue(shell.waitForExistence(timeout: 60), "Signed-in shell did not appear after login")
  }

  func testCameraPermissionInterruption() throws {
    addUIInterruptionMonitor(withDescription: "Camera") { alert in
      let allow = alert.buttons["Allow"]
      let allowWhile = alert.buttons["Allow While Using App"]
      if allowWhile.exists {
        allowWhile.tap()
        return true
      }
      if allow.exists {
        allow.tap()
        return true
      }
      return false
    }
    addUIInterruptionMonitor(withDescription: "Microphone") { alert in
      let allow = alert.buttons["Allow"]
      let allowWhile = alert.buttons["Allow While Using App"]
      if allowWhile.exists {
        allowWhile.tap()
        return true
      }
      if allow.exists {
        allow.tap()
        return true
      }
      return false
    }

    let shell = app.otherElements["signed-in-shell"]
    guard shell.waitForExistence(timeout: 60) else {
      throw XCTSkip("Not signed in — run auth test / session handoff first")
    }

    // Navigate Live via accessibility if present
    let live = app.buttons["Live"].firstMatch
    if live.waitForExistence(timeout: 15) {
      live.tap()
    }
    // Nudge the app so interruption monitors fire
    app.tap()
  }
}
