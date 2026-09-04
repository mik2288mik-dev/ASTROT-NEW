package ru.tvoygoroskop.app;

import android.app.Application;
import android.util.Log;

import com.my.tracker.MyTracker;
import com.my.tracker.MyTrackerConfig;

/** Optional Android analytics setup. An empty SDK key keeps MyTracker disabled. */
public final class NeboApplication extends Application {
    private static final String TAG = "NEBO-MYTRACKER";

    @Override
    public void onCreate() {
        super.onCreate();
        final String sdkKey = BuildConfig.MYTRACKER_SDK_KEY == null ? "" : BuildConfig.MYTRACKER_SDK_KEY.trim();
        if (sdkKey.isEmpty()) {
            Log.i(TAG, "disabled: SDK key is not configured");
            return;
        }
        try {
            MyTrackerConfig config = MyTracker.getTrackerConfig();
            config.setAutotrackingPurchaseEnabled(false);
            MyTracker.initTracker(sdkKey, this);
            Log.i(TAG, "initialized");
        } catch (Throwable error) {
            Log.e(TAG, "initialization failed without blocking app startup", error);
        }
    }
}
