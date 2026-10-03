package ru.tvoygoroskop.app.speech;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.speech.RecognizerIntent;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;

/**
 * Dictation through the system speech recognizer (RecognizerIntent). The
 * recognizer app owns the microphone, so NEBO needs no audio permission.
 */
@CapacitorPlugin(name = "NativeSpeech")
public class NativeSpeechPlugin extends Plugin {

    private Intent recognizerIntent(String language, String prompt) {
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, language);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, language);
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        if (prompt != null && !prompt.trim().isEmpty()) intent.putExtra(RecognizerIntent.EXTRA_PROMPT, prompt);
        return intent;
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        PackageManager manager = getContext().getPackageManager();
        boolean available = !manager.queryIntentActivities(recognizerIntent("ru-RU", null), 0).isEmpty();
        JSObject result = new JSObject();
        result.put("available", available);
        call.resolve(result);
    }

    @PluginMethod
    public void recognize(PluginCall call) {
        String language = call.getString("language", "ru-RU");
        String prompt = call.getString("prompt", null);
        try {
            startActivityForResult(call, recognizerIntent(language, prompt), "handleRecognition");
        } catch (ActivityNotFoundException error) {
            call.reject("Speech recognition is not available", "SPEECH_UNAVAILABLE");
        }
    }

    @ActivityCallback
    private void handleRecognition(PluginCall call, ActivityResult activityResult) {
        if (call == null) return;
        if (activityResult.getResultCode() != Activity.RESULT_OK || activityResult.getData() == null) {
            call.reject("Speech recognition was cancelled", "SPEECH_CANCELLED");
            return;
        }
        ArrayList<String> matches = activityResult.getData().getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
        String text = matches == null || matches.isEmpty() ? "" : matches.get(0);
        JSObject result = new JSObject();
        result.put("text", text == null ? "" : text);
        call.resolve(result);
    }
}
