package ru.tvoygoroskop.app.diagnostics;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

@CapacitorPlugin(name = "NativeDiagnostics")
public class NativeDiagnosticsPlugin extends Plugin {
    private static final String TAG = "NEBO-DIAG";
    private static final String PREFS = "nebo_native_diagnostics";
    private static final String KEY_LOG = "log";
    private static final int MAX_CHARS = 64 * 1024;
    private static volatile boolean crashHandlerInstalled = false;

    public static void installCrashHandler(Context context) {
        if (crashHandlerInstalled) return;
        synchronized (NativeDiagnosticsPlugin.class) {
            if (crashHandlerInstalled) return;
            crashHandlerInstalled = true;
            final Context appContext = context.getApplicationContext();
            final Thread.UncaughtExceptionHandler previous = Thread.getDefaultUncaughtExceptionHandler();
            Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
                try {
                    StringWriter writer = new StringWriter();
                    throwable.printStackTrace(new PrintWriter(writer));
                    append(appContext, "FATAL", "uncaught_exception thread=" + thread.getName() + "\n" + writer);
                } catch (Throwable ignored) {
                    // Never interfere with Android's own crash handling.
                }
                if (previous != null) previous.uncaughtException(thread, throwable);
            });
            append(appContext, "INFO", "crash_handler_installed sdk=" + Build.VERSION.SDK_INT
                + " manufacturer=" + Build.MANUFACTURER + " model=" + Build.MODEL);
        }
    }

    public static void mark(Context context, String event) {
        append(context.getApplicationContext(), "INFO", event);
    }

    private static synchronized void append(Context context, String level, String message) {
        String timestamp = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSZ", Locale.US).format(new Date());
        String line = timestamp + " [" + level + "] " + message + "\n";
        Log.println("FATAL".equals(level) ? Log.ERROR : Log.INFO, TAG, message);
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String current = prefs.getString(KEY_LOG, "");
        String next = current + line;
        if (next.length() > MAX_CHARS) next = next.substring(next.length() - MAX_CHARS);
        prefs.edit().putString(KEY_LOG, next).apply();
    }

    @Override
    public void load() {
        installCrashHandler(getContext());
        mark(getContext(), "capacitor_plugin_loaded");
    }

    @PluginMethod
    public void getLogs(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        JSObject result = new JSObject();
        result.put("text", prefs.getString(KEY_LOG, ""));
        result.put("sdk", Build.VERSION.SDK_INT);
        result.put("manufacturer", Build.MANUFACTURER);
        result.put("model", Build.MODEL);
        call.resolve(result);
    }

    @PluginMethod
    public void mark(PluginCall call) {
        String event = call.getString("event", "js_mark");
        mark(getContext(), event.replace('\n', ' '));
        call.resolve();
    }

    @PluginMethod
    public void clearLogs(PluginCall call) {
        getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(KEY_LOG).apply();
        mark(getContext(), "logs_cleared");
        call.resolve();
    }
}
