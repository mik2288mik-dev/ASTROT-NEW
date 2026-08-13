package ru.tvoygoroskop.app.auth;

import android.app.Activity;
import android.content.Context;
import android.os.CancellationSignal;

import androidx.core.content.ContextCompat;
import androidx.credentials.ClearCredentialStateRequest;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.ClearCredentialException;
import androidx.credentials.exceptions.ClearCredentialProviderConfigurationException;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.credentials.exceptions.GetCredentialProviderConfigurationException;

import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

/** Google implementation shared only by development and Google Play flavors. */
public final class GoogleIdentityAuthHandler implements GoogleIdentityAuthDelegate {
    private static final String AUTH_CANCELLED = "AUTH_CANCELLED";
    private static final String AUTH_CONFIGURATION = "AUTH_CONFIGURATION";
    private static final String AUTH_FAILED = "AUTH_FAILED";

    private volatile CancellationSignal cancellationSignal;

    @Override
    public void start(
        Context context,
        Activity activity,
        String clientId,
        String nonce,
        Callback callback
    ) {
        GetSignInWithGoogleOption option = new GetSignInWithGoogleOption.Builder(clientId)
            .setNonce(nonce)
            .build();
        GetCredentialRequest request = new GetCredentialRequest.Builder()
            .addCredentialOption(option)
            .build();
        CancellationSignal nextCancellationSignal = new CancellationSignal();
        cancellationSignal = nextCancellationSignal;

        CredentialManager.create(context).getCredentialAsync(
            activity,
            request,
            nextCancellationSignal,
            ContextCompat.getMainExecutor(context),
            new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                @Override
                public void onResult(GetCredentialResponse response) {
                    Credential credential = response.getCredential();
                    if (!(credential instanceof CustomCredential)) {
                        callback.onError(AUTH_FAILED);
                        return;
                    }
                    CustomCredential customCredential = (CustomCredential) credential;
                    String type = customCredential.getType();
                    boolean supportedType = GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(type)
                        || GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_SIWG_CREDENTIAL.equals(type);
                    if (!supportedType) {
                        callback.onError(AUTH_FAILED);
                        return;
                    }
                    try {
                        GoogleIdTokenCredential googleCredential = GoogleIdTokenCredential.createFrom(
                            customCredential.getData()
                        );
                        callback.onSuccess(googleCredential.getIdToken());
                    } catch (Exception error) {
                        callback.onError(AUTH_FAILED);
                    }
                }

                @Override
                public void onError(GetCredentialException error) {
                    if (error instanceof GetCredentialCancellationException) {
                        callback.onError(AUTH_CANCELLED);
                    } else if (error instanceof GetCredentialProviderConfigurationException) {
                        callback.onError(AUTH_CONFIGURATION);
                    } else {
                        callback.onError(AUTH_FAILED);
                    }
                }
            }
        );
    }

    @Override
    public void clear(Context context, ClearCallback callback) {
        try {
            CredentialManager.create(context).clearCredentialStateAsync(
                new ClearCredentialStateRequest(),
                null,
                ContextCompat.getMainExecutor(context),
                new CredentialManagerCallback<Void, ClearCredentialException>() {
                    @Override
                    public void onResult(Void unused) {
                        callback.onSuccess();
                    }

                    @Override
                    public void onError(ClearCredentialException error) {
                        callback.onError(
                            error instanceof ClearCredentialProviderConfigurationException
                                ? AUTH_CONFIGURATION
                                : AUTH_FAILED
                        );
                    }
                }
            );
        } catch (RuntimeException error) {
            callback.onError(AUTH_CONFIGURATION);
        }
    }

    @Override
    public void cancel() {
        CancellationSignal active = cancellationSignal;
        cancellationSignal = null;
        if (active != null) active.cancel();
    }
}
