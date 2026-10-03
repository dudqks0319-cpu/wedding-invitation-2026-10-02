import SwiftUI

@main struct WeddingApp: App {
    var body: some Scene {
        WindowGroup { WeddingView().environment(\.locale, Locale(identifier: "ko_KR")) }
    }
}
