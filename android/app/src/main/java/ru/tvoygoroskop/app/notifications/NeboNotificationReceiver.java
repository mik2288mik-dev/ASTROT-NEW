package ru.tvoygoroskop.app.notifications;

import android.Manifest;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.service.notification.StatusBarNotification;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.ParsePosition;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

import ru.tvoygoroskop.app.MainActivity;
import ru.tvoygoroskop.app.R;

/** Rechecks the persisted account and all delivery gates when an inexact alarm actually fires. */
public class NeboNotificationReceiver extends BroadcastReceiver {
    static final String EXTRA_ROUTE = "nebo_notification_route";
    static final String EXTRA_ACCOUNT = "nebo_notification_account";
    private static final String ACTION_DELIVER = "ru.tvoygoroskop.app.NEBO_LOCAL_NOTIFICATION";
    private static final String CHANNEL_ID = "nebo_useful_v1";
    private static final String NOTIFICATION_TAG = "nebo_local";
    private static final String EXTRA_KIND = "nebo_notification_kind";
    private static final String EXTRA_DAY_KEY = "nebo_notification_day_key";
    private static final String PENDING = "pending";
    private static final Object LOCK = new Object();
    private static final long HORIZON_MS = 8L * 24 * 60 * 60 * 1000;
    private static final long WINDOW_MS = 15L * 60 * 1000;
    private static final long MIN_INTERVAL_MS = 6L * 60 * 60 * 1000;
    private static volatile boolean foreground;

    public static void setForeground(boolean value) {
        foreground = value;
    }

    static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences("nebo_local_notifications_v1", Context.MODE_PRIVATE);
    }

    static boolean validAccount(String value) {
        return value != null && value.matches("^-?[0-9]{1,20}$");
    }

    static boolean validRoute(String value) {
        return "today".equals(value) || "natal".equals(value);
    }

    static boolean hasRuntimePermission(Context context) {
        return Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(context,
            Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
    }

    private static boolean canDisplay(Context context) {
        if (!hasRuntimePermission(context) || !NotificationManagerCompat.from(context).areNotificationsEnabled()) return false;
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager manager = context.getSystemService(NotificationManager.class);
            NotificationChannel channel = manager == null ? null : manager.getNotificationChannel(CHANNEL_ID);
            if (channel != null && channel.getImportance() == NotificationManager.IMPORTANCE_NONE) return false;
        }
        return true;
    }

    static String permissionState(Context context) {
        if (canDisplay(context)) return "granted";
        if (Build.VERSION.SDK_INT >= 33 && !hasRuntimePermission(context)
            && !preferences(context).getBoolean("permissionAsked", false)) return "prompt";
        return "denied";
    }

    private static int minuteOfDay(String value) {
        if (value == null || !value.matches("^(?:[01][0-9]|2[0-3]):[0-5][0-9]$")) return -1;
        return Integer.parseInt(value.substring(0, 2)) * 60 + Integer.parseInt(value.substring(3, 5));
    }

    private static boolean validDate(String value) {
        if (value == null || !value.matches("^[0-9]{4}-[0-9]{2}-[0-9]{2}$")) return false;
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        format.setLenient(false);
        ParsePosition position = new ParsePosition(0);
        return format.parse(value, position) != null && position.getIndex() == value.length();
    }

    private static String localDate(long now) {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date(now));
    }

    private static JSONArray pending(SharedPreferences preferences) {
        try {
            JSONArray entries = new JSONArray(preferences.getString(PENDING, "[]"));
            return entries.length() <= 8 ? entries : new JSONArray();
        } catch (JSONException ignored) {
            return new JSONArray();
        }
    }

    static String configure(Context context, String accountId, boolean enabled, String quietStart,
                            String quietEnd, String readDate) {
        if ((enabled && !validAccount(accountId)) || (!accountId.isEmpty() && !validAccount(accountId))
            || minuteOfDay(quietStart) < 0 || minuteOfDay(quietEnd) < 0
            || (!readDate.isEmpty() && !validDate(readDate))) return "invalid";
        synchronized (LOCK) {
            SharedPreferences prefs = preferences(context);
            boolean readDateChanged = !readDate.equals(prefs.getString("readDate", ""));
            if (!accountId.equals(prefs.getString("accountId", "")) || !enabled) cancelOwned(context, prefs);
            boolean stored = prefs.edit().putString("accountId", accountId).putBoolean("enabled", enabled)
                .putString("quietStart", quietStart).putString("quietEnd", quietEnd).putString("readDate", readDate).commit();
            if (stored && readDateChanged && !readDate.isEmpty()) dismissReadDaily(context, accountId, readDate);
            return stored ? "configured" : "unavailable";
        }
    }

    static void disableAndCancel(Context context) {
        synchronized (LOCK) {
            SharedPreferences prefs = preferences(context);
            prefs.edit().putBoolean("enabled", false).putString("accountId", "").putString("readDate", "").commit();
            cancelOwned(context, prefs);
        }
    }

    /** Scheduling is replacement, not append, so periodic reconciliation cannot accumulate alarms. */
    static String schedule(Context context, JSONArray requested) {
        if (requested == null || requested.length() > 8) return "invalid";
        synchronized (LOCK) {
            SharedPreferences prefs = preferences(context);
            if (!prefs.getBoolean("enabled", false)) return "disabled";
            if (!canDisplay(context)) {
                cancelOwned(context, prefs);
                return "permission_required";
            }
            long now = System.currentTimeMillis();
            String account = prefs.getString("accountId", "");
            JSONArray entries = new JSONArray();
            Set<Integer> ids = new HashSet<>();
            try {
                for (int i = 0; i < requested.length(); i++) {
                    JSONObject item = requested.optJSONObject(i);
                    if (item == null) return "invalid";
                    long id = integer(item, "id");
                    long at = integer(item, "at");
                    long expiresAt = integer(item, "expiresAt");
                    String title = string(item, "title");
                    String body = string(item, "body");
                    String kind = string(item, "kind");
                    String route = string(item, "route");
                    String dayKey = string(item, "dayKey");
                    if (id <= 0 || id > Integer.MAX_VALUE || !ids.add((int) id)
                        || at <= now || at > now + HORIZON_MS || expiresAt <= at || expiresAt > now + HORIZON_MS
                        || !account.equals(string(item, "accountId")) || !validAccount(account)
                        || !plainText(title, 70) || !plainText(body, 180) || !validDate(dayKey)
                        || !("daily".equals(kind) || "ready".equals(kind)) || !validRoute(route)) return "invalid";
                    // Rebuild from the allowlist; arbitrary JS fields never enter persistent storage.
                    entries.put(new JSONObject().put("id", id).put("title", title).put("body", body)
                        .put("at", at).put("expiresAt", expiresAt).put("accountId", account)
                        .put("kind", kind).put("dayKey", dayKey).put("route", route)
                        .put("generation", UUID.randomUUID().toString()));
                }
                cancelPending(context, prefs);
                if (!prefs.edit().putString(PENDING, entries.toString()).commit()) return "unavailable";
                for (int i = 0; i < entries.length(); i++) setAlarm(context, entries.getJSONObject(i));
                return "scheduled";
            } catch (JSONException | RuntimeException ignored) {
                cancelPending(context, prefs);
                return "unavailable";
            }
        }
    }

    private static String string(JSONObject item, String key) {
        Object value = item.opt(key);
        return value instanceof String ? (String) value : "";
    }

    private static long integer(JSONObject item, String key) {
        Object value = item.opt(key);
        if (!(value instanceof Number)) return -1;
        double number = ((Number) value).doubleValue();
        if (Double.isNaN(number) || Double.isInfinite(number) || number != Math.rint(number)
            || number < 0 || number > Long.MAX_VALUE) return -1;
        return ((Number) value).longValue();
    }

    private static boolean plainText(String value, int maxLength) {
        if (value.isEmpty() || value.length() > maxLength || !value.equals(value.trim())) return false;
        for (int i = 0; i < value.length(); i++) {
            if (Character.isISOControl(value.charAt(i))) return false;
        }
        return true;
    }

    private static PendingIntent alarmIntent(Context context, int id, int flags) {
        Intent intent = new Intent(context, NeboNotificationReceiver.class).setAction(ACTION_DELIVER).putExtra("id", id);
        return PendingIntent.getBroadcast(context, id, intent, flags | PendingIntent.FLAG_IMMUTABLE);
    }

    private static void setAlarm(Context context, JSONObject entry) throws JSONException {
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms == null) throw new IllegalStateException("NOTIFICATION_ALARM_UNAVAILABLE");
        int id = entry.getInt("id");
        Intent intent = new Intent(context, NeboNotificationReceiver.class).setAction(ACTION_DELIVER)
            .putExtra("id", id).putExtra("generation", entry.getString("generation"));
        PendingIntent alarm = PendingIntent.getBroadcast(context, id, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        alarms.setWindow(AlarmManager.RTC_WAKEUP, entry.getLong("at"), WINDOW_MS, alarm);
    }

    private static void cancelPending(Context context, SharedPreferences prefs) {
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        JSONArray entries = pending(prefs);
        prefs.edit().putString(PENDING, "[]").commit();
        for (int i = 0; i < entries.length(); i++) {
            JSONObject item = entries.optJSONObject(i);
            if (item == null) continue;
            PendingIntent intent = alarmIntent(context, item.optInt("id"), PendingIntent.FLAG_NO_CREATE);
            if (intent != null) {
                if (alarms != null) alarms.cancel(intent);
                intent.cancel();
            }
        }
    }

    private static void cancelOwned(Context context, SharedPreferences prefs) {
        cancelPending(context, prefs);
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;
        for (StatusBarNotification item : manager.getActiveNotifications()) {
            if (NOTIFICATION_TAG.equals(item.getTag())) manager.cancel(NOTIFICATION_TAG, item.getId());
        }
    }

    private static void dismissReadDaily(Context context, String accountId, String readDate) {
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;
        for (StatusBarNotification item : manager.getActiveNotifications()) {
            if (!NOTIFICATION_TAG.equals(item.getTag())) continue;
            Bundle metadata = item.getNotification().extras;
            if (metadata != null && "daily".equals(metadata.getString(EXTRA_KIND))
                && accountId.equals(metadata.getString(EXTRA_ACCOUNT))
                && readDate.equals(metadata.getString(EXTRA_DAY_KEY))) {
                manager.cancel(NOTIFICATION_TAG, item.getId());
            }
        }
    }

    private static boolean quiet(SharedPreferences prefs, Calendar now) {
        int start = minuteOfDay(prefs.getString("quietStart", "22:00"));
        int end = minuteOfDay(prefs.getString("quietEnd", "09:00"));
        if (start < 0 || end < 0 || start == end) return true;
        int minute = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE);
        return start < end ? minute >= start && minute < end : minute >= start || minute < end;
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        synchronized (LOCK) {
            try {
                if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) restoreFuture(context);
                else if (ACTION_DELIVER.equals(intent.getAction())) {
                    deliver(context, intent.getIntExtra("id", -1), intent.getStringExtra("generation"));
                }
            } catch (JSONException | RuntimeException ignored) {
                // Optional reminders must never crash the host or log user-supplied content.
            }
        }
    }

    private static void restoreFuture(Context context) throws JSONException {
        SharedPreferences prefs = preferences(context);
        if (!prefs.getBoolean("enabled", false) || !canDisplay(context)) {
            cancelOwned(context, prefs);
            return;
        }
        long now = System.currentTimeMillis();
        JSONArray retained = new JSONArray();
        JSONArray entries = pending(prefs);
        String account = prefs.getString("accountId", "");
        for (int i = 0; i < entries.length(); i++) {
            JSONObject item = entries.getJSONObject(i);
            long at = item.optLong("at");
            long expiresAt = item.optLong("expiresAt");
            if (account.equals(item.optString("accountId")) && at > now && at <= now + HORIZON_MS
                && expiresAt > at && expiresAt <= now + HORIZON_MS) retained.put(item);
        }
        if (!prefs.edit().putString(PENDING, retained.toString()).commit()) return;
        for (int i = 0; i < retained.length(); i++) setAlarm(context, retained.getJSONObject(i));
    }

    private static void deliver(Context context, int id, String generation) throws JSONException {
        SharedPreferences prefs = preferences(context);
        JSONArray entries = pending(prefs);
        JSONArray retained = new JSONArray();
        JSONObject entry = null;
        for (int i = 0; i < entries.length(); i++) {
            JSONObject item = entries.getJSONObject(i);
            if (id == item.optInt("id") && generation != null && generation.equals(item.optString("generation"))) entry = item;
            else retained.put(item);
        }
        if (entry == null || !prefs.edit().putString(PENDING, retained.toString()).commit()) return;
        long now = System.currentTimeMillis();
        Calendar calendar = Calendar.getInstance();
        calendar.setTimeInMillis(now);
        String today = localDate(now);
        boolean daily = "daily".equals(entry.getString("kind"));
        long lastSentAt = prefs.getLong("lastSentAt", 0);
        if (!prefs.getBoolean("enabled", false) || foreground || !canDisplay(context)
            || !prefs.getString("accountId", "").equals(entry.getString("accountId"))
            || now < entry.getLong("at") || now >= entry.getLong("expiresAt") || quiet(prefs, calendar)
            || today.equals(prefs.getString("lastSentDate", ""))
            || (lastSentAt > 0 && now - lastSentAt < MIN_INTERVAL_MS)
            || (daily && (!today.equals(entry.getString("dayKey"))
                || entry.getString("dayKey").equals(prefs.getString("readDate", ""))
                || calendar.get(Calendar.HOUR_OF_DAY) < 9 || calendar.get(Calendar.HOUR_OF_DAY) >= 21))) return;

        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "NEBO · По делу", NotificationManager.IMPORTANCE_DEFAULT);
            channel.enableVibration(false);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
            manager.createNotificationChannel(channel);
        }
        Intent launch = new Intent(context, MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra(EXTRA_ROUTE, entry.getString("route")).putExtra(EXTRA_ACCOUNT, entry.getString("accountId"));
        PendingIntent tap = PendingIntent.getActivity(context, id, launch,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Bundle metadata = new Bundle();
        metadata.putString(EXTRA_KIND, entry.getString("kind"));
        metadata.putString(EXTRA_DAY_KEY, entry.getString("dayKey"));
        metadata.putString(EXTRA_ACCOUNT, entry.getString("accountId"));
        Notification notification = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_nebo_notification).setContentTitle(entry.getString("title"))
            .setContentText(entry.getString("body")).setStyle(new NotificationCompat.BigTextStyle().bigText(entry.getString("body")))
            .setContentIntent(tap).setAutoCancel(true).setOnlyAlertOnce(true).addExtras(metadata)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE).setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setVibrate(new long[] { 0L }).setTimeoutAfter(entry.getLong("expiresAt") - now).build();
        manager.notify(NOTIFICATION_TAG, id, notification);
        // Preserve these device-level gates across logout or account changes.
        prefs.edit().putString("lastSentDate", today).putLong("lastSentAt", now).commit();
    }
}
