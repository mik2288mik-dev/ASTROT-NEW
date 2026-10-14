package ru.tvoygoroskop.app.share;

import android.content.ActivityNotFoundException;
import android.content.Intent;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Opens the system «Поделиться» sheet with plain text, e.g. an invite link for close people. */
@CapacitorPlugin(name = "NativeShare")
public class NativeSharePlugin extends Plugin {

    @PluginMethod
    public void shareText(PluginCall call) {
        String text = call.getString("text", "");
        if (text == null || text.trim().isEmpty()) {
            call.reject("TEXT_REQUIRED");
            return;
        }
        Intent send = new Intent(Intent.ACTION_SEND);
        send.setType("text/plain");
        send.putExtra(Intent.EXTRA_TEXT, text);
        Intent chooser = Intent.createChooser(send, call.getString("title", ""));
        try {
            getActivity().startActivity(chooser);
            call.resolve();
        } catch (ActivityNotFoundException error) {
            call.reject("SHARE_UNAVAILABLE");
        }
    }
}
