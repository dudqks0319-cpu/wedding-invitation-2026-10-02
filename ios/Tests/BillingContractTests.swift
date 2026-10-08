import XCTest
@testable import WeddingNativeCore

final class BillingContractTests: XCTestCase {
    func testPurchaseNeedsApprovedOfferLiveReservationAndMatchingProduct() throws {
        let now = Date(), token = UUID(), reservation = UUID()
        func preparation(_ enabled: Bool = true, _ product: String = BillingContract.productID,
                         _ expires: Double? = nil, _ benefit: String = "행사 사용권") throws -> BillingPreparation {
            let object: [String: Any] = ["enabled": enabled, "productId": product, "appAccountToken": token.uuidString,
                "reservationId": reservation.uuidString, "expiresAt": expires ?? now.timeIntervalSince1970 * 1000 + 60000,
                "benefitDescription": benefit]
            return try JSONDecoder().decode(BillingPreparation.self, from: JSONSerialization.data(withJSONObject: object))
        }
        XCTAssertTrue(try preparation().canStart(now: now))
        XCTAssertFalse(try preparation(false).canStart(now: now))
        XCTAssertFalse(try preparation(true, "other.app.product").canStart(now: now))
        XCTAssertFalse(try preparation(true, BillingContract.productID, now.timeIntervalSince1970 * 1000).canStart(now: now))
        XCTAssertFalse(try preparation(true, BillingContract.productID, now.timeIntervalSince1970 * 1000 + 300001).canStart(now: now))
        XCTAssertFalse(try preparation(true, BillingContract.productID, nil, " ").canStart(now: now))
    }
    func testFinishNeedsDurableMatchingAccountAndTransactionReceipt() throws {
        let account = UUID()
        func receipt(_ durable: Bool = true, _ id: String = "9007199254740993", _ product: String = BillingContract.productID,
                     _ state: String = "credited", _ token: UUID? = nil) throws -> BillingReceipt {
            let input: [String: Any] = ["durablyRecorded": durable, "transactionId": id, "productId": product,
                "state": state, "appAccountToken": (token ?? account).uuidString]
            return try JSONDecoder().decode(BillingReceipt.self, from: JSONSerialization.data(withJSONObject: input))
        }
        XCTAssertTrue(try receipt().canFinish(transactionID: "9007199254740993", accountToken: account))
        XCTAssertTrue(try receipt(true, "9007199254740993", BillingContract.productID, "refunded").canFinish(transactionID: "9007199254740993", accountToken: account))
        for invalid in [try receipt(false), try receipt(true, "9007199254740992"), try receipt(true, "9007199254740993", "other.product"),
                        try receipt(true, "9007199254740993", BillingContract.productID, "pending"),
                        try receipt(true, "9007199254740993", BillingContract.productID, "credited", UUID())] {
            XCTAssertFalse(invalid.canFinish(transactionID: "9007199254740993", accountToken: account))
        }
    }
    func testBillingRequestsKeepSessionAndSignedTransactionOffURLs() throws {
        let request = try XCTUnwrap(BillingContract.request(.deliver, signedTransaction: "synthetic.signed.fixture"))
        XCTAssertEqual(request.url?.host, NavigationPolicy.site.host)
        XCTAssertEqual(request.url?.path, "/api/v2/billing/deliver")
        XCTAssertNil(request.url?.query)
        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertNil(request.value(forHTTPHeaderField: "Cookie"))
        XCTAssertEqual(request.value(forHTTPHeaderField: "Origin"), NavigationPolicy.site.absoluteString)
        XCTAssertNil(BillingContract.request(.deliver))
        XCTAssertNil(BillingContract.request(.deliver, signedTransaction: String(repeating: "a", count: 32769)))
        XCTAssertEqual(BillingContract.request(.summary)?.httpMethod, "GET")
        XCTAssertNil(BillingContract.request(.summary)?.httpBody)
    }
}
