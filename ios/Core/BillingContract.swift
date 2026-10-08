import Foundation

public enum BillingContract {
    public static let productID = "com.invitehub.wedding-preview.event-credit.v1"
    public enum Action: String { case prepare, deliver, summary }
    public static func request(_ action: Action, signedTransaction: String? = nil) -> URLRequest? {
        if action == .deliver {
            guard let signedTransaction, !signedTransaction.isEmpty, signedTransaction.utf8.count <= 32768 else { return nil }
        }
        var request = URLRequest(url: NavigationPolicy.site.appendingPathComponent("api/v2/billing/" + action.rawValue), timeoutInterval: 20)
        request.httpMethod = action == .summary ? "GET" : "POST"
        if action != .summary {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue(NavigationPolicy.site.absoluteString, forHTTPHeaderField: "Origin")
            request.setValue(UUID().uuidString.lowercased(), forHTTPHeaderField: "Idempotency-Key")
            request.httpBody = try? JSONEncoder().encode(signedTransaction.map { ["signedTransaction": $0] } ?? [:])
        }
        return request
    }
}

public struct BillingPreparation: Decodable {
    public let enabled: Bool
    public let productId: String
    public let appAccountToken: UUID
    public let reservationId: UUID
    public let expiresAt: Double
    public let benefitDescription: String
    public func canStart(now: Date = Date()) -> Bool {
        let remaining = expiresAt - now.timeIntervalSince1970 * 1000
        return enabled && productId == BillingContract.productID && remaining > 0 && remaining <= 300000
            && !benefitDescription.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && benefitDescription.utf8.count <= 2000
    }
}

public struct BillingReceipt: Decodable {
    public let transactionId: String
    public let productId: String
    public let appAccountToken: UUID
    public let state: String
    public let durablyRecorded: Bool
    public func canFinish(transactionID: String, accountToken: UUID) -> Bool {
        durablyRecorded && transactionId == transactionID && productId == BillingContract.productID
            && appAccountToken == accountToken && ["credited", "refunded"].contains(state)
    }
}

public struct BillingBalance: Decodable {
    public let available: Int
    public let refunded: Int
    public var valid: Bool { (0...10000).contains(available) && (0...10000).contains(refunded) }
}
