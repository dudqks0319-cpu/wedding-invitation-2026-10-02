package com.invitehub.weddingpreview;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.JsResult;
import android.webkit.PermissionRequest;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.SslErrorHandler;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebMessage;
import android.webkit.WebMessagePort;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.view.View;
import android.view.WindowInsets;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import javax.net.ssl.HttpsURLConnection;

/** Independent Android candidate; passwords and provider consent stay in the system browser. */
public final class MainActivity extends Activity {
    private static final int PHOTO_REQUEST = 101;
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private WebView web;
    private WebMessagePort channel;
    private ProgressBar progress;
    private LinearLayout content;
    private TextView problem;
    private Button retry;
    private ValueCallback<Uri[]> photo;
    private int photoGeneration;
    private String photoSession;
    private NativePolicy.Login pendingLogin;
    private boolean redeeming, sharing, destroyed, pageFailed;
    private int documentGeneration;
    private String observedSession;
    private String lastPage = NativePolicy.SITE + "/";
    private String bridgeScript;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        try (InputStream input = getAssets().open("bridge.js")) {
            bridgeScript = new String(readBounded(input, 12000), StandardCharsets.UTF_8);
        } catch (Exception ignored) { bridgeScript = null; }
        makeScreen();
        makeWebView();
        observedSession = currentSession();
        pruneShares(false);
        // WebView history/form snapshots can include private material; restart at the public home.
        web.loadUrl(lastPage);
        handleCallback(getIntent());
        if (Build.VERSION.SDK_INT >= 33) getOnBackInvokedDispatcher().registerOnBackInvokedCallback(0, this::back);
    }

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private Button button(String label, Runnable action) {
        Button result = new Button(this);
        result.setText(label); result.setAllCaps(false); result.setTextColor(Color.rgb(67, 54, 54));
        result.setTextSize(14); result.setMinHeight(dp(48)); result.setPadding(dp(8), 0, dp(8), 0);
        result.setOnClickListener(view -> action.run());
        return result;
    }
    private void makeScreen() {
        LinearLayout root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(255, 250, 247));
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bounds = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.ime());
                view.setPadding(bounds.left, bounds.top, bounds.right, bounds.bottom);
            } else view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                    insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets;
        });
        LinearLayout header = new LinearLayout(this);
        header.addView(button("뒤로", this::back), new LinearLayout.LayoutParams(dp(64), dp(48)));
        TextView title = new TextView(this); title.setText("청첩장"); title.setTextSize(20);
        title.setTextColor(Color.rgb(55, 43, 43)); title.setGravity(android.view.Gravity.CENTER_VERTICAL);
        header.addView(title, new LinearLayout.LayoutParams(0, dp(48), 1));
        header.addView(button("공유", this::shareLink), new LinearLayout.LayoutParams(dp(64), dp(48)));
        header.addView(button("로그인", () -> navigate("/login")), new LinearLayout.LayoutParams(dp(80), dp(48)));
        root.addView(header);
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100); root.addView(progress, new LinearLayout.LayoutParams(-1, dp(3)));
        problem = new TextView(this); problem.setTextSize(14); problem.setPadding(dp(16), dp(12), dp(16), dp(8));
        problem.setVisibility(View.GONE); root.addView(problem);
        retry = button("다시 연결", () -> { if (web == null) makeWebView(); web.loadUrl(lastPage); });
        retry.setVisibility(View.GONE); root.addView(retry, new LinearLayout.LayoutParams(-1, dp(48)));
        content = new LinearLayout(this); root.addView(content, new LinearLayout.LayoutParams(-1, 0, 1));
        LinearLayout tabs = new LinearLayout(this);
        tabs.addView(button("홈", () -> navigate("/")), new LinearLayout.LayoutParams(0, dp(52), 1));
        tabs.addView(button("디자인", () -> navigate("/templates")), new LinearLayout.LayoutParams(0, dp(52), 1));
        tabs.addView(button("내 청첩장", () -> navigate("/my")), new LinearLayout.LayoutParams(0, dp(52), 1));
        root.addView(tabs); setContentView(root); root.requestApplyInsets();
    }
    // JavaScript is limited to the fixed HTTPS main frame; no addJavascriptInterface.
    @android.annotation.SuppressLint("SetJavaScriptEnabled")
    private void makeWebView() {
        web = new WebView(this);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true); settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false); settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSafeBrowsingEnabled(true); settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false); settings.setSupportMultipleWindows(false);
        settings.setUserAgentString(settings.getUserAgentString() + " WeddingAndroid/0.1.0");
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        WebView.setWebContentsDebuggingEnabled(false);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (NativePolicy.internal(url)) return false;
                if (request.isForMainFrame() && request.hasGesture() && NativePolicy.internal(view.getUrl())
                        && NativePolicy.external(url)) openExternal(url);
                // External HTTPS frames may render maps, but never receive the private main-frame port.
                return request.isForMainFrame() || !"https".equals(request.getUrl().getScheme());
            }
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap icon) {
                closeChannel(); documentGeneration++; pageFailed = false; progress.setVisibility(View.VISIBLE);
                if (NativePolicy.internal(url)) { lastPage = url; problem.setVisibility(View.GONE); retry.setVisibility(View.GONE); }
            }
            @Override public void onPageFinished(WebView view, String url) {
                progress.setVisibility(View.GONE); checkSession();
                if (!pageFailed && NativePolicy.internal(url) && url.equals(view.getUrl())) installChannel();
            }
            @Override public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                handler.cancel(); pageFailed = true; showProblem("보안 연결을 확인하지 못했어요. 잠시 후 다시 연결해 주세요.");
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) { pageFailed = true; showProblem("인터넷 연결을 확인하고 다시 연결해 주세요. 저장 전 작업은 복구되지 않을 수 있어요."); }
            }
            @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                if (request.isForMainFrame()) { pageFailed = true; showProblem("이 화면을 불러오지 못했어요. 잠시 후 다시 연결해 주세요."); }
            }
            @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                closeChannel(); documentGeneration++; content.removeView(view); view.destroy(); web = null;
                showProblem("화면을 다시 연결해야 해요. 저장 전 작업은 복구되지 않을 수 있어요."); return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView view, int value) { progress.setProgress(value); }
            @Override public void onPermissionRequest(PermissionRequest request) { request.deny(); }
            @Override public boolean onJsBeforeUnload(WebView view, String url, String message, JsResult result) {
                if (!NativePolicy.internal(url)) { result.cancel(); return true; }
                new AlertDialog.Builder(MainActivity.this).setMessage("저장 전 변경사항이 사라질 수 있어요. 이동할까요?")
                        .setPositiveButton("이동", (dialog, which) -> result.confirm())
                        .setNegativeButton("계속 편집", (dialog, which) -> result.cancel())
                        .setOnCancelListener(dialog -> result.cancel()).show();
                return true;
            }
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (!NativePolicy.internal(view.getUrl())) return false;
                if (photo != null) photo.onReceiveValue(null);
                photo = callback;
                photoGeneration = documentGeneration; photoSession = currentSession();
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("image/*")
                        .addCategory(Intent.CATEGORY_OPENABLE).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                try { startActivityForResult(intent, PHOTO_REQUEST); }
                catch (ActivityNotFoundException ignored) { photo.onReceiveValue(null); photo = null; say("사진을 선택할 앱을 찾지 못했어요."); }
                return true;
            }
        });
        content.addView(web, new LinearLayout.LayoutParams(-1, -1));
    }
    private void navigate(String path) {
        if (web == null) makeWebView();
        web.loadUrl(NativePolicy.SITE + path);
    }
    private void back() { if (web != null && web.canGoBack()) web.goBack(); else finish(); }
    // API33+ uses the registered platform OnBackInvokedCallback. This override
    // remains only for API26-32, without adding an AndroidX dependency.
    @android.annotation.SuppressLint("GestureBackNavigation")
    @Override public void onBackPressed() { back(); }
    private void say(String text) { Toast.makeText(this, text, Toast.LENGTH_LONG).show(); }
    private void showProblem(String text) { problem.setText(text); problem.setVisibility(View.VISIBLE); retry.setVisibility(View.VISIBLE); progress.setVisibility(View.GONE); }
    private void openExternal(String url) {
        try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)).addCategory(Intent.CATEGORY_BROWSABLE)); }
        catch (ActivityNotFoundException ignored) { say("이 링크를 열 앱을 찾지 못했어요."); }
    }
    private void startLogin(String provider) {
        if (redeeming) { say("로그인을 마치는 중이에요."); return; }
        NativePolicy.Login login = new NativePolicy.Login(System.currentTimeMillis());
        String start = login.start(provider);
        if (start == null) return;
        pendingLogin = login; openExternal(start);
    }
    @Override protected void onNewIntent(Intent intent) { super.onNewIntent(intent); setIntent(intent); handleCallback(intent); }
    private void handleCallback(Intent intent) {
        if (intent == null || intent.getData() == null) return;
        String callback = intent.getData().toString(); intent.setData(null);
        NativePolicy.Login login = pendingLogin;
        if (login == null || redeeming) { say("앱에서 로그인을 다시 시작해 주세요."); return; }
        String code = login.code(callback, System.currentTimeMillis());
        if (code == null) { say("로그인 연결을 확인하지 못했어요. 다시 시작해 주세요."); return; }
        redeeming = true;
        io.execute(() -> {
            String cookie = null;
            try { cookie = redeem(login, code); } catch (Exception ignored) {}
            final String result = cookie;
            runOnUiThread(() -> {
                if (destroyed || pendingLogin != login) return;
                if (result == null) { redeeming = false; pendingLogin = null; say("로그인을 완료하지 못했어요. 다시 시작해 주세요."); return; }
                CookieManager.getInstance().setCookie(NativePolicy.SITE, result, accepted -> {
                    if (destroyed || pendingLogin != login) return;
                    redeeming = false; pendingLogin = null;
                    if (!accepted) { say("로그인 정보를 저장하지 못했어요."); return; }
                    CookieManager.getInstance().flush(); checkSession(); navigate("/my");
                });
            });
        });
    }
    private String redeem(NativePolicy.Login login, String code) throws Exception {
        HttpsURLConnection connection = (HttpsURLConnection) new java.net.URL(NativePolicy.SITE + "/api/v2/auth/native/redeem").openConnection();
        connection.setInstanceFollowRedirects(false); connection.setConnectTimeout(12000); connection.setReadTimeout(12000);
        connection.setRequestMethod("POST"); connection.setDoOutput(true); connection.setUseCaches(false);
        connection.setRequestProperty("Content-Type", "application/json"); connection.setRequestProperty("Origin", NativePolicy.SITE);
        connection.setRequestProperty("Idempotency-Key", UUID.randomUUID().toString());
        byte[] body = new JSONObject().put("code", code).put("verifier", login.verifier).put("state", login.state).put("next", "/my")
                .toString().getBytes(StandardCharsets.UTF_8);
        connection.setFixedLengthStreamingMode(body.length);
        try {
            try (java.io.OutputStream output = connection.getOutputStream()) { output.write(body); }
            int status = connection.getResponseCode();
            List<String> cookies = new ArrayList<>();
            for (java.util.Map.Entry<String, List<String>> header : connection.getHeaderFields().entrySet())
                if ("set-cookie".equalsIgnoreCase(header.getKey())) cookies.addAll(header.getValue());
            return NativePolicy.redeemedCookie(status, connection.getHeaderField("Location"), cookies);
        } finally { connection.disconnect(); }
    }
    private void closeChannel() { if (channel != null) { channel.close(); channel = null; } }
    private void installChannel() {
        if (bridgeScript == null || channel != null || web == null) return;
        final int generation = documentGeneration;
        final WebView view = web;
        String nonce = UUID.randomUUID().toString() + UUID.randomUUID();
        WebMessagePort[] ports = view.createWebMessageChannel(); channel = ports[0];
        ports[0].setWebMessageCallback(new WebMessagePort.WebMessageCallback() {
            @Override public void onMessage(WebMessagePort port, WebMessage message) {
                if (destroyed || web != view || generation != documentGeneration || !NativePolicy.internal(view.getUrl())) return;
                String data = message.getData(); if (data == null || data.length() > 14000000) return;
                try {
                    JSONObject payload = new JSONObject(data); if (payload.length() != 2) return;
                    String kind = payload.getString("kind");
                    if ("auth".equals(kind)) {
                        String provider = payload.getString("body");
                        if ("accountDeleted".equals(provider)) { pendingLogin = null; redeeming = false; checkSession(); pruneShares(true); }
                        else startLogin(provider);
                    } else if ("file".equals(kind)) shareFile(payload.getJSONObject("body"));
                } catch (Exception ignored) { say("요청을 처리하지 못했어요. 다시 시도해 주세요."); }
            }
        });
        view.evaluateJavascript(bridgeScript.replace("__NATIVE_CHANNEL_NONCE__", nonce), ignored -> {
            if (!destroyed && web == view && generation == documentGeneration && NativePolicy.internal(view.getUrl()))
                view.postWebMessage(new WebMessage(nonce, new WebMessagePort[]{ports[1]}), Uri.parse(NativePolicy.SITE));
            else { ports[0].close(); ports[1].close(); }
        });
    }
    private String currentSession() { return NativePolicy.sessionCookie(CookieManager.getInstance().getCookie(NativePolicy.SITE)); }
    private void checkSession() {
        String session = currentSession();
        if (!java.util.Objects.equals(observedSession, session)) { observedSession = session; pruneShares(true); }
    }
    private void shareLink() {
        String link = web == null ? null : NativePolicy.invitation(web.getUrl());
        if (link == null) { say("공유할 청첩장을 열어 주세요."); return; }
        Intent intent = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, link);
        launchShare(intent);
    }
    private void launchShare(Intent intent) {
        try { startActivity(Intent.createChooser(intent, "청첩장 공유")); }
        catch (ActivityNotFoundException ignored) { say("공유할 앱을 찾지 못했어요."); }
    }
    private File shareFolder() { return new File(getCacheDir(), "invitation-share"); }
    private void pruneShares(boolean all) {
        File[] files = shareFolder().listFiles(); if (files == null) return;
        long now = System.currentTimeMillis();
        for (File file : files) if (all || now - file.lastModified() > NativePolicy.SHARE_LIFETIME_MS || now < file.lastModified()) {
            if (NativePolicy.shareName(file.getName())) {
                Uri uri = Uri.parse("content://" + NativePolicy.SHARE_AUTHORITY + "/files/" + file.getName());
                revokeUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION); file.delete();
            }
        }
    }
    private void shareFile(JSONObject body) throws org.json.JSONException {
        if (sharing) { say("파일을 준비하고 있어요."); return; }
        if ("download".equals(body.optString("error"))) { say("파일을 준비하지 못했어요."); return; }
        if (body.length() != 3 || !(body.opt("data") instanceof String)) return;
        String type = body.optString("type"), ext = NativePolicy.fileExtension(type, body.optString("name"));
        String encoded = body.getString("data");
        if (ext == null || encoded.length() > 13981016 || !encoded.matches("[A-Za-z0-9+/]*={0,2}")) return;
        checkSession(); pruneShares(false);
        File[] files = shareFolder().listFiles();
        if (files != null && files.length >= 3) { say("잠시 후 다시 공유해 주세요. 준비한 파일은 10분 후 정리돼요."); return; }
        String session = currentSession(); sharing = true;
        io.execute(() -> {
            File target = null;
            try {
                byte[] bytes = java.util.Base64.getDecoder().decode(encoded);
                if (bytes.length == 0 || bytes.length > NativePolicy.MAX_FILE_BYTES) throw new IllegalArgumentException();
                File folder = shareFolder(); if (!folder.isDirectory() && !folder.mkdirs()) throw new java.io.IOException();
                target = new File(folder, UUID.randomUUID() + "." + ext);
                try (FileOutputStream output = new FileOutputStream(target)) { output.write(bytes); }
            } catch (Exception ignored) { if (target != null) target.delete(); target = null; }
            final File result = target;
            runOnUiThread(() -> {
                sharing = false;
                if (destroyed || !java.util.Objects.equals(session, currentSession())) { if (result != null) result.delete(); return; }
                if (result == null) { say("파일을 준비하지 못했어요. 다시 시도해 주세요."); return; }
                Uri uri = Uri.parse("content://" + NativePolicy.SHARE_AUTHORITY + "/files/" + result.getName());
                Intent intent = new Intent(Intent.ACTION_SEND).setType(type.split(";", 2)[0]).putExtra(Intent.EXTRA_STREAM, uri)
                        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                intent.setClipData(ClipData.newRawUri("청첩장", uri));
                launchShare(intent);
            });
        });
    }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request != PHOTO_REQUEST || photo == null) return;
        Uri uri = result == RESULT_OK && data != null ? data.getData() : null;
        boolean accepted = false;
        try {
            String type = uri == null ? null : getContentResolver().getType(uri);
            if (uri != null && "content".equals(uri.getScheme()) && type != null && type.startsWith("image/")
                    && web != null && NativePolicy.internal(web.getUrl()) && photoGeneration == documentGeneration
                    && java.util.Objects.equals(photoSession, currentSession())) {
                try (android.database.Cursor cursor = getContentResolver().query(uri,
                        new String[]{android.provider.OpenableColumns.SIZE}, null, null, null)) {
                    accepted = cursor != null && cursor.moveToFirst() && !cursor.isNull(0)
                            && cursor.getLong(0) > 0 && cursor.getLong(0) <= 40 * 1024 * 1024;
                }
            }
        } catch (Exception ignored) {}
        photo.onReceiveValue(accepted ? new Uri[]{uri} : null);
        if (uri != null && !accepted) say("사진을 확인하지 못했어요. 40MB 이하 사진을 다시 선택해 주세요.");
        photo = null;
    }
    @Override protected void onResume() { super.onResume(); if (web != null) checkSession(); pruneShares(false); }
    @Override protected void onDestroy() {
        destroyed = true; pendingLogin = null; closeChannel(); io.shutdownNow();
        if (photo != null) { photo.onReceiveValue(null); photo = null; }
        if (web != null) { content.removeView(web); web.destroy(); web = null; }
        super.onDestroy();
    }
    private static byte[] readBounded(InputStream input, int limit) throws java.io.IOException {
        java.io.ByteArrayOutputStream result = new java.io.ByteArrayOutputStream();
        byte[] chunk = new byte[1024]; int size;
        while ((size = input.read(chunk)) != -1) { if (result.size() + size > limit) throw new java.io.IOException(); result.write(chunk, 0, size); }
        return result.toByteArray();
    }
}
