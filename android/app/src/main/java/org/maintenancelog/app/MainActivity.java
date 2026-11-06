package org.maintenancelog.app;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle state) {
        registerPlugin(BackupPlugin.class);
        super.onCreate(state);
    }
}
