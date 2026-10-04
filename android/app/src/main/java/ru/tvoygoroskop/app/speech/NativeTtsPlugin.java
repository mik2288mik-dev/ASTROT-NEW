package ru.tvoygoroskop.app.speech;

import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONException;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Reads text aloud with the phone's own speech engine (free, works offline).
 * The whole text is queued natively sentence by sentence, so reading goes on
 * with the screen locked; JS hears which sentence is being read for the player.
 */
@CapacitorPlugin(name = "NativeTts")
public class NativeTtsPlugin extends Plugin {

    private TextToSpeech tts;
    private boolean ready = false;
    private boolean failed = false;
    private final List<Runnable> waiting = new ArrayList<>();
    private String session = "";

    @Override
    public void load() {
        tts = new TextToSpeech(getContext(), status -> {
            ready = status == TextToSpeech.SUCCESS;
            failed = !ready;
            List<Runnable> queued = new ArrayList<>(waiting);
            waiting.clear();
            for (Runnable task : queued) task.run();
        });
        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override
            public void onStart(String utteranceId) {
                emit("start", utteranceId);
            }

            @Override
            public void onDone(String utteranceId) {
                emit("done", utteranceId);
            }

            @Override
            public void onError(String utteranceId) {
                emit("error", utteranceId);
            }
        });
    }

    /** Utterance ids are «session:index»; events of an older session are dropped. */
    private void emit(String event, String utteranceId) {
        if (utteranceId == null) return;
        int split = utteranceId.lastIndexOf(':');
        if (split < 0 || !utteranceId.substring(0, split).equals(session)) return;
        JSObject payload = new JSObject();
        payload.put("session", session);
        try {
            payload.put("index", Integer.parseInt(utteranceId.substring(split + 1)));
        } catch (NumberFormatException error) {
            return;
        }
        notifyListeners(event, payload);
    }

    private void whenReady(PluginCall call, Runnable task) {
        if (ready) task.run();
        else if (failed) call.reject("Speech engine is not available", "TTS_UNAVAILABLE");
        else waiting.add(task);
    }

    private Locale locale(String language) {
        return "en".equals(language) ? Locale.US : new Locale("ru", "RU");
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        String language = call.getString("language", "ru");
        whenReady(call, () -> {
            int result = tts.isLanguageAvailable(locale(language));
            JSObject payload = new JSObject();
            payload.put("available", result >= TextToSpeech.LANG_AVAILABLE);
            call.resolve(payload);
        });
    }

    @PluginMethod
    public void speak(PluginCall call) {
        JSArray sentences = call.getArray("sentences", new JSArray());
        int start = call.getInt("startIndex", 0);
        String language = call.getString("language", "ru");
        float rate = call.getFloat("rate", 1f);
        String nextSession = call.getString("session", String.valueOf(System.currentTimeMillis()));
        whenReady(call, () -> {
            session = nextSession;
            tts.stop();
            tts.setLanguage(locale(language));
            tts.setSpeechRate(Math.max(0.5f, Math.min(2f, rate)));
            tts.setPitch(1f);
            try {
                for (int index = Math.max(0, start); index < sentences.length(); index++) {
                    Bundle params = new Bundle();
                    tts.speak(sentences.getString(index), TextToSpeech.QUEUE_ADD, params, session + ":" + index);
                }
                call.resolve();
            } catch (JSONException error) {
                call.reject("Bad text", "TTS_BAD_TEXT");
            }
        });
    }

    @PluginMethod
    public void stop(PluginCall call) {
        session = "";
        if (tts != null) tts.stop();
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        if (tts != null) {
            tts.stop();
            tts.shutdown();
        }
    }
}
