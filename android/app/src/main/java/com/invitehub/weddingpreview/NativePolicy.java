package com.invitehub.weddingpreview;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

/** Pure Java boundary rules, exercised without a device or a mocked Android framework. */
public final class NativePolicy {
    public static final String SITE = "https://wedding-invitation-2026-10-02.jyb1126.chatgpt.site";
    public static final String CALLBACK_SCHEME = "com.invitehub.wedding-preview";
    public static final String SHARE_AUTHORITY = "com.invitehub.weddingpreview.share";
    public static final int MAX_FILE_BYTES = 10 * 1024 * 1024;
    public static final long SHARE_LIFETIME_MS = 10 * 60 * 1000L;
    private NativePolicy() {}

    public static URI uri(String value) {
        try { return value == null || value.length() > 8192 ? null : new URI(value); }
        catch (Exception ignored) { return null; }
    }
    public static boolean internal(String value) {
        URI u = uri(value);
        return u != null && "https".equals(u.getScheme()) && u.getRawUserInfo() == null && u.getPort() == -1
                && URI.create(SITE).getHost().equals(u.getHost());
    }
    public static boolean external(String value) {
        URI u = uri(value);
        return u != null && value.length() <= 4096 && u.getRawUserInfo() == null
                && java.util.Arrays.asList("https", "mailto", "tel", "sms", "kakaolink", "kakaomap", "nmap").contains(u.getScheme());
    }
    public static String invitation(String value) {
        URI u = uri(value);
        return internal(value) && u.getRawPath().matches("/i/[a-z0-9-]{3,30}") ? SITE + u.getRawPath() : null;
    }
    public static String fileExtension(String type, String name) {
        if (type == null || name == null || name.length() > 200) return null;
        String mime = type.toLowerCase(java.util.Locale.ROOT).split(";", 2)[0].trim();
        String ext = switch (mime) {
            case "image/png" -> "png"; case "image/jpeg" -> "jpg"; case "text/csv" -> "csv";
            case "text/calendar" -> "ics"; case "application/pdf" -> "pdf"; default -> null;
        };
        if (ext == null || name.contains("/") || name.contains("\\") || name.indexOf('\0') >= 0) return null;
        String supplied = name.contains(".") ? name.substring(name.lastIndexOf('.') + 1).toLowerCase(java.util.Locale.ROOT) : "";
        return supplied.isEmpty() || supplied.equals(ext) || (ext.equals("jpg") && supplied.equals("jpeg")) ? ext : null;
    }
    public static boolean shareName(String name) {
        return name != null && name.matches("[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\\.(png|jpg|csv|ics|pdf)");
    }
    public static String sessionCookie(String cookies) {
        if (cookies == null || cookies.length() > 8192) return null;
        String result = null;
        for (String item : cookies.split(";")) {
            String cookie = item.trim();
            if (cookie.startsWith("__Host-osam-session=")) {
                if (result != null || !cookie.matches("__Host-osam-session=[a-f0-9]{48}")) return null;
                result = cookie;
            }
        }
        return result;
    }
    public static String redeemedCookie(int status, String location, java.util.List<String> cookies) {
        if (status != 303 || !(SITE + "/my").equals(location) || cookies == null || cookies.size() != 1) return null;
        String cookie = cookies.get(0);
        if (cookie == null || cookie.length() > 512) return null;
        String[] parts = cookie.split(";", -1);
        if (!parts[0].matches("__Host-osam-session=[a-f0-9]{48}")) return null;
        Map<String, String> attributes = new HashMap<>();
        for (int i = 1; i < parts.length; i++) {
            String[] attribute = parts[i].trim().split("=", 2);
            String key = attribute[0].toLowerCase(java.util.Locale.ROOT);
            if (key.isEmpty() || attributes.putIfAbsent(key, attribute.length == 2 ? attribute[1] : "") != null) return null;
        }
        if (attributes.size() != 5 || !"/".equals(attributes.get("path")) || !"".equals(attributes.get("secure"))
                || !"".equals(attributes.get("httponly")) || !"Lax".equalsIgnoreCase(attributes.get("samesite"))) return null;
        try { long age = Long.parseLong(attributes.get("max-age")); if (age <= 0 || age > 2592000) return null; }
        catch (Exception ignored) { return null; }
        return cookie;
    }

    public static final class Login {
        public final String state, verifier;
        public final long until;
        public Login(long now) { state = nonce(); verifier = nonce(); until = now + 600000; }
        private static String nonce() {
            byte[] bytes = new byte[32]; new SecureRandom().nextBytes(bytes);
            StringBuilder out = new StringBuilder(64);
            for (byte b : bytes) out.append(String.format(java.util.Locale.ROOT, "%02x", b & 255));
            return out.toString();
        }
        public String start(String provider) {
            if (!"google".equals(provider) && !"kakao".equals(provider)) return null;
            try {
                byte[] hash = MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(StandardCharsets.UTF_8));
                return SITE + "/api/v2/auth/native/start?provider=" + provider + "&challenge="
                        + Base64.getUrlEncoder().withoutPadding().encodeToString(hash) + "&state=" + state;
            } catch (Exception ignored) { return null; }
        }
        public String code(String callback, long now) {
            URI u = uri(callback);
            if (u == null || callback.length() >= 512 || now > until || until - now > 600000
                    || !CALLBACK_SCHEME.equals(u.getScheme()) || !"auth".equals(u.getHost())
                    || u.getRawUserInfo() != null || u.getPort() != -1 || !u.getRawPath().isEmpty()
                    || u.getRawFragment() != null || u.getRawQuery() == null) return null;
            Map<String, String> values = new HashMap<>();
            for (String item : u.getRawQuery().split("&", -1)) {
                String[] pair = item.split("=", -1);
                if (pair.length != 2 || values.putIfAbsent(pair[0], pair[1]) != null) return null;
            }
            String code = values.get("code");
            return values.size() == 2 && state.equals(values.get("state"))
                    && code != null && code.matches("[a-f0-9]{48}") ? code : null;
        }
    }
}
