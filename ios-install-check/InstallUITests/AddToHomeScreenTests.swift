import UIKit
import XCTest

// Acceptance 1 on iPhone: installs the live app to the home screen the way a
// person does (Safari → Share → Add to Home Screen → Add), opens it from its
// home-screen icon, and checks that it runs standalone, in its own process
// rather than in Safari. Runs on the iOS Simulator, which ships the real iOS
// Safari and home screen.
final class AddToHomeScreenTests: XCTestCase {
    private let liveURL =
        ProcessInfo.processInfo.environment["LIVE_URL"]
        ?? "https://nfdzgg.github.io/Progressive-Overload-Tracker/"
    private let homeScreenTitle = "Overload"  // apple-mobile-web-app-title
    private let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
    private let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
    // Home-screen web apps run in their own app process, not in Safari.
    private let webAppIDs = ["com.apple.webapp", "com.apple.WebSheet"]

    override func setUp() {
        continueAfterFailure = false
    }

    func testAddToHomeScreenThenOpenStandalone() throws {
        // 1. Open the live site in Safari.
        safari.launch()
        tapFirst(["Continue", "Not Now"], in: safari, timeout: 3)
        XCUIDevice.shared.system.open(URL(string: liveURL)!)
        if !waitFor("Welcome", in: safari, timeout: 45) {
            if let address = firstHittable(["Address", "URL", "TabBarItemTitle"], in: safari) {
                address.tap()
                safari.typeText(liveURL + "\n")
            }
        }
        try require(waitFor("Welcome", in: safari, timeout: 60), "the live site did not load in Safari", safari)
        shot("1-safari")

        // 2. Share → Add to Home Screen → Add.
        if tapFirst(["Share", "ShareButton"], in: safari, timeout: 10) == nil {
            // iOS 26 Safari keeps Share behind the "•••" button.
            shot("2a-safari-toolbar")
            try require(
                tapFirst(
                    ["More", "MoreButton", "More options", "Page Menu", "PageFormatMenuButton", "Menu"],
                    in: safari) != nil,
                "Safari shows no Share or More button", safari)
            sleep(1)
            shot("2b-safari-menu")
            if firstHittable(["Add to Home Screen"], in: safari) == nil {
                try require(
                    tapFirst(["Share", "ShareButton"], in: safari) != nil,
                    "Safari's menu has no Share", safari)
            }
        }
        _ = matches("Add to Home Screen", in: safari).firstMatch.waitForExistence(timeout: 10)
        sleep(1)
        shot("2c-share-sheet")
        var addToHomeScreen: XCUIElement?
        for _ in 0..<6 {
            addToHomeScreen = firstHittable(["Add to Home Screen"], in: safari)
            if addToHomeScreen != nil { break }
            // Newer share sheets list a few actions and hide the rest behind View More.
            if let viewMore = firstHittable(["View More", "Show More", "More Actions"], in: safari) {
                viewMore.tap()
                sleep(1)
                continue
            }
            // The share sheet opens at half height; drag it up to reveal its actions.
            safari.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.8))
                .press(
                    forDuration: 0.05,
                    thenDragTo: safari.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.3)))
            sleep(1)
        }
        try require(addToHomeScreen != nil, "the share sheet has no Add to Home Screen", safari)
        addToHomeScreen!.tap()
        // The sheet prefills the home-screen name from apple-mobile-web-app-title.
        let name = safari.textFields.matching(NSPredicate(format: "value == %@", homeScreenTitle)).firstMatch
        try require(name.waitForExistence(timeout: 20), "the Add to Home Screen sheet has no \(homeScreenTitle) name", safari)
        sleep(1)
        shot("2-add-to-home-screen")
        try require(tapFirst(["Add"], in: safari) != nil, "could not tap Add", safari)

        // 3. The icon is on the home screen.
        if !springboard.wait(for: .runningForeground, timeout: 15) {
            XCUIDevice.shared.press(.home)
        }
        let icon = springboard.icons[homeScreenTitle]
        try require(icon.waitForExistence(timeout: 20), "no \(homeScreenTitle) icon on the home screen", springboard)
        for _ in 0..<6 where !icon.isHittable {
            springboard.swipeLeft()
            sleep(1)
        }
        for _ in 0..<12 where !icon.isHittable {
            springboard.swipeRight()
            sleep(1)
        }
        try require(icon.isHittable, "the \(homeScreenTitle) icon is not reachable", springboard)
        shot("3-home-screen")

        // 4. Opening the icon starts the app standalone, outside Safari.
        // (Safari's own state is not checked: iOS can briefly report it as
        // foreground while the web app's process is the one on screen.)
        icon.tap()
        let webApp = try foregroundWebApp()
        try require(waitFor("Welcome", in: webApp, timeout: 60), "the installed app did not render", webApp)
        XCTAssertFalse(
            firstHittable(["Address", "URL", "TabBarItemTitle", "Share", "ShareButton"], in: webApp) != nil,
            "the installed app shows Safari's address bar or toolbar")
        shot("4-installed-app")

        // 5. It works as the app: first run → the first workout.
        try require(tapFirst(["Get started"], in: webApp) != nil, "could not tap Get started", webApp)
        try require(waitFor("Push", in: webApp, timeout: 30), "Today did not open in the installed app", webApp)
        sleep(1)
        shot("5-installed-app-today")
        print("PASS: added to the iPhone home screen and opened standalone")
    }

    // MARK: - Helpers

    private func matches(_ name: String, in app: XCUIApplication) -> XCUIElementQuery {
        app.descendants(matching: .any)
            .matching(NSPredicate(format: "identifier == %@ OR label == %@", name, name))
    }

    private func waitFor(_ name: String, in app: XCUIApplication, timeout: TimeInterval) -> Bool {
        matches(name, in: app).firstMatch.waitForExistence(timeout: timeout)
    }

    private func firstHittable(_ names: [String], in app: XCUIApplication) -> XCUIElement? {
        for name in names {
            for element in matches(name, in: app).allElementsBoundByIndex where element.isHittable {
                return element
            }
        }
        return nil
    }

    /// Taps the first of `names` that becomes hittable within `timeout`; returns its name.
    @discardableResult
    private func tapFirst(_ names: [String], in app: XCUIApplication, timeout: TimeInterval = 15)
        -> String?
    {
        let deadline = Date().addingTimeInterval(timeout)
        repeat {
            for name in names {
                if let element = firstHittable([name], in: app) {
                    element.tap()
                    return name
                }
            }
            sleep(1)
        } while Date() < deadline
        return nil
    }

    private func foregroundWebApp() throws -> XCUIApplication {
        let deadline = Date().addingTimeInterval(30)
        repeat {
            for id in webAppIDs {
                let app = XCUIApplication(bundleIdentifier: id)
                if app.state == .runningForeground {
                    print("The installed app runs as \(id)")
                    return app
                }
            }
            sleep(1)
        } while Date() < deadline
        let states = (webAppIDs + ["com.apple.mobilesafari", "com.apple.springboard"])
            .map { "\($0)=\(XCUIApplication(bundleIdentifier: $0).state.rawValue)" }
            .joined(separator: ", ")
        shot("fail")
        XCTFail("the installed app did not open in its own process (\(states))")
        throw CheckFailed(message: states)
    }

    private struct CheckFailed: Error {
        let message: String
    }

    private func require(_ ok: Bool, _ message: String, _ app: XCUIApplication) throws {
        guard !ok else { return }
        shot("fail")
        print("UI tree when '\(message)':\n\(app.debugDescription)")
        XCTFail(message)
        throw CheckFailed(message: message)
    }

    /// Keeps the screenshot in the result bundle and prints a small JPEG of it to
    /// the log, so it can be reviewed from the CI run log.
    private func shot(_ name: String) {
        let screenshot = XCUIScreen.main.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
        let image = screenshot.image
        let width: CGFloat = 390
        let size = CGSize(width: width, height: (image.size.height * width / image.size.width).rounded())
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let small = UIGraphicsImageRenderer(size: size, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: size))
        }
        if let jpeg = small.jpegData(compressionQuality: 0.6) {
            print("IOS_SCREENSHOT \(name) \(jpeg.base64EncodedString())")
        }
    }
}
