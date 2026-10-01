package ru.tvoygoroskop.app.rustore;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.concurrent.atomic.AtomicBoolean;
import ru.rustore.sdk.appupdate.listener.InstallStateUpdateListener;
import ru.rustore.sdk.appupdate.manager.RuStoreAppUpdateManager;
import ru.rustore.sdk.appupdate.manager.factory.RuStoreAppUpdateManagerFactory;
import ru.rustore.sdk.appupdate.model.AppUpdateOptions;
import ru.rustore.sdk.appupdate.model.AppUpdateType;
import ru.rustore.sdk.appupdate.model.InstallStatus;
import ru.rustore.sdk.appupdate.model.UpdateAvailability;

/** Updates start only after the user presses Update; FLEXIBLE completion restarts the app. */
@CapacitorPlugin(name = "RuStoreUpdate")
public final class RuStoreUpdateBridge extends Plugin {
    private RuStoreAppUpdateManager updateManager;
    private boolean listenerRegistered;
    private volatile boolean updateRequested;
    private final AtomicBoolean completionRequested = new AtomicBoolean(false);

    private final InstallStateUpdateListener installListener = state -> {
        if (updateRequested && state.getInstallStatus() == InstallStatus.DOWNLOADED) completeUpdate();
        if (state.getInstallStatus() == InstallStatus.FAILED
            || state.getInstallStatus() == InstallStatus.DOWNLOAD_INTERRUPTED) {
            updateRequested = false;
        }
    };

    private void ensureManager() {
        if (updateManager == null) updateManager = RuStoreAppUpdateManagerFactory.INSTANCE.create(getActivity());
        if (!listenerRegistered) {
            updateManager.registerListener(installListener);
            listenerRegistered = true;
        }
    }

    @PluginMethod
    public void startUpdate(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                ensureManager();
                updateManager.getAppUpdateInfo().addOnSuccessListener(info -> {
                    try {
                        if (info.getInstallStatus() == InstallStatus.DOWNLOADED) {
                            updateRequested = true;
                            completeUpdate();
                            resolve(call, "started");
                        } else if (info.getUpdateAvailability() == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS) {
                            updateRequested = true;
                            resolve(call, "started");
                        } else if (info.getUpdateAvailability() == UpdateAvailability.UPDATE_AVAILABLE) {
                            updateRequested = true;
                            updateManager.startUpdateFlow(info, flexibleOptions())
                                .addOnSuccessListener(result -> {
                                    if (result == Activity.RESULT_CANCELED) updateRequested = false;
                                    resolve(call, result == Activity.RESULT_CANCELED ? "cancelled" : "started");
                                })
                                .addOnFailureListener(error -> {
                                    updateRequested = false;
                                    call.reject("RuStore update unavailable", "UPDATE_UNAVAILABLE");
                                });
                        } else {
                            call.reject("RuStore update unavailable", "UPDATE_UNAVAILABLE");
                        }
                    } catch (RuntimeException | LinkageError error) {
                        call.reject("RuStore update unavailable", "UPDATE_UNAVAILABLE");
                    }
                }).addOnFailureListener(error -> call.reject("RuStore update unavailable", "UPDATE_UNAVAILABLE"));
            } catch (RuntimeException | LinkageError error) {
                call.reject("RuStore update unavailable", "UPDATE_UNAVAILABLE");
            }
        });
    }

    @PluginMethod
    public void openStore(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                getActivity().startActivity(new Intent(Intent.ACTION_VIEW,
                    Uri.parse("https://www.rustore.ru/catalog/app/ru.tvoygoroskop.app")));
                call.resolve();
            } catch (RuntimeException error) {
                call.reject("Cannot open RuStore", "STORE_UNAVAILABLE");
            }
        });
    }

    private void completeUpdate() {
        if (!completionRequested.compareAndSet(false, true)) return;
        try {
            updateManager.completeUpdate(flexibleOptions()).addOnFailureListener(error -> completionRequested.set(false));
        } catch (RuntimeException | LinkageError error) {
            completionRequested.set(false);
        }
    }

    private static void resolve(PluginCall call, String status) {
        JSObject result = new JSObject();
        result.put("status", status);
        call.resolve(result);
    }

    private static AppUpdateOptions flexibleOptions() {
        return new AppUpdateOptions.Builder().appUpdateType(AppUpdateType.FLEXIBLE).build();
    }

    @Override
    protected void handleOnDestroy() {
        updateRequested = false;
        if (updateManager != null && listenerRegistered) {
            try { updateManager.unregisterListener(installListener); }
            catch (RuntimeException | LinkageError ignored) { /* Activity cleanup is best effort. */ }
        }
        listenerRegistered = false;
        super.handleOnDestroy();
    }
}
