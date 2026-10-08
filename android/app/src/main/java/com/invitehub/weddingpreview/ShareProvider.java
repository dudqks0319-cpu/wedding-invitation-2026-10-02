package com.invitehub.weddingpreview;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import java.io.File;
import java.io.FileNotFoundException;

/** Private cache exports with explicit temporary read grants; no write or directory access. */
public final class ShareProvider extends ContentProvider {
    @Override public boolean onCreate() { return true; }
    private File file(Uri uri) throws FileNotFoundException {
        if (!"content".equals(uri.getScheme()) || !NativePolicy.SHARE_AUTHORITY.equals(uri.getAuthority())
                || uri.getQuery() != null || uri.getFragment() != null || uri.getPathSegments().size() != 2
                || !"files".equals(uri.getPathSegments().get(0))) throw new FileNotFoundException();
        String name = uri.getLastPathSegment();
        if (!NativePolicy.shareName(name)) throw new FileNotFoundException();
        File file = new File(new File(getContext().getCacheDir(), "invitation-share"), name);
        long age = System.currentTimeMillis() - file.lastModified();
        if (!file.isFile() || age < 0 || age > NativePolicy.SHARE_LIFETIME_MS
                || file.length() <= 0 || file.length() > NativePolicy.MAX_FILE_BYTES) throw new FileNotFoundException();
        return file;
    }
    @Override public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        if (!"r".equals(mode)) throw new FileNotFoundException();
        return ParcelFileDescriptor.open(file(uri), ParcelFileDescriptor.MODE_READ_ONLY);
    }
    @Override public String getType(Uri uri) {
        try {
            String name = file(uri).getName();
            if (name.endsWith(".png")) return "image/png";
            if (name.endsWith(".jpg")) return "image/jpeg";
            if (name.endsWith(".csv")) return "text/csv";
            if (name.endsWith(".ics")) return "text/calendar";
            return "application/pdf";
        } catch (FileNotFoundException ignored) { return null; }
    }
    @Override public Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs, String sortOrder) {
        try {
            File file = file(uri);
            MatrixCursor result = new MatrixCursor(new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE});
            result.addRow(new Object[]{"청첩장" + file.getName().substring(file.getName().lastIndexOf('.')), file.length()});
            return result;
        } catch (FileNotFoundException ignored) { return null; }
    }
    @Override public Uri insert(Uri uri, ContentValues values) { throw new UnsupportedOperationException(); }
    @Override public int update(Uri uri, ContentValues values, String selection, String[] args) { throw new UnsupportedOperationException(); }
    @Override public int delete(Uri uri, String selection, String[] args) { throw new UnsupportedOperationException(); }
}
