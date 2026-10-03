import XCTest
@testable import WeddingNativeCore

final class NavigationPolicyTests: XCTestCase {
    func testMainNavigationDoesNotInterruptEditingOrLogin() {
        for path in ["/", "/templates", "/my"] {
            XCTAssertTrue(NavigationPolicy.showsMainNavigation(path: path))
        }
        for path in ["/builder/draft", "/preview/draft", "/i/invitation", "/auth/callback", "/login", "/dashboard/draft/responses"] {
            XCTAssertFalse(NavigationPolicy.showsMainNavigation(path: path))
        }
    }
    func testOnlyCanonicalHTTPSOriginIsInternal() {
        XCTAssertTrue(NavigationPolicy.isInternal(NavigationPolicy.site.appendingPathComponent("templates")))
        for s in ["http://wedding-invitation-2026-10-02.jyb1126.chatgpt.site", "https://wedding-invitation-2026-10-02.jyb1126.chatgpt.site.evil.test", "https://evil.test", "https://u:p@wedding-invitation-2026-10-02.jyb1126.chatgpt.site", "https://wedding-invitation-2026-10-02.jyb1126.chatgpt.site:444/"] {
            XCTAssertFalse(NavigationPolicy.isInternal(URL(string:s)!))
        }
    }
    func testLegacyLoginLinksDoNotImportCookiesIntoNewApp() {
        XCTAssertFalse(NavigationPolicy.isAuthLink(URL(string:NavigationPolicy.site.absoluteString + "/auth/callback?code=example")!))
        XCTAssertFalse(NavigationPolicy.isInternal(URL(string:"https://osamosam-app.jyb1126.chatgpt.site/my")!))
    }
    func testPrivateDraftAndAuthURLsCannotBeShared() {
        XCTAssertNil(NavigationPolicy.publicInvitation(NavigationPolicy.site.appendingPathComponent("builder/private-id")))
        XCTAssertNil(NavigationPolicy.publicInvitation(URL(string:NavigationPolicy.site.absoluteString + "/auth/callback?code=secret")!))
        let share = NavigationPolicy.publicInvitation(URL(string:NavigationPolicy.site.absoluteString + "/i/abcdef123456?secret=yes#fragment")!)
        XCTAssertEqual(share?.absoluteString, NavigationPolicy.site.absoluteString + "/i/abcdef123456")
    }
    func testDownloadOriginAndTypeAreBounded() {
        XCTAssertTrue(NavigationPolicy.isInternalBlob(URL(string:"blob:" + NavigationPolicy.site.absoluteString + "/fixture")!))
        XCTAssertFalse(NavigationPolicy.isInternalBlob(URL(string:"blob:https://evil.test/fixture")!))
        XCTAssertEqual(NavigationPolicy.downloadExtension(mime:"image/png",filename:"../../invitation.png"),"png")
        XCTAssertNil(NavigationPolicy.downloadExtension(mime:"image/png",filename:"script.html"))
        XCTAssertNil(NavigationPolicy.downloadExtension(mime:"application/javascript",filename:"script.js"))
        XCTAssertFalse(NavigationPolicy.externalLinkAllowed(URL(string:"javascript:alert(1)")!))
        XCTAssertFalse(NavigationPolicy.externalLinkAllowed(URL(string:"file:///etc/passwd")!))
    }
}
