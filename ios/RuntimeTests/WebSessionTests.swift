import XCTest
import WebKit
import CryptoKit
@testable import WeddingInvitation

@MainActor final class WebSessionTests: XCTestCase {
    private func waitUntil(_ label: String, _ condition: () -> Bool) async throws {
        for _ in 0..<150 {
            if condition() { return }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        XCTFail("WebKit \(label) did not finish within 15 seconds")
        throw NSError(domain: "WeddingRuntimeTests", code: 1)
    }
    private func fixture(_ session: WebSession, _ html: String) async throws {
        session.open(NavigationPolicy.site)
        try await waitUntil("live origin loading") { session.webView.url?.host == NavigationPolicy.site.host && !session.webView.isLoading }
        let origin = try await session.webView.evaluateJavaScript("location.origin") as? String
        XCTAssertEqual(origin, NavigationPolicy.site.absoluteString)
        let json = String(data: try JSONEncoder().encode(html), encoding: .utf8)!
        _ = try await session.webView.evaluateJavaScript("document.body.insertAdjacentHTML('beforeend', \(json))")
    }
    func testActualBlobDownloadPreparesShareFileAndCleansIt() async throws {
        let s = WebSession(startImmediately: false)
        try await fixture(s, "<p>Native file export fixture</p>")
        _ = try await s.webView.evaluateJavaScript("""
        (() => {const b=new Blob(['name,count\\nfixture,1'],{type:'text/csv'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='responses.csv';a.click();return true;})()
        """)
        try await waitUntil("download completion") { s.shareFile != nil || s.error != nil }
        XCTAssertNil(s.error)
        let file = try XCTUnwrap(s.shareFile?.url)
        XCTAssertEqual(file.pathExtension, "csv")
        XCTAssertEqual(try String(contentsOf: file, encoding: .utf8), "name,count\nfixture,1")
        s.shareFile = nil // Interactive sheet dismissal clears SwiftUI's binding first.
        s.finishSharing()
        XCTAssertFalse(FileManager.default.fileExists(atPath: file.path))
    }
    func testLatestRsvpCsvPreservesKoreanAndAll500RowsThroughNativeShare() async throws {
        struct Fixture: Decodable {
            let synthetic: Bool
            let csvSha256: String
            let entryCount: Int
            let csv: String
        }
        let fixtureURL = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "rsvp-native-export", withExtension: "json"))
        let input = try JSONDecoder().decode(Fixture.self, from: Data(contentsOf: fixtureURL))
        XCTAssertTrue(input.synthetic)
        XCTAssertEqual(input.entryCount, 500)
        let expected = Data(input.csv.utf8)
        XCTAssertEqual(expected.prefix(3), Data([0xEF, 0xBB, 0xBF]))
        let s = WebSession(startImmediately: false)
        defer { s.finishSharing() }
        try await fixture(s, "<p>합성 참석 명단 내보내기 검수</p>")
        let csvJSON = String(data: try JSONEncoder().encode(input.csv), encoding: .utf8)!
        _ = try await s.webView.evaluateJavaScript("""
        (() => {
          const blob = new Blob([\(csvJSON)], {type:'text/csv;charset=utf-8'});
          const link = document.createElement('a');
          const url = URL.createObjectURL(blob);
          link.href = url; link.download = '참석-명단.csv';
          document.body.appendChild(link); link.click(); link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 60000);
          return true;
        })()
        """)
        try await waitUntil("latest RSVP download") { s.shareFile != nil || s.error != nil }
        XCTAssertNil(s.error)
        let file = try XCTUnwrap(s.shareFile?.url)
        let actual = try Data(contentsOf: file)
        XCTAssertEqual(actual, expected, "The native bridge must preserve the exact web-generated CSV bytes")
        XCTAssertEqual(SHA256.hash(data: actual).map { String(format: "%02x", $0) }.joined(), input.csvSha256)
        XCTAssertTrue(input.csv.contains("가상 하객 499"))
        XCTAssertTrue(input.csv.contains("문자: =1+1"))
        XCTAssertTrue(input.csv.contains("2026-10-04 08:30"))
        XCTAssertEqual(file.pathExtension, "csv")
        let attributes = try FileManager.default.attributesOfItem(atPath: file.path)
        XCTAssertEqual((attributes[.posixPermissions] as? NSNumber)?.intValue, 0o600)
        s.shareFile = nil // The sheet binding can clear before onDismiss.
        s.finishSharing()
        s.finishSharing() // Completion and onDismiss may both run.
        XCTAssertFalse(FileManager.default.fileExists(atPath: file.deletingLastPathComponent().path))
    }
    func testExternalLinkIsRoutedWithoutReplacingTheWebApp() async throws {
        let s = WebSession(startImmediately: false)
        try await fixture(s, "<a id='outside' href='https://example.com/info'>External</a><input id='photo' type='file' accept='image/*'>")
        let input = try await s.webView.evaluateJavaScript("document.getElementById('photo').type") as? String
        XCTAssertEqual(input, "file")
        _ = try await s.webView.evaluateJavaScript("document.getElementById('outside').click()")
        try await waitUntil("external navigation") { s.safariURL != nil }
        XCTAssertEqual(s.safariURL?.url.host, "example.com")
        XCTAssertEqual(s.webView.url?.host, NavigationPolicy.site.host)
    }
    func testCalendarDownloadKeepsTheScheduleAndCleansTemporaryFile() async throws {
        let s = WebSession(startImmediately: false)
        try await fixture(s, "<p>Calendar export fixture</p>")
        _ = try await s.webView.evaluateJavaScript("""
        (() => {const b=new Blob(['BEGIN:VCALENDAR\\r\\nVERSION:2.0\\r\\nEND:VCALENDAR\\r\\n'],{type:'text/calendar;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='invitation.ics';a.click();return true;})()
        """)
        try await waitUntil("calendar download completion") { s.shareFile != nil || s.error != nil }
        XCTAssertNil(s.error)
        let file = try XCTUnwrap(s.shareFile?.url)
        XCTAssertEqual(file.pathExtension, "ics")
        XCTAssertTrue(try String(contentsOf: file, encoding: .utf8).contains("BEGIN:VCALENDAR"))
        s.finishSharing()
        XCTAssertFalse(FileManager.default.fileExists(atPath: file.path))
    }
    func testDownloadBridgeRejectsUnsafeTypesAndMalformedData() async throws {
        let s = WebSession(startImmediately: false)
        try await fixture(s, "<p>Input validation fixture</p>")
        _ = try await s.webView.evaluateJavaScript("(() => {window.webkit.messageHandlers.osamDownload.postMessage({name:'payload.html',type:'text/html',data:btoa('<script>test</script>')});window.webkit.messageHandlers.osamDownload.postMessage({name:'data.csv',type:'text/csv',data:'%%%invalid%%%'});return true;})()")
        try await Task.sleep(nanoseconds: 300_000_000)
        XCTAssertNil(s.shareFile)
    }
}
