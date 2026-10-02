package ru.tvoygoroskop.app.rustore;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import ru.rustore.sdk.review.RuStoreReviewManager;
import ru.rustore.sdk.review.RuStoreReviewManagerFactory;

/**
 * RuStore in-app rating sheet. Shown only when the web layer decides the moment
 * is right; every failure (no RuStore, not signed in, limit reached, already
 * reviewed) is reported as {shown:false} and never surfaces to the person.
 */
@CapacitorPlugin(name = "RuStoreReview")
public class RuStoreReviewPlugin extends Plugin {
    private void resolve(PluginCall call, boolean shown, String reason) {
        JSObject result = new JSObject();
        result.put("shown", shown);
        if (reason != null) result.put("reason", reason);
        call.resolve(result);
    }

    private String reasonOf(Throwable error) {
        return error == null ? "UNKNOWN" : error.getClass().getSimpleName();
    }

    @PluginMethod
    public void requestReview(PluginCall call) {
        try {
            RuStoreReviewManager manager = RuStoreReviewManagerFactory.INSTANCE.create(getActivity());
            manager.requestReviewFlow()
                .addOnSuccessListener(reviewInfo -> getActivity().runOnUiThread(() -> {
                    try {
                        manager.launchReviewFlow(reviewInfo)
                            .addOnSuccessListener(ignored -> resolve(call, true, null))
                            .addOnFailureListener(error -> resolve(call, false, reasonOf(error)));
                    } catch (RuntimeException | LinkageError error) {
                        resolve(call, false, reasonOf(error));
                    }
                }))
                .addOnFailureListener(error -> resolve(call, false, reasonOf(error)));
        } catch (RuntimeException | LinkageError error) {
            resolve(call, false, reasonOf(error));
        }
    }
}
