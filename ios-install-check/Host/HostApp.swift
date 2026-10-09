import SwiftUI

// UI tests need a host app to attach to; the test itself drives Safari and the
// home screen, so this app only exists to be installed.
@main
struct HostApp: App {
    var body: some Scene {
        WindowGroup {
            Text("Install check")
        }
    }
}
