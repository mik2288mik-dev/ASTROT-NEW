package ru.tvoygoroskop.app.analytics;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Locale;
import java.util.regex.Pattern;
import ru.tvoygoroskop.app.NeboApplication;

/** Only opaque server-issued account UUIDs cross this bridge. */
@CapacitorPlugin(name = "MyTracker")
public class MyTrackerPlugin extends Plugin {
    private static final Pattern UUID = Pattern.compile("^[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$");

    private void resolveStatus(PluginCall call, boolean enabled) {
        JSObject result = new JSObject();
        result.put("enabled", enabled);
        call.resolve(result);
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        resolveStatus(call, NeboApplication.isAnalyticsEnabled());
    }

    @PluginMethod
    public void identify(PluginCall call) {
        String analyticsUserId = call.getString("analyticsUserId");
        if (analyticsUserId == null || !UUID.matcher(analyticsUserId).matches()) {
            call.reject("MYTRACKER_USER_ID_INVALID");
            return;
        }
        resolveStatus(call, NeboApplication.identify(analyticsUserId.toLowerCase(Locale.ROOT)));
    }

    @PluginMethod
    public void reset(PluginCall call) {
        resolveStatus(call, NeboApplication.resetIdentity());
    }
}
