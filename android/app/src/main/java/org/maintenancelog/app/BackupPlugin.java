package org.maintenancelog.app;

import android.app.Activity;
import android.content.Intent;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import java.io.*;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "MaintenanceFiles")
public class BackupPlugin extends Plugin {
    private File photo(String id) throws IOException {
        if (id == null || !id.matches("[a-zA-Z0-9_-]+\\.jpg")) throw new IOException("Invalid photo ID");
        File folder = new File(getContext().getFilesDir(), "maintenance-photos");
        if (!folder.exists() && !folder.mkdirs()) throw new IOException("Cannot create photo folder");
        return new File(folder, id);
    }
    @PluginMethod public void writePhoto(PluginCall call) {
        try {
            byte[] bytes = Base64.decode(call.getString("data"), Base64.DEFAULT);
            File target = photo(call.getString("id"));
            File temp = new File(target.getPath() + ".tmp");
            try (FileOutputStream out = new FileOutputStream(temp)) { out.write(bytes); out.getFD().sync(); }
            if (!temp.renameTo(target)) throw new IOException("Cannot save photo");
            call.resolve();
        } catch (Exception e) { call.reject("Could not save photo", e); }
    }
    @PluginMethod public void readPhoto(PluginCall call) {
        try (InputStream in = new FileInputStream(photo(call.getString("id")))) {
            JSObject result = new JSObject(); result.put("data", Base64.encodeToString(readAll(in), Base64.NO_WRAP)); call.resolve(result);
        } catch (Exception e) { call.reject("Could not read photo", e); }
    }
    @PluginMethod public void saveBackup(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE); intent.setType("application/json");
        intent.putExtra(Intent.EXTRA_TITLE, call.getString("filename", "Maintenance log backup.json"));
        startActivityForResult(call, intent, "backupSaved");
    }
    @ActivityCallback private void backupSaved(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) { call.reject("Save cancelled"); return; }
        try (OutputStream out = getContext().getContentResolver().openOutputStream(result.getData().getData(), "wt")) {
            if (out == null) throw new IOException("Cannot open destination");
            out.write(call.getString("contents", "").getBytes(StandardCharsets.UTF_8)); call.resolve();
        } catch (Exception e) { call.reject("Could not save backup", e); }
    }
    @PluginMethod public void openBackup(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE); intent.setType("*/*");
        startActivityForResult(call, intent, "backupOpened");
    }
    @ActivityCallback private void backupOpened(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) { call.reject("Open cancelled"); return; }
        try (InputStream in = getContext().getContentResolver().openInputStream(result.getData().getData())) {
            JSObject data = new JSObject(); data.put("contents", new String(readAll(in), StandardCharsets.UTF_8)); call.resolve(data);
        } catch (Exception e) { call.reject("Could not open backup", e); }
    }
    private byte[] readAll(InputStream in) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream(); byte[] buffer = new byte[16384]; int n;
        while ((n = in.read(buffer)) != -1) { out.write(buffer, 0, n); }
        return out.toByteArray();
    }
}
