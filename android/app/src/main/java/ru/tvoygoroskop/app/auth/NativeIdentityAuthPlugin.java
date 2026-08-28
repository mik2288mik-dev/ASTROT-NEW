package ru.tvoygoroskop.app.auth;

import android.os.Handler;
import android.os.Looper;

import androidx.activity.result.ActivityResult;
import androidx.lifecycle.LifecycleOwner;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.vk.id.AccessToken;
import com.vk.id.VKID;
import com.vk.id.VKIDAuthFail;
import com.vk.id.auth.AuthCodeData;
import com.vk.id.auth.VKIDAuthCallback;
import com.vk.id.auth.VKIDAuthParams;
import com.yandex.authsdk.YandexAuthException;
import com.yandex.authsdk.YandexAuthLoginOptions;
import com.yandex.authsdk.YandexAuthOptions;
import com.yandex.authsdk.YandexAuthResult;
import com.yandex.authsdk.YandexAuthSdk;
import com.yandex.authsdk.internal.strategy.LoginType;

import java.io.IOException;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Pattern;

import ru.tvoygoroskop.app.BuildConfig;
import ru.tvoygoroskop.app.diagnostics.NativeDiagnosticsPlugin;

/**
 * Android-first identity proof bridge. Provider credentials are returned to the
 * web layer only for immediate server verification; this plugin never creates
 * the application's own session.
 */
@CapacitorPlugin(name = "NativeIdentityAuth")
public class NativeIdentityAuthPlugin extends Plugin {
    private static final String AUTH_CANCELLED = "AUTH_CANCELLED";
    private static final String AUTH_NETWORK = "AUTH_NETWORK";
    private static final String AUTH_CONFIGURATION = "AUTH_CONFIGURATION";
    private static final String AUTH_FAILED = "AUTH_FAILED";
    private static final String AUTH_TIMEOUT = "AUTH_TIMEOUT";
    // The provider UI may legitimately remain open while a person completes
    // credentials or a challenge. This only recovers a lost Activity callback.
    private static final long SIGN_IN_TIMEOUT_MS = 180_000L;
    private static final Pattern TRACE_ID_PATTERN = Pattern.compile("^[A-Za-z0-9_-]{8,64}$");

    private final AtomicBoolean signInInFlight = new AtomicBoolean(false);
    private final Object vkInitializationLock = new Object();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private volatile PluginCall activeSignInCall;
    private volatile Runnable activeSignInTimeout;
    private volatile String activeSignInProvider = "unknown";
    private volatile String activeSignInTraceId = "missing";
    private volatile String activeSignInStage = "sdk_validate";
    private volatile long activeSignInStartedAt;
    private volatile OptionalIdentityAuthDelegate googleAuthDelegate;
    private volatile boolean vkInitialized;
    private YandexAuthSdk yandexAuthSdk;
    private SecureSessionStore secureSessionStore;

    @Override
    public void load() {
        secureSessionStore = new SecureSessionStore(getContext());
    }

    @PluginMethod
    public void signIn(PluginCall call) {
        if (!signInInFlight.compareAndSet(false, true)) {
            reject(call, AUTH_FAILED);
            return;
        }
        activeSignInCall = call;
        activeSignInStartedAt = System.currentTimeMillis();
        scheduleSignInTimeout(call);

        String provider = option(call, "provider").toLowerCase(Locale.ROOT);
        activeSignInProvider = provider;
        activeSignInTraceId = traceId(call);
        activeSignInStage = "sdk_validate";
        markAuth("sdk_validate", "start", null, "INFO");
        getActivity().runOnUiThread(() -> {
            try {
                switch (provider) {
                    case "google":
                        if (!BuildConfig.GOOGLE_AUTH_ENABLED
                            || !"google_play".equals(BuildConfig.DISTRIBUTION_CHANNEL)) {
                            rejectSignIn(call, AUTH_CONFIGURATION);
                        } else {
                            startGoogleSignIn(call);
                        }
                        break;
                    case "yandex":
                        startYandexSignIn(call);
                        break;
                    case "vk":
                        startVkSignIn(call);
                        break;
                    default:
                        rejectSignIn(call, AUTH_CONFIGURATION);
                }
            } catch (RuntimeException error) {
                markAuth(activeSignInStage, "error", runtimeErrorKind(error), "ERROR");
                rejectSignIn(call, AUTH_CONFIGURATION);
            }
        });
    }

    private void startGoogleSignIn(PluginCall call) {
        String configuredClientId = BuildConfig.GOOGLE_AUTH_SERVER_CLIENT_ID.trim();
        String requestedClientId = option(call, "clientId");
        String nonce = option(call, "nonce");
        if (!matchesConfiguredClient(configuredClientId, requestedClientId) || isBlank(nonce)) {
            rejectSignIn(call, AUTH_CONFIGURATION);
            return;
        }

        OptionalIdentityAuthDelegate delegate = getGoogleAuthDelegate();
        if (delegate == null) {
            rejectSignIn(call, AUTH_CONFIGURATION);
            return;
        }
        activeSignInStage = "sdk_launch";
        markAuth("sdk_launch", "start", null, "INFO");
        delegate.start(
            getContext(),
            getActivity(),
            configuredClientId,
            nonce,
            new OptionalIdentityAuthDelegate.Callback() {
                @Override
                public void onSuccess(String idToken) {
                    getActivity().runOnUiThread(() -> {
                        JSObject result = new JSObject();
                        result.put("idToken", idToken);
                        resolveSignIn(call, result);
                    });
                }

                @Override
                public void onError(String code) {
                    getActivity().runOnUiThread(() -> rejectSignIn(call, code));
                }
            }
        );
    }

    /**
     * Yandex LoginSDK Activity Result flow documented at:
     * https://yandex.ru/dev/id/doc/ru/mobileauthsdk/android/3.2.1/sdk-android-use
     */
    private void startYandexSignIn(PluginCall call) {
        String configuredClientId = BuildConfig.YANDEX_ANDROID_CLIENT_ID.trim();
        String requestedClientId = option(call, "clientId");
        if (!matchesConfiguredClient(configuredClientId, requestedClientId)) {
            rejectSignIn(call, AUTH_CONFIGURATION);
            return;
        }

        activeSignInStage = "sdk_launch";
        markAuth("sdk_launch", "start", null, "INFO");
        YandexAuthSdk sdk = getYandexAuthSdk();
        YandexAuthLoginOptions loginOptions = new YandexAuthLoginOptions(
            LoginType.CHROME_TAB,
            configuredClientId
        );
        startActivityForResult(
            call,
            sdk.getContract().createIntent(getContext(), loginOptions),
            "handleYandexResult"
        );
    }

    @ActivityCallback
    private void handleYandexResult(PluginCall call, ActivityResult activityResult) {
        if (call == null) return;

        try {
            YandexAuthResult result = getYandexAuthSdk().getContract().parseResult(
                activityResult.getResultCode(),
                activityResult.getData()
            );
            if (result instanceof YandexAuthResult.Success) {
                String accessToken = ((YandexAuthResult.Success) result).getToken().getValue();
                if (isBlank(accessToken)) {
                    rejectSignIn(call, AUTH_FAILED);
                    return;
                }
                JSObject payload = new JSObject();
                payload.put("accessToken", accessToken);
                resolveSignIn(call, payload);
            } else if (result instanceof YandexAuthResult.Cancelled) {
                rejectSignIn(call, AUTH_CANCELLED);
            } else if (result instanceof YandexAuthResult.Failure) {
                YandexAuthException error = ((YandexAuthResult.Failure) result).getException();
                String errorKind = yandexErrorKind(error);
                markAuth("sdk_result", "error", "yandex_" + errorKind, "ERROR");
                rejectSignIn(call, "connection".equals(errorKind) ? AUTH_NETWORK : AUTH_FAILED);
            } else {
                rejectSignIn(call, AUTH_FAILED);
            }
        } catch (RuntimeException error) {
            markAuth("sdk_result", "error", runtimeErrorKind(error), "ERROR");
            rejectSignIn(call, AUTH_FAILED);
        }
    }

    /**
     * VK ID OAuth 2.1 auth-code flow verified against SDK 2.7.2:
     * https://github.com/VKCOM/vkid-android-sdk/blob/2.7.2/sdk/core/vkid/src/main/java/com/vk/id/auth/VKIDAuthParams.kt
     */
    private void startVkSignIn(PluginCall call) {
        String configuredClientId = BuildConfig.VK_ANDROID_CLIENT_ID.trim();
        String requestedClientId = option(call, "clientId");
        String state = option(call, "state");
        String codeChallenge = option(call, "codeChallenge");
        String codeChallengeMethod = option(call, "codeChallengeMethod");
        String redirectUri = option(call, "redirectUri");
        String expectedRedirectUri = "vk" + configuredClientId + "://vk.ru/blank.html";
        if (
            !BuildConfig.VK_ID_CONFIGURED
                || !matchesConfiguredClient(configuredClientId, requestedClientId)
                || isBlank(state)
                || isBlank(codeChallenge)
                || !"S256".equalsIgnoreCase(codeChallengeMethod)
                || !expectedRedirectUri.equals(redirectUri)
        ) {
            rejectSignIn(call, AUTH_CONFIGURATION);
            return;
        }
        if (!(getActivity() instanceof LifecycleOwner)) {
            rejectSignIn(call, AUTH_CONFIGURATION);
            return;
        }

        activeSignInStage = "sdk_launch";
        markAuth("sdk_launch", "start", null, "INFO");
        ensureVkInitialized();
        VKIDAuthParams.Builder builder = new VKIDAuthParams.Builder();
        builder.setState(state);
        builder.setCodeChallenge(codeChallenge);
        VKIDAuthParams params = builder.build();

        VKID.Companion.getInstance().authorize(
            (LifecycleOwner) getActivity(),
            new VKIDAuthCallback() {
                @Override
                public void onAuth(AccessToken token) {
                    // Supplying our server PKCE challenge must complete through onAuthCode.
                    rejectSignIn(call, AUTH_FAILED);
                }

                @Override
                public void onAuthCode(AuthCodeData data, boolean isCompletion) {
                    if (!isCompletion) return;
                    String code = data.getCode();
                    String deviceId = data.getDeviceId();
                    if (isBlank(code) || isBlank(deviceId)) {
                        rejectSignIn(call, AUTH_FAILED);
                        return;
                    }
                    JSObject result = new JSObject();
                    result.put("code", code);
                    result.put("deviceId", deviceId);
                    result.put("state", state);
                    resolveSignIn(call, result);
                }

                @Override
                public void onFail(VKIDAuthFail error) {
                    if (error instanceof VKIDAuthFail.Canceled) {
                        markAuth("sdk_result", "cancelled", "vk_cancelled", "WARN");
                        rejectSignIn(call, AUTH_CANCELLED);
                    } else if (isVkNetworkError(error)) {
                        markAuth("sdk_result", "error", "vk_network", "ERROR");
                        rejectSignIn(call, AUTH_NETWORK);
                    } else {
                        String kind = error instanceof VKIDAuthFail.FailedApiCall
                            ? "vk_failed_api_call"
                            : "vk_unexpected_result";
                        markAuth("sdk_result", "error", kind, "ERROR");
                        rejectSignIn(call, AUTH_FAILED);
                    }
                }
            },
            params
        );
    }

    @PluginMethod
    public void clearCredentialState(PluginCall call) {
        String provider = option(call, "provider").toLowerCase(Locale.ROOT);
        if (!provider.isEmpty() && !"google".equals(provider) && !"yandex".equals(provider) && !"vk".equals(provider)) {
            reject(call, AUTH_CONFIGURATION);
            return;
        }

        // Yandex and our external-PKCE VK flow do not retain an app access token.
        if (!provider.isEmpty() && !"google".equals(provider)) {
            call.resolve(new JSObject().put("cleared", true));
            return;
        }

        if (!BuildConfig.GOOGLE_AUTH_ENABLED) {
            call.resolve(new JSObject().put("cleared", true));
            return;
        }
        OptionalIdentityAuthDelegate delegate = getGoogleAuthDelegate();
        if (delegate == null) {
            reject(call, AUTH_CONFIGURATION);
            return;
        }
        delegate.clear(getContext(), new OptionalIdentityAuthDelegate.ClearCallback() {
            @Override
            public void onSuccess() {
                call.resolve(new JSObject().put("cleared", true));
            }

            @Override
            public void onError(String code) {
                reject(call, code);
            }
        });
    }

    @PluginMethod
    public void getSessionToken(PluginCall call) {
        getBridge().execute(() -> {
            JSObject result = new JSObject();
            try {
                String token = secureSessionStore.read();
                if (token == null) result.put("token", "");
                else result.put("token", token);
                call.resolve(result);
            } catch (Exception error) {
                secureSessionStore.clear();
                reject(call, AUTH_FAILED);
            }
        });
    }

    @PluginMethod
    public void setSessionToken(PluginCall call) {
        String token = call.getString("token");
        if (token == null || token.trim().isEmpty()) {
            reject(call, AUTH_CONFIGURATION);
            return;
        }
        getBridge().execute(() -> {
            try {
                secureSessionStore.write(token);
                call.resolve(new JSObject().put("stored", true));
            } catch (Exception error) {
                reject(call, AUTH_FAILED);
            }
        });
    }

    @PluginMethod
    public void clearSessionToken(PluginCall call) {
        getBridge().execute(() -> {
            secureSessionStore.clear();
            call.resolve(new JSObject().put("cleared", true));
        });
    }

    @Override
    protected void handleOnDestroy() {
        OptionalIdentityAuthDelegate delegate = googleAuthDelegate;
        if (delegate != null) delegate.cancel();
        cancelSignInTimeout();
        PluginCall call = activeSignInCall;
        if (call != null && signInInFlight.compareAndSet(true, false)) {
            activeSignInCall = null;
            markAuth(activeSignInStage, "cancelled", AUTH_CANCELLED, "WARN");
            clearActiveSignInDiagnostic();
            call.reject(AUTH_CANCELLED, AUTH_CANCELLED);
        }
        super.handleOnDestroy();
    }

    private synchronized YandexAuthSdk getYandexAuthSdk() {
        if (yandexAuthSdk == null) {
            yandexAuthSdk = YandexAuthSdk.create(new YandexAuthOptions(getContext()));
        }
        return yandexAuthSdk;
    }

    private synchronized OptionalIdentityAuthDelegate getGoogleAuthDelegate() {
        if (!BuildConfig.GOOGLE_AUTH_ENABLED) return null;
        if (googleAuthDelegate != null) return googleAuthDelegate;
        String handlerClass = BuildConfig.OPTIONAL_IDENTITY_AUTH_HANDLER_CLASS.trim();
        if (handlerClass.isEmpty()) return null;
        try {
            Class<?> handler = Class.forName(handlerClass);
            googleAuthDelegate = (OptionalIdentityAuthDelegate) handler.getDeclaredConstructor().newInstance();
            return googleAuthDelegate;
        } catch (ReflectiveOperationException | ClassCastException error) {
            return null;
        }
    }

    private void ensureVkInitialized() {
        if (vkInitialized) return;
        synchronized (vkInitializationLock) {
            if (vkInitialized) return;
            VKID.Companion.init(getContext().getApplicationContext());
            vkInitialized = true;
        }
    }

    private boolean matchesConfiguredClient(String configuredClientId, String requestedClientId) {
        return !isBlank(configuredClientId) && configuredClientId.equals(requestedClientId);
    }

    private String yandexErrorKind(YandexAuthException error) {
        if (error == null) return "unknown";
        String[] codes = error.getErrors();
        if (codes != null) {
            for (String code : codes) {
                if (YandexAuthException.CONNECTION_ERROR.equals(code)) return "connection";
                if (YandexAuthException.SECURITY_ERROR.equals(code)) return "security";
                if (YandexAuthException.JWT_AUTHORIZATION_ERROR.equals(code)) return "jwt_authorization";
                if (YandexAuthException.UNKNOWN_ERROR.equals(code)) return "unknown";
            }
        }
        return hasNetworkCause(error) ? "connection" : "unrecognized";
    }

    private boolean isVkNetworkError(VKIDAuthFail error) {
        return error instanceof VKIDAuthFail.FailedApiCall
            && hasNetworkCause(((VKIDAuthFail.FailedApiCall) error).getThrowable());
    }

    private boolean hasNetworkCause(Throwable error) {
        Throwable cursor = error;
        while (cursor != null) {
            if (cursor instanceof IOException) return true;
            cursor = cursor.getCause();
        }
        return false;
    }

    private String runtimeErrorKind(RuntimeException error) {
        if (hasNetworkCause(error)) return "sdk_network_exception";
        if (error instanceof SecurityException) return "sdk_security_exception";
        if (error instanceof IllegalStateException) return "sdk_illegal_state";
        if (error instanceof IllegalArgumentException) return "sdk_illegal_argument";
        return "sdk_runtime_exception";
    }

    private String option(PluginCall call, String name) {
        String value = call.getString(name);
        if (isBlank(value)) {
            JSObject configuration = call.getObject("configuration");
            if (configuration != null) value = configuration.optString(name, "");
        }
        return value == null ? "" : value.trim();
    }

    private String traceId(PluginCall call) {
        String value = option(call, "traceId");
        return TRACE_ID_PATTERN.matcher(value).matches() ? value : "missing";
    }

    private void markAuth(String stage, String status, String errorCode, String level) {
        long startedAt = activeSignInStartedAt;
        long durationMs = startedAt > 0 ? Math.max(0, System.currentTimeMillis() - startedAt) : 0;
        String event = "auth_provider"
            + " traceId=" + activeSignInTraceId
            + " side=native"
            + " stage=" + stage
            + " status=" + status
            + " durationMs=" + durationMs
            + " provider=" + activeSignInProvider
            + (isBlank(errorCode) ? "" : " errorCode=" + errorCode);
        NativeDiagnosticsPlugin.mark(getContext(), level, event);
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private void scheduleSignInTimeout(PluginCall call) {
        cancelSignInTimeout();
        Runnable timeout = () -> rejectSignIn(call, AUTH_TIMEOUT);
        activeSignInTimeout = timeout;
        mainHandler.postDelayed(timeout, SIGN_IN_TIMEOUT_MS);
    }

    private void cancelSignInTimeout() {
        Runnable timeout = activeSignInTimeout;
        if (timeout == null) return;
        mainHandler.removeCallbacks(timeout);
        activeSignInTimeout = null;
    }

    private void resolveSignIn(PluginCall call, JSObject result) {
        if (activeSignInCall != call || !signInInFlight.compareAndSet(true, false)) return;
        activeSignInCall = null;
        cancelSignInTimeout();
        markAuth("credential_received", "ok", null, "INFO");
        clearActiveSignInDiagnostic();
        call.resolve(result);
    }

    private void rejectSignIn(PluginCall call, String code) {
        if (activeSignInCall != call || !signInInFlight.compareAndSet(true, false)) return;
        activeSignInCall = null;
        cancelSignInTimeout();
        String status = AUTH_CANCELLED.equals(code)
            ? "cancelled"
            : (AUTH_TIMEOUT.equals(code) ? "timeout" : "error");
        markAuth(activeSignInStage, status, code, AUTH_CANCELLED.equals(code) ? "WARN" : "ERROR");
        clearActiveSignInDiagnostic();
        reject(call, code);
    }

    private void clearActiveSignInDiagnostic() {
        activeSignInProvider = "unknown";
        activeSignInTraceId = "missing";
        activeSignInStage = "sdk_validate";
        activeSignInStartedAt = 0;
    }

    private void reject(PluginCall call, String code) {
        call.reject(code, code);
    }
}
