package com.invitehub.weddingpreview;

import java.net.URI;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Collections;
import java.util.Arrays;

public final class NativePolicyTest {
    private static int assertions;
    private static void check(boolean result, String label) { assertions++; if (!result) throw new AssertionError(label); }
    public static void main(String[] args) throws Exception {
        String site = NativePolicy.SITE;
        check(NativePolicy.internal(site + "/my?next=/login"), "trusted site");
        for (String url : Arrays.asList("http" + site.substring(5), site + ".evil.invalid", "https://user@" + URI.create(site).getHost(),
                site + ":443/my", "javascript:alert(1)", "file:///tmp/x", "https://osamosam-app.jyb1126.chatgpt.site", "https://[", "", "https://evil.invalid"))
            check(!NativePolicy.internal(url), "reject internal " + url);
        check(!NativePolicy.internal(null), "null URL");
        for (String url : Arrays.asList("https://map.kakao.com", "tel:0212345678", "mailto:test@example.invalid", "kakaolink://send"))
            check(NativePolicy.external(url), "allowed external " + url);
        for (String url : Arrays.asList("intent://open", "http://example.invalid", "data:text/html,x", "content://photos/1", "https://user@example.invalid"))
            check(!NativePolicy.external(url), "blocked external " + url);
        check((site + "/i/my-wedding").equals(NativePolicy.invitation(site + "/i/my-wedding?private=secret#preview")), "share only clean public link");
        for (String suffix : Arrays.asList("/my", "/edit/abc", "/i/ab", "/i/UPPER", "/i/abc/more", "/i/abc%2fdef", "/i/" + "a".repeat(31)))
            check(NativePolicy.invitation(site + suffix) == null, "no private or invalid share " + suffix);
        check("csv".equals(NativePolicy.fileExtension("text/csv;charset=utf-8", "참석.csv")), "Korean CSV");
        check("jpg".equals(NativePolicy.fileExtension("image/jpeg", "photo.jpeg")), "JPEG alias");
        check("png".equals(NativePolicy.fileExtension("image/png", "청첩장")), "missing extension");
        for (String name : Arrays.asList("../x.png", "folder/x.png", "x\\y.png", "x\0.png", "x.pdf"))
            check(NativePolicy.fileExtension("image/png", name) == null, "unsafe filename " + name);
        check(NativePolicy.fileExtension("text/html", "x.html") == null, "HTML export denied");
        check(NativePolicy.shareName("6f8bd31a-0c97-4c77-82d0-522a89245f04.csv"), "cache name");
        check(!NativePolicy.shareName("../../secret.csv"), "no cache traversal");
        NativePolicy.Login login = new NativePolicy.Login(1000);
        check(login.state.matches("[a-f0-9]{64}") && login.verifier.matches("[a-f0-9]{64}") && !login.state.equals(login.verifier), "independent random proof");
        String proof = Base64.getUrlEncoder().withoutPadding().encodeToString(MessageDigest.getInstance("SHA-256").digest(login.verifier.getBytes(StandardCharsets.UTF_8)));
        check(login.start("google").contains("challenge=" + proof + "&state=" + login.state), "PKCE SHA256");
        check(login.start("kakao") != null && login.start("apple") == null && login.start("google&other=1") == null, "only supported providers");
        String code = "b".repeat(48), callback = NativePolicy.CALLBACK_SCHEME + "://auth?code=" + code + "&state=" + login.state;
        check(code.equals(login.code(callback, 1000)) && code.equals(login.code(callback, 601000)), "valid callback through exact expiry");
        check(login.code(callback, 601001) == null && login.code(callback, 999) == null, "expired or backwards clock");
        for (String value : Arrays.asList(callback + "&state=" + login.state, callback + "&extra=1", callback + "#x", callback.replace("://auth?", "://auth/?"),
                callback.replace("://auth?", "://auth:123?"), callback.replace("://auth?", "://user@auth?"), callback.replace("auth?", "evil?"),
                callback.replace(login.state, "0".repeat(64)), callback.replace(code, "B".repeat(48)), callback.replace("code=", "code=%")))
            check(login.code(value, 1000) == null, "invalid callback " + value);
        String token = "a".repeat(48), cookie = "__Host-osam-session=" + token;
        check(cookie.equals(NativePolicy.sessionCookie("other=abc; " + cookie)), "private session only");
        check(NativePolicy.sessionCookie(cookie + ";" + cookie) == null && NativePolicy.sessionCookie(cookie + "bad") == null, "duplicate/malformed session");
        String serverCookie = cookie + "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000";
        check(serverCookie.equals(NativePolicy.redeemedCookie(303, site + "/my", Collections.singletonList(serverCookie))), "strict redemption response");
        for (String value : Arrays.asList(serverCookie.replace("; Secure", ""), serverCookie.replace("; HttpOnly", ""), serverCookie + "; Domain=example.invalid",
                serverCookie.replace("Path=/", "Path=/my"), serverCookie.replace("2592000", "2592001"), serverCookie.replace("2592000", "-1"), serverCookie + "; Secure"))
            check(NativePolicy.redeemedCookie(303, site + "/my", Collections.singletonList(value)) == null, "unsafe cookie " + value);
        check(NativePolicy.redeemedCookie(200, site + "/my", Collections.singletonList(serverCookie)) == null, "wrong status");
        check(NativePolicy.redeemedCookie(303, "https://evil.invalid/my", Collections.singletonList(serverCookie)) == null, "redirect leak blocked");
        check(NativePolicy.redeemedCookie(303, site + "/my", Arrays.asList(serverCookie, serverCookie)) == null, "duplicate set-cookie blocked");
        System.out.println("PASS Android native boundary assertions=" + assertions + " (pure Java; not a device run)");
    }
}
