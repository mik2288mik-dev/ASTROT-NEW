package ru.tvoygoroskop.app;

import android.content.Context;
import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;

import ru.tvoygoroskop.app.auth.NativeIdentityAuthPlugin;
import ru.tvoygoroskop.app.diagnostics.NativeDiagnosticsPlugin;
import ru.tvoygoroskop.app.analytics.MyTrackerPlugin;
import ru.tvoygoroskop.app.notifications.NativeNotificationsPlugin;

/** Android entry point for the public RuStore application identity. */
public class MainActivity extends BridgeActivity {
    private Object ruStoreUpdateBridge;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        NativeDiagnosticsPlugin.installCrashHandler(this);
        NativeDiagnosticsPlugin.mark(this, "activity_onCreate_before_capacitor savedState=" + (savedInstanceState != null));
        registerPlugin(NativeDiagnosticsPlugin.class);
        registerPlugin(NativeIdentityAuthPlugin.class);
        registerPlugin(MyTrackerPlugin.class);
        registerPlugin(NativeNotificationsPlugin.class);
        if (isRuStorePaymentsEnabled()) {
            registerRuStorePlugin();
        }
        super.onCreate(savedInstanceState);
        NativeDiagnosticsPlugin.mark(this, "activity_onCreate_after_capacitor");
        if (isRuStorePaymentsEnabled() && savedInstanceState == null) proceedRuStoreIntent(getIntent());
        startRuStoreUpdateCheck();
    }

    @Override
    public void onStart() {
        NativeNotificationsPlugin.setForeground(true);
        super.onStart();
        NativeDiagnosticsPlugin.mark(this, "activity_onStart");
    }

    @Override
    public void onResume() {
        super.onResume();
        NativeDiagnosticsPlugin.mark(this, "activity_onResume");
    }

    @Override
    public void onPause() {
        NativeDiagnosticsPlugin.mark(this, "activity_onPause");
        super.onPause();
    }

    @Override
    public void onStop() {
        NativeNotificationsPlugin.setForeground(false);
        NativeDiagnosticsPlugin.mark(this, "activity_onStop");
        super.onStop();
    }

    @Override
    public void onDestroy() {
        stopRuStoreUpdateCheck();
        super.onDestroy();
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        NativeDiagnosticsPlugin.mark(this, "activity_onNewIntent");
        if (isRuStorePaymentsEnabled()) proceedRuStoreIntent(intent);
    }

    private boolean isRuStoreBuild() {
        return "rustore".equals(BuildConfig.DISTRIBUTION_CHANNEL);
    }

    private boolean isRuStorePaymentsEnabled() {
        return isRuStoreBuild() && BuildConfig.RUSTORE_PAYMENTS_ENABLED;
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

    private void startRuStoreUpdateCheck() {
        if (!isRuStoreBuild() || ruStoreUpdateBridge != null) return;
        try {
            Class<?> bridgeClass = Class.forName("ru.tvoygoroskop.app.rustore.RuStoreUpdateBridge");
            Object bridge = bridgeClass.getConstructor(Context.class).newInstance(this);
            ruStoreUpdateBridge = bridge;
            bridgeClass.getMethod("start").invoke(bridge);
        } catch (ReflectiveOperationException | RuntimeException | LinkageError ignored) {
            ruStoreUpdateBridge = null;
        }
    }

    private void stopRuStoreUpdateCheck() {
        Object bridge = ruStoreUpdateBridge;
        ruStoreUpdateBridge = null;
        if (bridge == null) return;
        try {
            bridge.getClass().getMethod("stop").invoke(bridge);
        } catch (ReflectiveOperationException | RuntimeException | LinkageError ignored) {
            // Update cleanup is best-effort and must never affect app shutdown.
        }
    }
}
