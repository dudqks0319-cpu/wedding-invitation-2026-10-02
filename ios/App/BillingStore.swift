import SwiftUI
import StoreKit
import WebKit

private enum BillingIssue: Error { case unavailable, loginRequired, verification }
private final class BillingRedirectGuard: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}

@MainActor final class WeddingBillingStore: ObservableObject {
    @Published private(set) var product: Product?
    @Published private(set) var available = 0
    @Published private(set) var busy = false
    @Published private(set) var message: String?
    private var updates: Task<Void, Never>?
    private var delivering: Set<UInt64> = []
    deinit { updates?.cancel() }

    private func service<T: Decodable>(_ action: BillingContract.Action, store: WKHTTPCookieStore,
                                       signedTransaction: String? = nil) async throws -> T {
        guard var request = BillingContract.request(action, signedTransaction: signedTransaction),
              let cookie = await store.allCookies().first(where: {
                  $0.name == "__Host-osam-session" && $0.domain == NavigationPolicy.site.host && $0.isSecure
                    && $0.path == "/" && ($0.expiresDate.map { $0 > Date() } ?? true)
              }) else { throw BillingIssue.loginRequired }
        request.setValue(HTTPCookie.requestHeaderFields(with: [cookie])["Cookie"], forHTTPHeaderField: "Cookie")
        let config = URLSessionConfiguration.ephemeral
        config.httpShouldSetCookies = false
        config.timeoutIntervalForResource = 20
        let client = URLSession(configuration: config, delegate: BillingRedirectGuard(), delegateQueue: nil)
        defer { client.invalidateAndCancel() }
        let (stream, response) = try await client.bytes(for: request)
        guard let response = response as? HTTPURLResponse, response.url == request.url else { throw BillingIssue.unavailable }
        if response.statusCode == 401 { throw BillingIssue.loginRequired }
        guard response.statusCode == 200, response.value(forHTTPHeaderField: "Content-Type")?.hasPrefix("application/json") == true else { throw BillingIssue.unavailable }
        var data = Data()
        for try await byte in stream {
            guard data.count < 8192 else { throw BillingIssue.unavailable }
            data.append(byte)
        }
        let current = await store.allCookies().first(where: { $0.name == cookie.name && $0.domain == cookie.domain && $0.path == cookie.path })
        guard current?.value == cookie.value else { throw BillingIssue.loginRequired }
        return try JSONDecoder().decode(T.self, from: data)
    }
    private func explain(_ issue: Error) {
        available = 0
        message = (issue as? BillingIssue) == .loginRequired
            ? "구매한 서비스 계정으로 로그인해 주세요."
            : "구매 확인을 완료하지 못했어요. 결제가 완료된 거래는 다시 구매하지 말고 구매 내역 불러오기를 이용해 주세요."
    }
    func load(store: WKHTTPCookieStore) async {
        guard !busy else { return }
        busy = true; defer { busy = false }
        do {
            let products = try await Product.products(for: [BillingContract.productID])
            product = products.first(where: { $0.id == BillingContract.productID && $0.type == .consumable })
            try await refreshBalance(store: store)
            if updates == nil {
                updates = Task { [weak self] in
                    for await result in StoreKit.Transaction.updates {
                        guard !Task.isCancelled else { break }
                        await self?.deliver(result, store: store)
                    }
                }
            }
            await recover(store: store)
        } catch { explain(error) }
    }
    private func refreshBalance(store: WKHTTPCookieStore) async throws {
        let balance: BillingBalance = try await service(.summary, store: store)
        guard balance.valid else { throw BillingIssue.unavailable }
        available = balance.available
    }
    func purchase(store: WKHTTPCookieStore) async {
        guard !busy, let product else { return }
        busy = true; message = nil; defer { busy = false }
        do {
            // Server preflight must reserve budget/capacity before a chargeable StoreKit call.
            let ready: BillingPreparation = try await service(.prepare, store: store)
            guard ready.canStart(), ready.productId == product.id, ready.benefitDescription == product.description else { throw BillingIssue.unavailable }
            switch try await product.purchase(options: [.appAccountToken(ready.appAccountToken)]) {
            case .success(let result): await deliver(result, store: store)
            case .pending: message = "결제 승인을 기다리고 있어요. 완료 후 구매 내역을 확인할 수 있어요."
            case .userCancelled: message = "구매를 취소했어요."
            @unknown default: throw BillingIssue.unavailable
            }
        } catch { explain(error) }
    }
    private func deliver(_ result: VerificationResult<StoreKit.Transaction>, store: WKHTTPCookieStore) async {
        guard case .verified(let transaction) = result, transaction.productID == BillingContract.productID,
              let account = transaction.appAccountToken else { return }
        guard !delivering.contains(transaction.id), delivering.count < 4 else { return }
        delivering.insert(transaction.id); defer { delivering.remove(transaction.id) }
        do {
            let receipt: BillingReceipt = try await service(.deliver, store: store, signedTransaction: result.jwsRepresentation)
            guard receipt.canFinish(transactionID: String(transaction.id), accountToken: account) else { throw BillingIssue.verification }
            // A locally verified StoreKit transaction alone never grants credit or gets finished.
            await transaction.finish()
            try await refreshBalance(store: store)
            message = receipt.state == "credited" ? "구매 내역을 확인했어요." : "환불된 구매 기록을 반영했어요."
        } catch { explain(error) }
    }
    private func recover(store: WKHTTPCookieStore) async {
        var count = 0
        for await result in StoreKit.Transaction.unfinished {
            guard count < 20, !Task.isCancelled else { break }
            if case .verified(let transaction) = result, transaction.productID == BillingContract.productID {
                count += 1; await deliver(result, store: store)
            }
        }
    }
    func restore(store: WKHTTPCookieStore) async {
        guard !busy else { return }
        busy = true; message = nil; defer { busy = false }
        do {
            // Consumable history is restored from the same service account, not currentEntitlements.
            try await refreshBalance(store: store)
            try await AppStore.sync()
            await recover(store: store)
            try await refreshBalance(store: store)
        } catch { explain(error) }
    }
}

struct WeddingBillingView: View {
    let cookieStore: WKHTTPCookieStore
    @StateObject private var billing = WeddingBillingStore()
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        NavigationStack {
            List {
                Section("내 사용권") { Text("미사용 사용권 \(billing.available)개") }
                Section {
                    if let product = billing.product {
                        Text(product.displayName)
                        Text(product.description)
                        Button("\(product.displayPrice)에 구매") { Task { await billing.purchase(store: cookieStore) } }
                            .disabled(billing.busy)
                    } else { Text("구매할 수 있는 상품을 확인하고 있어요.") }
                    Button("구매 내역 불러오기") { Task { await billing.restore(store: cookieStore) } }.disabled(billing.busy)
                    Link("Apple 구매·환불 안내", destination: URL(string: "https://reportaproblem.apple.com/")!)
                    Text("소모성 사용권은 구매한 서비스 계정으로 로그인하면 다시 불러올 수 있어요.")
                        .font(.footnote).foregroundStyle(.secondary)
                }
                if let message = billing.message { Section { Text(message).accessibilityLabel(message) } }
                if billing.busy { ProgressView("확인 중") }
            }.navigationTitle("구매 내역")
                .toolbar { ToolbarItem(placement: .confirmationAction) { Button("닫기") { dismiss() } } }
        }.task { await billing.load(store: cookieStore) }
    }
}
