package ru.tvoygoroskop.app.media;

import android.content.Intent;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** JS bridge for MediaPlaybackService: show/update the media notification, stop it, receive buttons. */
@CapacitorPlugin(name = "NativeMediaSession")
public class NativeMediaSessionPlugin extends Plugin {

    private boolean running = false;

    @Override
    public void load() {
        MediaPlaybackService.setListener(action -> {
            JSObject payload = new JSObject();
            payload.put("action", action);
            notifyListeners("action", payload, true);
        });
    }

    @PluginMethod
    public void update(PluginCall call) {
        String title = call.getString("title", "NEBO");
        String subtitle = call.getString("subtitle", "");
        boolean playing = Boolean.TRUE.equals(call.getBoolean("playing", true));
        Intent intent = MediaPlaybackService.updateIntent(getContext(), title, subtitle, playing);
        try {
            if (!running && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) getContext().startForegroundService(intent);
            else getContext().startService(intent);
            running = true;
            call.resolve();
        } catch (RuntimeException error) {
            call.reject("Media notification is not available", "MEDIA_SESSION_UNAVAILABLE");
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (running) {
            Intent intent = new Intent(getContext(), MediaPlaybackService.class).setAction(MediaPlaybackService.ACTION_STOP);
            try {
                getContext().startService(intent);
            } catch (RuntimeException ignored) {
                getContext().stopService(new Intent(getContext(), MediaPlaybackService.class));
            }
        }
        running = false;
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        getContext().stopService(new Intent(getContext(), MediaPlaybackService.class));
        MediaPlaybackService.setListener(null);
        running = false;
    }
}
