package ru.tvoygoroskop.app.auth;

import android.app.Activity;
import android.content.Context;

/**
 * Flavor boundary for Google identity. The implementation is compiled only
 * into development and Google Play variants; RuStore never packages it.
 */
public interface GoogleIdentityAuthDelegate {
    interface Callback {
        void onSuccess(String idToken);
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
