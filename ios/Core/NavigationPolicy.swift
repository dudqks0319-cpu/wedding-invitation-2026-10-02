import Foundation

public enum NavigationPolicy {
    public static let site = URL(string: "https://wedding-invitation-2026-10-02.jyb1126.chatgpt.site")!
    public static let maximumDownloadBytes: Int64 = 10 * 1024 * 1024
    public static func showsMainNavigation(path: String) -> Bool {
        ["/", "/templates", "/my"].contains(path)
    }
    public static func isInternal(_ url: URL) -> Bool {
        url.scheme == "https" && url.host == site.host && url.port == nil && url.user == nil && url.password == nil
            && url.absoluteString.utf8.count <= 8192
    }
    public static func isAuthLink(_ url: URL) -> Bool { false }
    public static func isInternalBlob(_ url: URL) -> Bool {
        guard url.scheme == "blob", let inner = URL(string: String(url.absoluteString.dropFirst(5))) else { return false }
        return isInternal(inner)
    }
    public static func externalLinkAllowed(_ url: URL) -> Bool {
        guard url.absoluteString.utf8.count <= 4096, url.user == nil, url.password == nil else { return false }
        return ["https", "mailto", "tel", "sms", "kakaolink", "kakaomap", "nmap"].contains(url.scheme ?? "")
    }
    public static func publicInvitation(_ url: URL) -> URL? {
        guard isInternal(url), url.path.range(of: "^/i/[A-Za-z0-9_-]{1,100}$", options: .regularExpression) != nil,
              var c = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return nil }
        c.query = nil; c.fragment = nil
        return c.url
    }
    public static func downloadExtension(mime: String?, filename: String) -> String? {
        let type = (mime ?? "").lowercased().split(separator: ";").first.map(String.init) ?? ""
        let allowed = ["image/png":"png", "image/jpeg":"jpg", "text/csv":"csv", "text/calendar":"ics", "application/pdf":"pdf"]
        guard let ext = allowed[type] else { return nil }
        let supplied = URL(fileURLWithPath: filename).pathExtension.lowercased()
        guard supplied.isEmpty || supplied == ext || (ext == "jpg" && supplied == "jpeg") else { return nil }
        return ext
    }
    private static func query(_ url: URL, _ key: String) -> String? {
        let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.filter { $0.name == key } ?? []
        return items.count == 1 ? items.first?.value : nil
    }
}
