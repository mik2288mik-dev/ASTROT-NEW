package com.yourhoroscope.app.rustore;

import android.content.Intent;

import ru.rustore.sdk.pay.RuStorePayClient;
import ru.rustore.sdk.pay.model.SdkTheme;

/** Routes a bank/SBP return deep link back into the Pay SDK payment sheet. */
public final class RuStorePayBridge {
    private RuStorePayBridge() {}

    public static void proceedIntent(Intent intent) {
        RuStorePayClient.Companion.getInstance()
            .getIntentInteractor()
            .proceedIntent(intent, SdkTheme.LIGHT);
    }
}
