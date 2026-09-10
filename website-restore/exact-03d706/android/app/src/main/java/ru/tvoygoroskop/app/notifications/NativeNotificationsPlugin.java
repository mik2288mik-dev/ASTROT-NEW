package ru.tvoygoroskop.app.notifications;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/** Local reminders only. Permission prompts are never part of configuration or scheduling. */
@CapacitorPlugin(name = "NeboNotifications", permissions = {
    @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
})
public class NativeNotificationsPlugin extends Plugin {
    public static void setForeground(boolean foreground) {
        NeboNotificationReceiver.setForeground(foreground);
    }

    private void resolvePermission(PluginCall call) {
        JSObject result = new JSObject();
        result.put("display", NeboNotificationReceiver.permissionState(getContext()));
        call.resolve(result);
    }

    private void resolveStatus(PluginCall call, String status) {
        JSObject result = new JSObject();
        result.put("status", status);
        call.resolve(result);
    }

    @PluginMethod
    public void getPermissionState(PluginCall call) {
        resolvePermission(call);
    }

    /** Called only from the user's notification toggle, never from a lifecycle callback. */
    @PluginMethod
    public void requestDisplayPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < 33
            || NeboNotificationReceiver.hasRuntimePermission(getContext())) {
            resolvePermission(call);
            return;
        }
        try {
            requestPermissionForAlias("notifications", call, "displayPermissionResult");
        } catch (RuntimeException ignored) {
            resolvePermission(call);
        }
    }

    @PermissionCallback
    private void displayPermissionResult(PluginCall call) {
        NeboNotificationReceiver.preferences(getContext()).edit().putBoolean("permissionAsked", true).apply();
        resolvePermission(call);
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        try {
            Intent intent;
            if (Build.VERSION.SDK_INT >= 26) {
                intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                    .putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
            } else {
                intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
                    .setData(Uri.parse("package:" + getContext().getPackageName()));
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            resolveStatus(call, "opened");
        } catch (RuntimeException ignored) {
            resolveStatus(call, "unavailable");
        }
    }

    @PluginMethod
    public void configure(PluginCall call) {
        try {
            resolveStatus(call, NeboNotificationReceiver.configure(
                getContext(), call.getString("accountId", ""),
                Boolean.TRUE.equals(call.getBoolean("enabled", false)),
                call.getString("quietStart", "22:00"), call.getString("quietEnd", "09:00"),
                call.getString("readDate", "")
            ));
        } catch (RuntimeException ignored) {
            resolveStatus(call, "unavailable");
        }
    }

    @PluginMethod
    public void schedule(PluginCall call) {
        try {
            JSArray notifications = call.getArray("notifications");
            resolveStatus(call, NeboNotificationReceiver.schedule(getContext(), notifications));
        } catch (RuntimeException ignored) {
            resolveStatus(call, "unavailable");
        }
    }

    @PluginMethod
    public void cancelAll(PluginCall call) {
        try {
            NeboNotificationReceiver.disableAndCancel(getContext());
            resolveStatus(call, "cancelled");
        } catch (RuntimeException ignored) {
            resolveStatus(call, "unavailable");
        }
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        if (intent == null) return;
        try {
            String route = intent.getStringExtra(NeboNotificationReceiver.EXTRA_ROUTE);
            String accountId = intent.getStringExtra(NeboNotificationReceiver.EXTRA_ACCOUNT);
            if (NeboNotificationReceiver.validRoute(route) && NeboNotificationReceiver.validAccount(accountId)) {
                // Wake JS without consuming the destination before authentication is ready.
                notifyListeners("notificationAction", new JSObject(), true);
            }
        } catch (RuntimeException ignored) {
            // Unrelated or malformed external intents do not produce notification actions.
        }
    }

    @PluginMethod
    public void consumeTap(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.resolve(new JSObject());
            return;
        }
        activity.runOnUiThread(() -> {
            JSObject result = new JSObject();
            Intent intent = activity.getIntent();
            if (intent != null) {
                try {
                    String route = intent.getStringExtra(NeboNotificationReceiver.EXTRA_ROUTE);
                    String accountId = intent.getStringExtra(NeboNotificationReceiver.EXTRA_ACCOUNT);
                    if (NeboNotificationReceiver.validRoute(route) && NeboNotificationReceiver.validAccount(accountId)) {
                        result.put("route", route);
                        result.put("accountId", accountId);
                    }
                } catch (RuntimeException ignored) {
                    // Ignore malformed external intents; only two bounded strings can cross the bridge.
                } finally {
                    intent.removeExtra(NeboNotificationReceiver.EXTRA_ROUTE);
                    intent.removeExtra(NeboNotificationReceiver.EXTRA_ACCOUNT);
                }
            }
            call.resolve(result);
        });
    }
}
