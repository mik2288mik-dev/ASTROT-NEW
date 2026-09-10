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
import java.util.regex.Pattern;

@CapacitorPlugin(name = "NativeDiagnostics")
public class NativeDiagnosticsPlugin extends Plugin {
    private static final String TAG = "NEBO-DIAG";
    private static final String PREFS = "nebo_native_diagnostics";
    private static final String KEY_LOG = "log";
    private static final int MAX_CHARS = 64 * 1024;
    private static final int MAX_EVENT_CHARS = 4 * 1024;
    private static final String SENSITIVE_NAME = "(?:authorization|access[_-]?token|refresh[_-]?token|id[_-]?token|token|secret|client[_-]?secret|password(?:confirmation)?|email|otp|verification[_-]?code|authorization[_-]?code|challenge[_-]?id|state|nonce|code[_-]?challenge|code[_-]?verifier|device[_-]?id|init[_-]?data|cookie|session[_-]?id|code)";
    private static final Pattern SENSITIVE_OBJECT_FIELD = Pattern.compile(
        "(?i)(^|[^A-Za-z0-9_])(" + SENSITIVE_NAME + ")(\\s*[:=]\\s*)(?:\\{[^\\r\\n}]*\\}|\\[[^\\r\\n\\]]*\\])"
    );
    private static final Pattern SENSITIVE_DOUBLE_QUOTED_FIELD = Pattern.compile(
        "(?i)(^|[^A-Za-z0-9_])(" + SENSITIVE_NAME + ")(\\s*[:=]\\s*)\\\"(?:\\\\.|[^\\\"\\\\])*\\\""
    );
    private static final Pattern SENSITIVE_SINGLE_QUOTED_FIELD = Pattern.compile(
        "(?i)(^|[^A-Za-z0-9_])(" + SENSITIVE_NAME + ")(\\s*[:=]\\s*)'(?:\\\\.|[^'\\\\])*'"
    );
    private static final Pattern SENSITIVE_FIELD = Pattern.compile(
        "(?i)(^|[^A-Za-z0-9_])(" + SENSITIVE_NAME + ")(\\s*[:=]\\s*)([^\\\"'&,\\s}\\]]+)"
    );
    private static final Pattern SENSITIVE_QUERY = Pattern.compile(
        "(?i)([?&](?:authorization|access[_-]?token|refresh[_-]?token|id[_-]?token|token|secret|password|email|otp|code|state|nonce|challenge[_-]?id|device[_-]?id|init[_-]?data)=)[^&\\s]+"
    );
    private static final Pattern BEARER = Pattern.compile("(?i)Bearer\\s+[A-Za-z0-9._~+/=-]+");
    private static final Pattern BASIC = Pattern.compile("(?i)Basic\\s+[A-Za-z0-9+/=]+");
    private static final Pattern EMAIL = Pattern.compile("(?i)[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}");
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
        mark(context, "INFO", event);
    }

    public static void mark(Context context, String level, String event) {
        append(context.getApplicationContext(), normalizeLevel(level), event);
    }

    private static String normalizeLevel(String value) {
        String level = value == null ? "INFO" : value.trim().toUpperCase(Locale.ROOT);
        if ("ERROR".equals(level) || "WARN".equals(level) || "FATAL".equals(level)) return level;
        return "INFO";
    }

    private static String sanitize(String value) {
        String sanitized = value == null ? "" : value.replace('\n', ' ').replace('\r', ' ');
        sanitized = SENSITIVE_OBJECT_FIELD.matcher(sanitized).replaceAll("$1$2$3[REDACTED]");
        sanitized = SENSITIVE_DOUBLE_QUOTED_FIELD.matcher(sanitized).replaceAll("$1$2$3\\\"[REDACTED]\\\"");
        sanitized = SENSITIVE_SINGLE_QUOTED_FIELD.matcher(sanitized).replaceAll("$1$2$3'[REDACTED]'");
        sanitized = SENSITIVE_FIELD.matcher(sanitized).replaceAll("$1$2$3[REDACTED]");
        sanitized = SENSITIVE_QUERY.matcher(sanitized).replaceAll("$1[REDACTED]");
        sanitized = BEARER.matcher(sanitized).replaceAll("Bearer [REDACTED]");
        sanitized = BASIC.matcher(sanitized).replaceAll("Basic [REDACTED]");
        sanitized = EMAIL.matcher(sanitized).replaceAll("[EMAIL_REDACTED]");
        return sanitized.length() > MAX_EVENT_CHARS
            ? sanitized.substring(0, MAX_EVENT_CHARS)
            : sanitized;
    }

    private static synchronized void append(Context context, String level, String message) {
        String safeMessage = sanitize(message);
        String timestamp = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSZ", Locale.US).format(new Date());
        String line = timestamp + " [" + level + "] " + safeMessage + "\n";
        int priority = "ERROR".equals(level) || "FATAL".equals(level)
            ? Log.ERROR
            : ("WARN".equals(level) ? Log.WARN : Log.INFO);
        Log.println(priority, TAG, safeMessage);
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
        String level = call.getString("level", "INFO");
        mark(getContext(), level, event);
        call.resolve();
    }

    @PluginMethod
    public void clearLogs(PluginCall call) {
        getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(KEY_LOG).apply();
        mark(getContext(), "logs_cleared");
        call.resolve();
    }
}
