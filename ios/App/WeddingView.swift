import SwiftUI
import WebKit
import SafariServices
import UniformTypeIdentifiers
import OSLog
import AuthenticationServices

struct ShareFile: Identifiable { let id = UUID(); let url: URL }

private final class DownloadBridge: NSObject, WKScriptMessageHandler {
    weak var owner: WebSession?
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        Task { @MainActor in
            if message.name == "weddingAuth" { owner?.receiveLogin(message) }
            else { owner?.receiveDownload(message) }
        }
    }
}

@MainActor final class WebSession: NSObject, ObservableObject, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate, ASWebAuthenticationPresentationContextProviding {
    let webView: WKWebView
    @Published var canGoBack = false
    @Published var loading = true
    @Published var error: String?
    @Published var shareFile: ShareFile? {
        didSet { if let file = shareFile, file.url.isFileURL { temporaryShareURL = file.url } }
    }
    @Published var safariURL: ShareFile?
    @Published var shareURL: URL?
    @Published var currentPath = "/"
    private var observations: [NSKeyValueObservation] = []
    private var downloads: [ObjectIdentifier: URL] = [:]
    private var activeDownloads: [ObjectIdentifier: WKDownload] = [:]
    private var downloadProgress: [ObjectIdentifier: NSKeyValueObservation] = [:]
    private var recoveredWebProcess = false
    private var temporaryShareURL: URL?
    private var authenticationSession: ASWebAuthenticationSession?

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        webView.window ?? ASPresentationAnchor()
    }
    func beginLogin(_ url: URL) {
        guard authenticationSession == nil, webView.window != nil else { return }
        let attempt = NativeLogin()
        guard let start = attempt.startURL(url) else { return }
        error = nil
        let auth = ASWebAuthenticationSession(url: start, callbackURLScheme: NativeLogin.scheme) { [weak self] callback, issue in
            Task { @MainActor in
                guard let self else { return }
                self.authenticationSession = nil
                if let issue = issue as? ASWebAuthenticationSessionError, issue.code == .canceledLogin { return }
                guard issue == nil, let callback, let request = attempt.redemption(callback) else {
                    self.error = "로그인을 완료하지 못했어요. 다시 로그인해 주세요."
                    return
                }
                // WebKit receives the HttpOnly cookie directly from our server.
                // Neither a provider token nor an app session appears in the callback.
                self.webView.load(request)
            }
        }
        auth.presentationContextProvider = self
        authenticationSession = auth
        if !auth.start() {
            authenticationSession = nil
            error = "로그인 창을 열지 못했어요. 다시 시도해 주세요."
        }
    }

    init(startImmediately: Bool = true) {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true
        configuration.userContentController.addUserScript(WKUserScript(source: Self.downloadScript, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        let bridge = DownloadBridge()
        configuration.userContentController.add(bridge, name: "osamDownload")
        configuration.userContentController.add(bridge, name: "weddingAuth")
        webView = WKWebView(frame: .zero, configuration: configuration)
        super.init()
        bridge.owner = self
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.keyboardDismissMode = .interactive
        observations = [
            webView.observe(\.canGoBack, options: [.new]) { [weak self] view, _ in Task { @MainActor in self?.canGoBack = view.canGoBack } },
            webView.observe(\.isLoading, options: [.new]) { [weak self] view, _ in Task { @MainActor in self?.loading = view.isLoading } },
            webView.observe(\.url, options: [.new]) { [weak self] view, _ in Task { @MainActor in
                self?.shareURL = view.url.flatMap(NavigationPolicy.publicInvitation)
                if let url = view.url, NavigationPolicy.isInternal(url) { self?.currentPath = url.path }
            } }
        ]
        if startImmediately { open(NavigationPolicy.site) }
    }
    func open(_ url: URL) {
        guard NavigationPolicy.isInternal(url) || NavigationPolicy.isAuthLink(url) else { return }
        error = nil
        webView.load(URLRequest(url: url, timeoutInterval: 25))
    }
    func retry() {
        error = nil
        if webView.url == nil { open(NavigationPolicy.site) } else { webView.reload() }
    }
    fileprivate func receiveLogin(_ message: WKScriptMessage) {
        let origin = message.frameInfo.securityOrigin
        guard message.frameInfo.isMainFrame, origin.protocol == "https",
              origin.host == NavigationPolicy.site.host, origin.port == 0 || origin.port == 443,
              let provider = message.body as? String, ["google", "kakao"].contains(provider) else { return }
        beginLogin(NavigationPolicy.site.appendingPathComponent("auth/" + provider))
    }
    private func openExternal(_ url: URL) {
        guard NavigationPolicy.externalLinkAllowed(url) else { return }
        if url.scheme == "https" { safariURL = ShareFile(url: url) }
        else { UIApplication.shared.open(url) }
    }
    func webView(_ view: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { decisionHandler(.cancel); return }
        let trustedSource = action.sourceFrame.request.url.map(NavigationPolicy.isInternal) ?? false
        if trustedSource && action.targetFrame?.isMainFrame != false && NativeLogin.isStart(url) {
            decisionHandler(.cancel)
            beginLogin(url)
        } else if action.shouldPerformDownload || NavigationPolicy.isInternalBlob(url) {
            Logger(subsystem: "com.invitehub.wedding-preview", category: "download").debug("Download navigation: trusted=\(trustedSource), scheme=\(url.scheme ?? "none", privacy: .public)")
            decisionHandler(trustedSource && (NavigationPolicy.isInternal(url) || NavigationPolicy.isInternalBlob(url)) ? .download : .cancel)
        } else if NavigationPolicy.isInternal(url) || NavigationPolicy.isAuthLink(url) || url.absoluteString == "about:blank" {
            decisionHandler(.allow)
        } else if action.targetFrame?.isMainFrame == false && url.scheme == "https" {
            decisionHandler(.allow)
        } else {
            if trustedSource && (action.navigationType == .linkActivated || action.targetFrame == nil) { openExternal(url) }
            decisionHandler(.cancel)
        }
    }
    func webView(_ view: WKWebView, decidePolicyFor response: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        if let http = response.response as? HTTPURLResponse, let url = http.url,
           NavigationPolicy.isInternal(url), url.path == "/api/v2/auth/native/redeem", http.statusCode >= 400 {
            error = "로그인을 완료하지 못했어요. 다시 로그인해 주세요."
            decisionHandler(.cancel)
        } else if !response.canShowMIMEType, let url = response.response.url, NavigationPolicy.isInternal(url) {
            decisionHandler(.download)
        } else { decisionHandler(.allow) }
    }
    func webView(_ view: WKWebView, didFinish navigation: WKNavigation!) { error = nil; recoveredWebProcess = false }
    func webView(_ view: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError issue: Error) { showLoadError(issue) }
    func webView(_ view: WKWebView, didFail navigation: WKNavigation!, withError issue: Error) { showLoadError(issue) }
    private func showLoadError(_ issue: Error) {
        guard (issue as NSError).code != NSURLErrorCancelled else { return }
        loading = false; error = "청첩장을 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요."
    }
    func webViewWebContentProcessDidTerminate(_ view: WKWebView) {
        if !recoveredWebProcess { recoveredWebProcess = true; view.reload() }
        else { error = "화면을 다시 열어 주세요. 저장된 초안은 지우지 않습니다." }
    }
    func webView(_ view: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        guard let url = action.request.url, action.sourceFrame.request.url.map(NavigationPolicy.isInternal) == true else { return nil }
        if NativeLogin.isStart(url) { beginLogin(url) }
        else if NavigationPolicy.isInternal(url) || NavigationPolicy.isAuthLink(url) { open(url) } else { openExternal(url) }
        return nil
    }
    private func begin(_ download: WKDownload) {
        activeDownloads[ObjectIdentifier(download)] = download
        download.delegate = self
    }
    func webView(_ view: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) { begin(download) }
    func webView(_ view: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) { begin(download) }
    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        guard let url = response.url, NavigationPolicy.isInternal(url) || NavigationPolicy.isInternalBlob(url),
              response.expectedContentLength <= NavigationPolicy.maximumDownloadBytes,
              let ext = NavigationPolicy.downloadExtension(mime: response.mimeType, filename: suggestedFilename) else {
            error = "이 파일은 앱에서 저장할 수 없어요."; completionHandler(nil); return
        }
        do {
            let folder = FileManager.default.temporaryDirectory.appendingPathComponent("WeddingShare/\(UUID().uuidString)")
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
            let target = folder.appendingPathComponent("청첩장.\(ext)")
            let id = ObjectIdentifier(download)
            downloads[id] = target
            downloadProgress[id] = download.progress.observe(\.completedUnitCount, options: [.new]) { progress, _ in
                if progress.completedUnitCount > NavigationPolicy.maximumDownloadBytes { download.cancel { _ in } }
            }
            completionHandler(target)
        } catch { self.error = "파일 저장 공간을 확인해 주세요."; completionHandler(nil) }
    }
    func downloadDidFinish(_ download: WKDownload) {
        let id = ObjectIdentifier(download); downloadProgress.removeValue(forKey: id)
        defer { activeDownloads.removeValue(forKey: id) }
        guard let url = downloads.removeValue(forKey: id),
              let size = try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize,
              size > 0, Int64(size) <= NavigationPolicy.maximumDownloadBytes else { error = "다운로드 파일을 확인하지 못했어요."; return }
        try? FileManager.default.setAttributes([.posixPermissions: 0o600, .protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: url.path)
        shareFile = ShareFile(url: url)
    }
    func download(_ download: WKDownload, didFailWithError issue: Error, resumeData: Data?) {
        let id = ObjectIdentifier(download); downloadProgress.removeValue(forKey: id)
        activeDownloads.removeValue(forKey: id)
        if let url = downloads.removeValue(forKey: id) { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }
        error = "파일을 받지 못했어요. 10MB 이하 파일인지 확인하고 다시 시도해 주세요."
    }
    func finishSharing() {
        if let url = temporaryShareURL { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }
        temporaryShareURL = nil
        shareFile = nil
    }
    fileprivate func receiveDownload(_ message: WKScriptMessage) {
        let origin = message.frameInfo.securityOrigin
        guard message.frameInfo.isMainFrame, origin.protocol == "https", origin.host == NavigationPolicy.site.host,
              origin.port == 0 || origin.port == 443, shareFile == nil,
              let body = message.body as? [String: String] else { return }
        if body["error"] == "download" { error = "파일을 준비하지 못했어요. 다시 시도해 주세요."; return }
        guard
              let encoded = body["data"], encoded.utf8.count <= 14_000_000,
              let ext = NavigationPolicy.downloadExtension(mime: body["type"], filename: body["name"] ?? ""),
              let data = Data(base64Encoded: encoded), !data.isEmpty,
              Int64(data.count) <= NavigationPolicy.maximumDownloadBytes else { return }
        do {
            let folder = FileManager.default.temporaryDirectory.appendingPathComponent("WeddingShare/\(UUID().uuidString)")
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
            let url = folder.appendingPathComponent("청첩장.\(ext)")
            try data.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
            try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: url.path)
            shareFile = ShareFile(url: url)
        } catch { self.error = "파일 저장 공간을 확인해 주세요." }
    }
    // The web editor exports in-memory Blob files using detached download links.
    // Forward only those files; ordinary navigation remains WebKit's responsibility.
    private static let downloadScript = """
    (() => {
      if (location.origin !== 'https://wedding-invitation-2026-10-02.jyb1126.chatgpt.site') return;
      const original = HTMLAnchorElement.prototype.click;
      let busy = false;
      function transfer(anchor) {
        if (!anchor.download || !anchor.href.startsWith('blob:' + location.origin + '/')) return false;
        if (busy) return true;
        busy = true;
        fetch(anchor.href).then(r => r.blob()).then(blob => {
          if (!blob.size || blob.size > 10485760) throw new Error('size');
          return new Promise((resolve, reject) => {
            const reader = new FileReader(); reader.onerror = reject;
            reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.readAsDataURL(blob);
          }).then(data => window.webkit.messageHandlers.osamDownload.postMessage({name: anchor.download, type: blob.type, data}));
        }).catch(() => window.webkit.messageHandlers.osamDownload.postMessage({error:'download'})).finally(() => { busy = false; });
        return true;
      }
      HTMLAnchorElement.prototype.click = function() { if (!transfer(this)) return original.call(this); };
      document.addEventListener('click', event => {
        const anchor = event.target.closest && event.target.closest('a[download]');
        if (anchor && transfer(anchor)) event.preventDefault();
      }, true);
    })();
    """
}

private struct Website: UIViewRepresentable {
    let session: WebSession
    func makeUIView(context: Context) -> WKWebView { session.webView }
    func updateUIView(_ view: WKWebView, context: Context) {}
}
private struct SafariSheet: UIViewControllerRepresentable {
    let url: URL
    func makeUIViewController(context: Context) -> SFSafariViewController { SFSafariViewController(url: url) }
    func updateUIViewController(_ controller: SFSafariViewController, context: Context) {}
}
private struct ShareSheet: UIViewControllerRepresentable {
    let url: URL
    let completed: () -> Void
    func makeUIViewController(context: Context) -> UIActivityViewController {
        let controller = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        controller.completionWithItemsHandler = { _, _, _, _ in completed() }
        return controller
    }
    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}

struct WeddingView: View {
    @StateObject private var session = WebSession()
    var body: some View {
        NavigationStack {
            ZStack(alignment: .top) {
                Website(session: session)
                if session.loading { ProgressView().padding(12).background(.regularMaterial, in: Capsule()).padding(8) }
                if let error = session.error {
                    VStack(spacing: 12) {
                        Text(error).multilineTextAlignment(.center)
                        Button("다시 시도") { session.retry() }.buttonStyle(.borderedProminent)
                        Button("닫기") { session.error = nil }.buttonStyle(.bordered)
                    }.padding(24).background(.regularMaterial, in: RoundedRectangle(cornerRadius: 20)).padding()
                }
            }.navigationTitle("청첩장").navigationBarTitleDisplayMode(.inline)
                .safeAreaInset(edge: .bottom, spacing: 0) {
                    if NavigationPolicy.showsMainNavigation(path: session.currentPath) {
                        HStack(spacing: 0) {
                            navigationButton("홈", symbol: "house", path: "/")
                            navigationButton("디자인", symbol: "rectangle.grid.2x2", path: "/templates")
                            navigationButton("내 초대장", symbol: "envelope", path: "/my")
                        }.padding(.top, 8).padding(.bottom, 4).background(.regularMaterial)
                    }
                }
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        Button { session.webView.goBack() } label: { Label("뒤로", systemImage: "chevron.left") }.disabled(!session.canGoBack)
                    }
                    ToolbarItem(placement: .topBarTrailing) {
                        Menu {
                            Button("새로고침", systemImage: "arrow.clockwise") { session.retry() }
                            Button("간편 로그인", systemImage: "person.crop.circle") { session.open(NavigationPolicy.site.appendingPathComponent("login")) }
                            Button("카카오로 로그인", systemImage: "message") { session.beginLogin(NavigationPolicy.site.appendingPathComponent("auth/kakao")) }
                            Button("Google로 로그인", systemImage: "person.crop.circle.badge.checkmark") { session.beginLogin(NavigationPolicy.site.appendingPathComponent("auth/google")) }
                            if let url = session.shareURL { Button("초대장 공유", systemImage: "square.and.arrow.up") { session.shareFile = ShareFile(url: url) } }
                            Button("브라우저에서 열기", systemImage: "safari") { session.safariURL = ShareFile(url: session.webView.url.flatMap { NavigationPolicy.isInternal($0) ? $0 : nil } ?? NavigationPolicy.site) }
                        } label: { Label("더 보기", systemImage: "ellipsis.circle") }
                    }
                }
        }.tint(Color(red: 0.94, green: 0.32, blue: 0.47))
            .sheet(item: $session.safariURL) { SafariSheet(url: $0.url) }
            .sheet(item: $session.shareFile, onDismiss: { session.finishSharing() }) { file in ShareSheet(url: file.url) { session.finishSharing() } }
    }
    private func navigationButton(_ title: String, symbol: String, path: String) -> some View {
        let selected = session.currentPath == path
        return Button {
            guard !selected, let url = URL(string: path, relativeTo: NavigationPolicy.site)?.absoluteURL else { return }
            session.open(url)
        } label: {
            VStack(spacing: 4) {
                Image(systemName: selected ? symbol + ".fill" : symbol).font(.system(size: 19))
                Text(title).font(.caption)
            }.frame(maxWidth: .infinity, minHeight: 48)
                .foregroundStyle(selected ? Color(red: 0.48, green: 0.35, blue: 0.28) : Color.secondary)
        }.buttonStyle(.plain).accessibilityAddTraits(selected ? .isSelected : [])
    }
}
