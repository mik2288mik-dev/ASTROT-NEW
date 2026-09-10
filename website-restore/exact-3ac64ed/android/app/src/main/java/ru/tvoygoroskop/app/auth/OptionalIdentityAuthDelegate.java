package ru.tvoygoroskop.app.auth;

import android.app.Activity;
import android.content.Context;

/**
 * Flavor-neutral boundary for an optional native identity implementation.
 * Provider SDK types stay outside the common and RuStore source sets.
 */
public interface OptionalIdentityAuthDelegate {
    interface Callback {
        void onSuccess(String credential);
        void onError(String code);
    }

    interface ClearCallback {
        void onSuccess();
        void onError(String code);
    }

    void start(
        Context context,
        Activity activity,
        String clientId,
        String nonce,
        Callback callback
    );

    void clear(Context context, ClearCallback callback);

    void cancel();
}
