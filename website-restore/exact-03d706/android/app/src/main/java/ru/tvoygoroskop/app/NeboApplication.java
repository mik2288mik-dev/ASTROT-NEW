package ru.tvoygoroskop.app;

import android.app.Application;

import com.my.tracker.MyTracker;
import com.my.tracker.MyTrackerConfig;

import java.util.Collections;

/** Optional Android analytics. Identity is restored only after server authentication. */
public final class NeboApplication extends Application {
    private static volatile boolean ready = false;
    private static String currentUserId = null;

    @Override
    public void onCreate() {
        super.onCreate();
        String sdkKey = BuildConfig.MYTRACKER_SDK_KEY.trim();
        if (sdkKey.isEmpty()) return;
        synchronized (NeboApplication.class) {
            if (ready) return;
            try {
                MyTracker.getTrackerConfig()
                    .setLocationTrackingMode(MyTrackerConfig.LocationTrackingMode.NONE)
                    .setTrackingEnvironmentEnabled(false)
                    .setInstalledPackagesProvider(() -> Collections.emptyList())
                    .setAutotrackingPurchaseEnabled(false)
                    .setTrackingPreinstallThirdPartyEnabled(false);
                // Never carry an earlier account's identity into an anonymous cold start.
                MyTracker.getTrackerParams().setCustomUserId(null);
                currentUserId = null;
                MyTracker.initTracker(sdkKey, this);
                ready = true;
            } catch (RuntimeException | LinkageError ignored) {
                // An absent/misconfigured SDK cannot stop the app. No SDK keys or user data are logged.
                ready = false;
            }
        }
    }

    public static boolean isAnalyticsEnabled() {
        return ready;
    }

    public static synchronized boolean identify(String analyticsUserId) {
        if (!ready) return false;
        if (analyticsUserId.equals(currentUserId)) return true;
        try {
            MyTracker.getTrackerParams().setCustomUserId(analyticsUserId);
            // The optional second SDK argument is VK Connect ID; do not send one.
            MyTracker.trackLoginEvent(analyticsUserId, null);
            MyTracker.flush();
            currentUserId = analyticsUserId;
            return true;
        } catch (RuntimeException | LinkageError ignored) {
            return false;
        }
    }

    public static synchronized boolean resetIdentity() {
        currentUserId = null;
        if (!ready) return false;
        try {
            MyTracker.getTrackerParams().setCustomUserId(null);
            MyTracker.flush();
            return true;
        } catch (RuntimeException | LinkageError ignored) {
            // Do not allow a subsequent account to use a stale SDK identity after reset failure.
            ready = false;
            return false;
        }
    }
}
