import XCTest
@testable import WeddingNativeCore

final class NativeLoginTests: XCTestCase {
    func testStartsOnlyExactProviderPathAndKeepsVerifierOutOfURL() throws {
        let attempt = NativeLogin()
        let url = try XCTUnwrap(attempt.startURL(NavigationPolicy.site.appendingPathComponent("auth/google")))
        XCTAssertFalse(url.absoluteString.contains(attempt.verifier))
        let items = try XCTUnwrap(URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems)
        XCTAssertEqual(items.first(where: { $0.name == "challenge" })?.value?.count, 43)
        XCTAssertEqual(url.path, "/api/v2/auth/native/start")
        XCTAssertEqual(items.first(where: { $0.name == "provider" })?.value, "google")
        XCTAssertEqual(attempt.state.count, 64)
        XCTAssertNotEqual(attempt.state, NativeLogin().state)
        for path in ["https://evil.test/auth/google", NavigationPolicy.site.absoluteString + "/auth/google?redirect=evil", NavigationPolicy.site.absoluteString + "/auth/google/callback"] {
            XCTAssertNil(attempt.startURL(URL(string: path)!))
        }
    }
    func testCallbackIsBoundToAttemptAndRedeemsOnlyWithPOST() throws {
        let attempt = NativeLogin()
        let code = String(repeating: "a", count: 48)
        let value = "com.invitehub.wedding-preview://auth?code=\(code)&state=\(attempt.state)"
        let request = try XCTUnwrap(attempt.redemption(URL(string: value)!))
        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertNotNil(UUID(uuidString: request.value(forHTTPHeaderField: "Idempotency-Key") ?? ""))
        XCTAssertEqual(request.url?.path, "/api/v2/auth/native/redeem")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Origin"), NavigationPolicy.site.absoluteString)
        let body = try JSONDecoder().decode([String: String].self, from: XCTUnwrap(request.httpBody))
        XCTAssertEqual(body["verifier"], attempt.verifier)
        XCTAssertNil(NativeLogin().redemption(URL(string: value)!))
        for bad in [value + "&code=another", value + "#fragment", value.replacingOccurrences(of: "://auth?", with: "://evil?"), value.replacingOccurrences(of: "com.invitehub.wedding-preview:", with: "https:"), value.replacingOccurrences(of: code, with: "bad")] {
            XCTAssertNil(attempt.redemption(URL(string: bad)!))
        }
    }
}
