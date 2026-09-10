package ru.tvoygoroskop.app.rustore;

import android.content.Context;

import java.util.concurrent.atomic.AtomicBoolean;

import ru.rustore.sdk.appupdate.listener.InstallStateUpdateListener;
import ru.rustore.sdk.appupdate.manager.RuStoreAppUpdateManager;
import ru.rustore.sdk.appupdate.manager.factory.RuStoreAppUpdateManagerFactory;
import ru.rustore.sdk.appupdate.model.AppUpdateOptions;
import ru.rustore.sdk.appupdate.model.AppUpdateType;
import ru.rustore.sdk.appupdate.model.InstallStatus;
import ru.rustore.sdk.appupdate.model.UpdateAvailability;

/** Best-effort silent RuStore update check. Update failures must never block app startup. */
public final class RuStoreUpdateBridge {
    private final RuStoreAppUpdateManager updateManager;
    private final AtomicBoolean started = new AtomicBoolean(false);
    private final AtomicBoolean stopped = new AtomicBoolean(false);
    private final AtomicBoolean listenerRegistered = new AtomicBoolean(false);
    private final AtomicBoolean completionRequested = new AtomicBoolean(false);

    private final InstallStateUpdateListener installStateUpdateListener = installState -> {
        if (stopped.get()) return;
        if (installState.getInstallStatus() == InstallStatus.DOWNLOADED) {
            completeSilentUpdate();
        }
    };

    public RuStoreUpdateBridge(Context context) {
        updateManager = RuStoreAppUpdateManagerFactory.INSTANCE.create(context);
    }

    public void start() {
        if (stopped.get() || !started.compareAndSet(false, true)) return;
        registerListener();

        try {
            updateManager
                .getAppUpdateInfo()
                .addOnSuccessListener(appUpdateInfo -> {
                    if (stopped.get()) return;
                    try {
                        if (appUpdateInfo.getInstallStatus() == InstallStatus.DOWNLOADED) {
                            completeSilentUpdate();
                            return;
                        }
                        if (appUpdateInfo.getUpdateAvailability() == UpdateAvailability.UPDATE_AVAILABLE) {
                            updateManager
                                .startUpdateFlow(appUpdateInfo, silentOptions())
                                .addOnFailureListener(ignored -> {
                                    // Update is optional; keep the app running normally.
                                });
                        }
                    } catch (RuntimeException | LinkageError ignored) {
                        // Update is optional; keep the app running normally.
                    }
                })
                .addOnFailureListener(ignored -> {
                    // No RuStore/no network/not authorized: app startup continues normally.
                });
        } catch (RuntimeException | LinkageError ignored) {
            // Update is optional; keep the app running normally.
        }
    }

    public void stop() {
        stopped.set(true);
        if (!listenerRegistered.compareAndSet(true, false)) return;
        try {
            updateManager.unregisterListener(installStateUpdateListener);
        } catch (RuntimeException | LinkageError ignored) {
            // Cleanup is best-effort.
        }
    }

    private void registerListener() {
        if (!listenerRegistered.compareAndSet(false, true)) return;
        try {
            updateManager.registerListener(installStateUpdateListener);
        } catch (RuntimeException | LinkageError ignored) {
            listenerRegistered.set(false);
        }
    }

    private void completeSilentUpdate() {
        if (stopped.get() || !completionRequested.compareAndSet(false, true)) return;
        try {
            updateManager
                .completeUpdate(silentOptions())
                .addOnFailureListener(ignored -> completionRequested.set(false));
        } catch (RuntimeException | LinkageError ignored) {
            completionRequested.set(false);
        }
    }

    private static AppUpdateOptions silentOptions() {
        return new AppUpdateOptions.Builder()
            .appUpdateType(AppUpdateType.SILENT)
            .build();
    }
}
