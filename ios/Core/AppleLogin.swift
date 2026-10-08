import Foundation

public struct AppleLoginAttempt: Decodable {
    public let id: String
    public let nonce: String
    public var valid: Bool {
        UUID(uuidString: id) != nil && nonce.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil
    }
    public static func challengeRequest() -> URLRequest {
        request(path: "challenge", body: [:])
    }
    public func completion(identityToken: Data, authorizationCode: Data, state: String?) -> URLRequest? {
        guard valid, state == id, identityToken.count <= 8192, authorizationCode.count <= 2048,
              let token = String(data: identityToken, encoding: .utf8), !token.isEmpty,
              let code = String(data: authorizationCode, encoding: .utf8), !code.isEmpty else { return nil }
        return Self.request(path: "complete", body: ["flowId": id, "identityToken": token, "authorizationCode": code])
    }
    private static func request(path: String, body: [String: String]) -> URLRequest {
        var request = URLRequest(url: NavigationPolicy.site.appendingPathComponent("api/v2/auth/apple/" + path), timeoutInterval: 20)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(NavigationPolicy.site.absoluteString, forHTTPHeaderField: "Origin")
        request.setValue(UUID().uuidString.lowercased(), forHTTPHeaderField: "Idempotency-Key")
        request.httpBody = try? JSONEncoder().encode(body)
        return request
    }
}
