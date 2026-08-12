package ru.tvoygoroskop.app;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;

import ru.tvoygoroskop.app.auth.NativeIdentityAuthPlugin;

/** Android entry point for the public RuStore application identity. */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeIdentityAuthPlugin.class);
        if (isRuStorePaymentsEnabled()) {
            registerRuStorePlugin();
        }
        super.onCreate(savedInstanceState);
        if (isRuStorePaymentsEnabled() && savedInstanceState == null) proceedRuStoreIntent(getIntent());
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (isRuStorePaymentsEnabled()) proceedRuStoreIntent(intent);
    }

    private boolean isRuStorePaymentsEnabled() {
        return "rustore".equals(BuildConfig.DISTRIBUTION_CHANNEL)
            && BuildConfig.RUSTORE_PAYMENTS_ENABLED;
    }

    @SuppressWarnings("unchecked")
    private void registerRuStorePlugin() {
        try {
            Class<?> pluginClass = Class.forName("ru.tvoygoroskop.app.rustore.RuStorePayPlugin");
            registerPlugin((Class<? extends Plugin>) pluginClass);
        } catch (ClassNotFoundException ignored) {
            // The class exists only in the RuStore flavor.
        }
    }

    private void proceedRuStoreIntent(Intent intent) {
        try {
            Class<?> bridge = Class.forName("ru.tvoygoroskop.app.rustore.RuStorePayBridge");
            bridge.getMethod("proceedIntent", Intent.class).invoke(null, intent);
        } catch (ReflectiveOperationException ignored) {
            // The SDK bridge is unavailable outside the enabled RuStore flavor.
        }
    }
}
