package ru.tvoygoroskop.app;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;

import ru.tvoygoroskop.app.auth.NativeIdentityAuthPlugin;
import ru.tvoygoroskop.app.diagnostics.NativeDiagnosticsPlugin;

/** Android entry point for the public RuStore application identity. */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        NativeDiagnosticsPlugin.installCrashHandler(this);
        NativeDiagnosticsPlugin.mark(this, "activity_onCreate_before_capacitor savedState=" + (savedInstanceState != null));
        registerPlugin(NativeDiagnosticsPlugin.class);
        registerPlugin(NativeIdentityAuthPlugin.class);
        if (isRuStorePaymentsEnabled()) {
            registerRuStorePlugin();
        }
        super.onCreate(savedInstanceState);
        NativeDiagnosticsPlugin.mark(this, "activity_onCreate_after_capacitor");
        if (isRuStorePaymentsEnabled() && savedInstanceState == null) proceedRuStoreIntent(getIntent());
    }

    @Override
    protected void onStart() {
        super.onStart();
        NativeDiagnosticsPlugin.mark(this, "activity_onStart");
    }

    @Override
    protected void onResume() {
        super.onResume();
        NativeDiagnosticsPlugin.mark(this, "activity_onResume");
    }

    @Override
    protected void onPause() {
        NativeDiagnosticsPlugin.mark(this, "activity_onPause");
        super.onPause();
    }

    @Override
    protected void onStop() {
        NativeDiagnosticsPlugin.mark(this, "activity_onStop");
        super.onStop();
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        NativeDiagnosticsPlugin.mark(this, "activity_onNewIntent");
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
