import Foundation
import CryptoKit

public struct NativeLogin {
    public static let scheme = "com.invitehub.wedding-preview"
    public let state: String
    public let verifier: String
    public init() {
        state = Self.nonce()
        verifier = Self.nonce()
    }
    private static func nonce() -> String {
        SymmetricKey(size: .bits256).withUnsafeBytes { bytes in
            bytes.map { String(format: "%02x", $0) }.joined()
        }
    }
    public static func isStart(_ url: URL) -> Bool {
        NavigationPolicy.isInternal(url) && ["/auth/kakao", "/auth/google"].contains(url.path)
            && url.query == nil && url.fragment == nil
    }
    public func startURL(_ url: URL) -> URL? {
        guard Self.isStart(url), var parts = URLComponents(url: NavigationPolicy.site.appendingPathComponent("api/v2/auth/native/start"), resolvingAgainstBaseURL: false) else { return nil }
        let digest = Data(SHA256.hash(data: Data(verifier.utf8))).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
        parts.queryItems = [URLQueryItem(name: "provider", value: url.lastPathComponent), URLQueryItem(name: "challenge", value: digest), URLQueryItem(name: "state", value: state)]
        return parts.url
    }
    public func redemption(_ callback: URL) -> URLRequest? {
        guard callback.scheme == Self.scheme, callback.host == "auth", callback.path.isEmpty,
              callback.user == nil, callback.password == nil, callback.port == nil, callback.fragment == nil,
              callback.absoluteString.utf8.count < 512,
              let items = URLComponents(url: callback, resolvingAgainstBaseURL: false)?.queryItems,
              items.count == 2, items.filter({ $0.name == "state" }).count == 1,
              items.first(where: { $0.name == "state" })?.value == state,
              items.filter({ $0.name == "code" }).count == 1,
              let code = items.first(where: { $0.name == "code" })?.value,
              code.range(of: "^[a-f0-9]{48}$", options: .regularExpression) != nil else { return nil }
        var request = URLRequest(url: NavigationPolicy.site.appendingPathComponent("api/v2/auth/native/redeem"), timeoutInterval: 25)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(NavigationPolicy.site.absoluteString, forHTTPHeaderField: "Origin")
        request.setValue(UUID().uuidString, forHTTPHeaderField: "Idempotency-Key")
        request.httpBody = try? JSONEncoder().encode(["code": code, "verifier": verifier, "state": state, "next": "/my"])
        return request
    }
}
