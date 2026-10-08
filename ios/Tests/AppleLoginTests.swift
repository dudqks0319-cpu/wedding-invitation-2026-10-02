import XCTest
@testable import WeddingNativeCore

final class AppleLoginTests: XCTestCase {
    func testCompletionPostsOnlyToServiceOriginWithBoundState() throws {
        let id = UUID().uuidString.lowercased()
        let attempt = try JSONDecoder().decode(AppleLoginAttempt.self, from: Data("{\"id\":\"\(id)\",\"nonce\":\"\(String(repeating: "a", count: 64))\"}".utf8))
        XCTAssertTrue(attempt.valid)
        let request = try XCTUnwrap(attempt.completion(identityToken: Data("fixture.jwt.token".utf8), authorizationCode: Data("fixture-code".utf8), state: id))
        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertEqual(request.url?.host, NavigationPolicy.site.host)
        XCTAssertEqual(request.url?.path, "/api/v2/auth/apple/complete")
        XCTAssertNil(request.url?.query)
        XCTAssertEqual(request.value(forHTTPHeaderField: "Origin"), NavigationPolicy.site.absoluteString)
        XCTAssertNotNil(UUID(uuidString: request.value(forHTTPHeaderField: "Idempotency-Key") ?? ""))
        XCTAssertNil(attempt.completion(identityToken: Data("token".utf8), authorizationCode: Data("code".utf8), state: UUID().uuidString))
        XCTAssertNil(attempt.completion(identityToken: Data(repeating: 65, count: 8193), authorizationCode: Data("code".utf8), state: id))
        XCTAssertNil(attempt.completion(identityToken: Data([255]), authorizationCode: Data("code".utf8), state: id))
        XCTAssertNil(attempt.completion(identityToken: Data("token".utf8), authorizationCode: Data(), state: id))
    }
    func testMalformedServerChallengeNeverStartsAppleRequest() throws {
        for input in ["{\"id\":\"not-uuid\",\"nonce\":\"abc\"}", "{\"id\":\"\(UUID().uuidString)\",\"nonce\":\"\(String(repeating: "x", count: 64))\"}"] {
            XCTAssertFalse(try JSONDecoder().decode(AppleLoginAttempt.self, from: Data(input.utf8)).valid)
        }
        let request = AppleLoginAttempt.challengeRequest()
        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertEqual(request.url?.path, "/api/v2/auth/apple/challenge")
        XCTAssertNil(request.url?.query)
    }
}
