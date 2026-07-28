package com.yourhoroscope.app;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if ("rustore".equals(BuildConfig.DISTRIBUTION_CHANNEL)) {
            registerRuStorePlugin();
            proceedRuStoreIntent(getIntent());
        }
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if ("rustore".equals(BuildConfig.DISTRIBUTION_CHANNEL)) proceedRuStoreIntent(intent);
    }

    @SuppressWarnings("unchecked")
    private void registerRuStorePlugin() {
        try {
            Class<?> pluginClass = Class.forName("com.yourhoroscope.app.rustore.RuStorePayPlugin");
            registerPlugin((Class<? extends Plugin>) pluginClass);
        } catch (ClassNotFoundException ignored) {
            // The class exists only in the RuStore flavor. Other flavors never load it.
        }
    }

    private void proceedRuStoreIntent(Intent intent) {
        try {
            Class<?> bridge = Class.forName("com.yourhoroscope.app.rustore.RuStorePayBridge");
            bridge.getMethod("proceedIntent", Intent.class).invoke(null, intent);
        } catch (ReflectiveOperationException ignored) {
            // The RuStore SDK is intentionally absent from non-RuStore flavors.
        }
    }
}
