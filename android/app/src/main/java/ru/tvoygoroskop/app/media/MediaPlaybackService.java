package ru.tvoygoroskop.app.media;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.IBinder;

import ru.tvoygoroskop.app.MainActivity;

/**
 * Keeps NEBO audio (forecasts, stories, calm sounds) playing with the screen
 * locked: a foreground service with a media notification and lock-screen
 * controls. Playback itself stays in the WebView; buttons are sent back to it.
 */
public class MediaPlaybackService extends Service {

    static final String ACTION_UPDATE = "ru.tvoygoroskop.app.media.UPDATE";
    static final String ACTION_STOP = "ru.tvoygoroskop.app.media.STOP";
    static final String ACTION_BUTTON = "ru.tvoygoroskop.app.media.BUTTON";
    static final String EXTRA_TITLE = "title";
    static final String EXTRA_SUBTITLE = "subtitle";
    static final String EXTRA_PLAYING = "playing";
    static final String EXTRA_BUTTON = "button";

    private static final String CHANNEL_ID = "nebo_media";
    private static final int NOTIFICATION_ID = 63001;

    interface ActionListener {
        void onAction(String action);
    }

    private static ActionListener listener;
    private MediaSession session;
    private String title = "NEBO";
    private String subtitle = "";
    private boolean playing = true;

    static void setListener(ActionListener next) {
        listener = next;
    }

    static void emit(String action) {
        ActionListener current = listener;
        if (current != null) current.onAction(action);
    }

    @Override
    public void onCreate() {
        super.onCreate();
        session = new MediaSession(this, "NEBO");
        session.setCallback(new MediaSession.Callback() {
            @Override public void onPlay() { emit("play"); }
            @Override public void onPause() { emit("pause"); }
            @Override public void onStop() { emit("stop"); }
            @Override public void onSkipToNext() { emit("forward"); }
            @Override public void onSkipToPrevious() { emit("back"); }
            @Override public void onFastForward() { emit("forward"); }
            @Override public void onRewind() { emit("back"); }
        });
        session.setActive(true);
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Воспроизведение", NotificationManager.IMPORTANCE_LOW);
            channel.setShowBadge(false);
            channel.setSound(null, null);
            manager.createNotificationChannel(channel);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? null : intent.getAction();
        if (ACTION_STOP.equals(action)) {
            stopPlaybackService();
            return START_NOT_STICKY;
        }
        if (ACTION_BUTTON.equals(action)) {
            String button = intent.getStringExtra(EXTRA_BUTTON);
            if (button != null) emit(button);
            return START_NOT_STICKY;
        }
        if (intent != null) {
            String nextTitle = intent.getStringExtra(EXTRA_TITLE);
            if (nextTitle != null && !nextTitle.trim().isEmpty()) title = nextTitle.trim();
            String nextSubtitle = intent.getStringExtra(EXTRA_SUBTITLE);
            subtitle = nextSubtitle == null ? "" : nextSubtitle.trim();
            playing = intent.getBooleanExtra(EXTRA_PLAYING, true);
        }
        publish();
        return START_NOT_STICKY;
    }

    private PendingIntent buttonIntent(String button, int requestCode) {
        Intent intent = new Intent(this, MediaPlaybackService.class).setAction(ACTION_BUTTON).putExtra(EXTRA_BUTTON, button);
        return PendingIntent.getService(this, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private void publish() {
        session.setMetadata(new MediaMetadata.Builder()
            .putString(MediaMetadata.METADATA_KEY_TITLE, title)
            .putString(MediaMetadata.METADATA_KEY_ARTIST, subtitle.isEmpty() ? "NEBO" : subtitle)
            .build());
        long actions = PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PAUSE | PlaybackState.ACTION_PLAY_PAUSE
            | PlaybackState.ACTION_STOP | PlaybackState.ACTION_REWIND | PlaybackState.ACTION_FAST_FORWARD;
        session.setPlaybackState(new PlaybackState.Builder()
            .setActions(actions)
            .setState(playing ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED, PlaybackState.PLAYBACK_POSITION_UNKNOWN, 1f)
            .build());

        Intent open = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent content = PendingIntent.getActivity(this, 1, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(this, CHANNEL_ID)
            : new Notification.Builder(this);
        builder.setSmallIcon(getApplicationInfo().icon)
            .setContentTitle(title)
            .setContentText(subtitle.isEmpty() ? "NEBO" : subtitle)
            .setContentIntent(content)
            .setOngoing(playing)
            .setShowWhen(false)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setDeleteIntent(buttonIntent("stop", 5))
            .addAction(new Notification.Action.Builder(android.R.drawable.ic_media_rew, "Назад", buttonIntent("back", 2)).build())
            .addAction(playing
                ? new Notification.Action.Builder(android.R.drawable.ic_media_pause, "Пауза", buttonIntent("pause", 3)).build()
                : new Notification.Action.Builder(android.R.drawable.ic_media_play, "Играть", buttonIntent("play", 3)).build())
            .addAction(new Notification.Action.Builder(android.R.drawable.ic_menu_close_clear_cancel, "Стоп", buttonIntent("stop", 4)).build())
            .setStyle(new Notification.MediaStyle().setMediaSession(session.getSessionToken()).setShowActionsInCompactView(0, 1, 2));
        Notification notification = builder.build();
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } catch (RuntimeException error) {
            // Android refused a foreground start (e.g. from the background): keep playing without it.
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.notify(NOTIFICATION_ID, notification);
        }
    }

    private void stopPlaybackService() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) stopForeground(STOP_FOREGROUND_REMOVE);
        else stopForeground(true);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        if (session != null) {
            session.setActive(false);
            session.release();
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    static Intent updateIntent(Context context, String title, String subtitle, boolean playing) {
        return new Intent(context, MediaPlaybackService.class).setAction(ACTION_UPDATE)
            .putExtra(EXTRA_TITLE, title).putExtra(EXTRA_SUBTITLE, subtitle).putExtra(EXTRA_PLAYING, playing);
    }
}
