package ru.tvoygoroskop.app.rustore;

import android.content.Intent;
import android.net.Uri;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.List;

import ru.rustore.sdk.pay.RuStorePayClient;
import ru.rustore.sdk.pay.model.AppUserId;
import ru.rustore.sdk.pay.model.GracePeriod;
import ru.rustore.sdk.pay.model.HoldPeriod;
import ru.rustore.sdk.pay.model.MainPeriod;
import ru.rustore.sdk.pay.model.PreferredPurchaseType;
import ru.rustore.sdk.pay.model.ProductId;
import ru.rustore.sdk.pay.model.ProductPurchaseParams;
import ru.rustore.sdk.pay.model.ProductType;
import ru.rustore.sdk.pay.model.PromoPeriod;
import ru.rustore.sdk.pay.model.PurchaseAvailabilityResult;
import ru.rustore.sdk.pay.model.RuStorePaymentException;
import ru.rustore.sdk.pay.model.SdkTheme;
import ru.rustore.sdk.pay.model.SubscriptionPeriod;
import ru.rustore.sdk.pay.model.TrialPeriod;

/**
 * Capacitor boundary for the current RuStore Pay SDK. It intentionally returns
 * only product and transaction identifiers: entitlement is verified by our API.
 */
@CapacitorPlugin(name = "RuStorePay")
public class RuStorePayPlugin extends Plugin {
    private Exception asException(Throwable error) {
        return error instanceof Exception ? (Exception) error : new Exception(error);
    }

    private RuStorePayClient client() {
        return RuStorePayClient.Companion.getInstance();
    }

    private JSObject subscriptionPeriod(SubscriptionPeriod period) {
        JSObject value = new JSObject();
        if (period instanceof MainPeriod) {
            MainPeriod item = (MainPeriod) period;
            value.put("type", "MainPeriod");
            value.put("duration", item.getDuration());
            value.put("currency", item.getCurrency());
            value.put("price", item.getPrice());
        } else if (period instanceof TrialPeriod) {
            TrialPeriod item = (TrialPeriod) period;
            value.put("type", "TrialPeriod");
            value.put("duration", item.getDuration());
            value.put("currency", item.getCurrency());
            value.put("price", item.getPrice());
        } else if (period instanceof PromoPeriod) {
            PromoPeriod item = (PromoPeriod) period;
            value.put("type", "PromoPeriod");
            value.put("duration", item.getDuration());
            value.put("currency", item.getCurrency());
            value.put("price", item.getPrice());
        } else if (period instanceof GracePeriod) {
            value.put("type", "GracePeriod");
            value.put("duration", ((GracePeriod) period).getDuration());
        } else if (period instanceof HoldPeriod) {
            value.put("type", "HoldPeriod");
            value.put("duration", ((HoldPeriod) period).getDuration());
        }
        return value;
    }

    @PluginMethod
    public void getAvailability(PluginCall call) {
        client().getPurchaseInteractor().getPurchaseAvailability()
            .addOnSuccessListener(result -> {
                JSObject payload = new JSObject();
                payload.put("available", result instanceof PurchaseAvailabilityResult.Available);
                if (!(result instanceof PurchaseAvailabilityResult.Available)) payload.put("reason", "RUSTORE_PAY_UNAVAILABLE");
                call.resolve(payload);
            })
            .addOnFailureListener(error -> call.reject("RUSTORE_AVAILABILITY_FAILED", asException(error)));
    }

    @PluginMethod
    public void getProducts(PluginCall call) {
        JSArray requested = call.getArray("productIds", new JSArray());
        List<ProductId> productIds = new ArrayList<>();
        for (int i = 0; i < requested.length(); i++) {
            String value = requested.optString(i, "").trim();
            if (!value.isEmpty()) productIds.add(new ProductId(value));
        }
        if (productIds.isEmpty()) {
            call.resolve(new JSObject().put("products", new JSArray()));
            return;
        }
        client().getProductInteractor().getProducts(productIds)
            .addOnSuccessListener(products -> {
                JSArray values = new JSArray();
                for (Object item : products) {
                    ru.rustore.sdk.pay.model.Product product = (ru.rustore.sdk.pay.model.Product) item;
                    JSObject value = new JSObject();
                    value.put("productId", product.getProductId().getValue());
                    value.put("title", product.getTitle().getValue());
                    value.put("amountLabel", product.getAmountLabel().getValue());
                    value.put("type", product.getType().name());
                    if (product.getSubscriptionInfo() != null) {
                        JSArray periods = new JSArray();
                        for (SubscriptionPeriod period : product.getSubscriptionInfo().getPeriods()) {
                            periods.put(subscriptionPeriod(period));
                        }
                        value.put("subscriptionInfo", new JSObject().put("periods", periods));
                    }
                    values.put(value);
                }
                call.resolve(new JSObject().put("products", values));
            })
            .addOnFailureListener(error -> call.reject("RUSTORE_PRODUCTS_FAILED", asException(error)));
    }

    @PluginMethod
    public void purchase(PluginCall call) {
        String productId = call.getString("productId", "").trim();
        String appUserId = call.getString("appUserId", "").trim();
        String orderId = call.getString("orderId", "").trim();
        if (productId.isEmpty() || appUserId.isEmpty()) {
            call.reject("RUSTORE_PURCHASE_ARGUMENTS_REQUIRED");
            return;
        }
        List<ProductId> productIds = new ArrayList<>();
        productIds.add(new ProductId(productId));
        client().getProductInteractor().getProducts(productIds)
            .addOnSuccessListener(products -> {
                if (products.size() != 1) {
                    call.reject("RUSTORE_PRODUCT_NOT_SUBSCRIPTION");
                    return;
                }
                ru.rustore.sdk.pay.model.Product catalogProduct =
                    (ru.rustore.sdk.pay.model.Product) products.get(0);
                if (!catalogProduct.getProductId().getValue().equals(productId)
                    || catalogProduct.getType() != ProductType.SUBSCRIPTION) {
                    call.reject("RUSTORE_PRODUCT_NOT_SUBSCRIPTION");
                    return;
                }
                if (catalogProduct.getSubscriptionInfo() == null) {
                    call.reject("RUSTORE_SUBSCRIPTION_INFO_MISSING");
                    return;
                }
                boolean hasMainPeriod = false;
                for (SubscriptionPeriod period : catalogProduct.getSubscriptionInfo().getPeriods()) {
                    if (period instanceof TrialPeriod) {
                        call.reject("RUSTORE_TRIAL_NOT_SUPPORTED");
                        return;
                    }
                    if (period instanceof PromoPeriod) {
                        call.reject("RUSTORE_PROMO_NOT_SUPPORTED");
                        return;
                    }
                    if (period instanceof MainPeriod && !((MainPeriod) period).getDuration().isEmpty()) {
                        hasMainPeriod = true;
                    }
                }
                if (!hasMainPeriod) {
                    call.reject("RUSTORE_SUBSCRIPTION_INFO_MISSING");
                    return;
                }
                ProductPurchaseParams params = new ProductPurchaseParams(
                    new ProductId(productId),
                    null,
                    orderId.isEmpty() ? null : new ru.rustore.sdk.pay.model.OrderId(orderId),
                    null,
                    new AppUserId(appUserId),
                    null
                );
                client().getPurchaseInteractor()
                    .purchase(params, PreferredPurchaseType.ONE_STEP, SdkTheme.LIGHT, null)
                    .addOnSuccessListener(result -> {
                        if (result.getProductType() != ProductType.SUBSCRIPTION) {
                            call.reject("RUSTORE_PURCHASE_PRODUCT_TYPE_INVALID");
                            return;
                        }
                        JSObject payload = new JSObject();
                        payload.put("productId", productId);
                        payload.put("productType", result.getProductType().name());
                        if (result.getPurchaseId() != null) payload.put("purchaseId", result.getPurchaseId().getValue());
                        if (result.getInvoiceId() != null) payload.put("invoiceId", result.getInvoiceId().getValue());
                        if (!orderId.isEmpty()) payload.put("orderId", orderId);
                        call.resolve(payload);
                    })
                    .addOnFailureListener(error -> {
                        if (error instanceof RuStorePaymentException.ProductPurchaseCancelled) {
                            RuStorePaymentException.ProductPurchaseCancelled cancelled =
                                (RuStorePaymentException.ProductPurchaseCancelled) error;
                            if (cancelled.getPurchaseId() == null) {
                                JSObject payload = new JSObject();
                                payload.put("productId", productId);
                                payload.put("productType", ProductType.SUBSCRIPTION.name());
                                payload.put("status", "CANCELLED");
                                call.resolve(payload);
                                return;
                            }
                            client().getPurchaseInteractor().getPurchase(cancelled.getPurchaseId())
                                .addOnSuccessListener(current -> {
                                    JSObject payload = new JSObject();
                                    payload.put("productId", productId);
                                    payload.put("productType", ProductType.SUBSCRIPTION.name());
                                    payload.put("purchaseId", cancelled.getPurchaseId().getValue());
                                    payload.put("status", current.getStatus().toString());
                                    if (current.getInvoiceId() != null) {
                                        payload.put("invoiceId", current.getInvoiceId().getValue());
                                    }
                                    if (!orderId.isEmpty()) payload.put("orderId", orderId);
                                    call.resolve(payload);
                                })
                                .addOnFailureListener(lookupError ->
                                    call.reject("RUSTORE_PURCHASE_STATUS_UNKNOWN", asException(lookupError)));
                            return;
                        }
                        call.reject("RUSTORE_PURCHASE_FAILED", asException(error));
                    });
            })
            .addOnFailureListener(error -> call.reject("RUSTORE_PRODUCTS_FAILED", asException(error)));
    }

    @PluginMethod
    public void getPurchases(PluginCall call) {
        client().getPurchaseInteractor().getPurchases(null, null, null)
            .addOnSuccessListener(purchases -> {
                JSArray values = new JSArray();
                for (Object item : purchases) {
                    ru.rustore.sdk.pay.model.Purchase purchase = (ru.rustore.sdk.pay.model.Purchase) item;
                    JSObject value = new JSObject();
                    if (purchase instanceof ru.rustore.sdk.pay.model.SubscriptionPurchase) {
                        ru.rustore.sdk.pay.model.SubscriptionPurchase subscription =
                            (ru.rustore.sdk.pay.model.SubscriptionPurchase) purchase;
                        value.put("productId", subscription.getProductId().getValue());
                        value.put("productType", ProductType.SUBSCRIPTION.name());
                        value.put("status", subscription.getStatus().name());
                        value.put("gracePeriodEnabled", subscription.getGracePeriodEnabled());
                    } else if (purchase instanceof ru.rustore.sdk.pay.model.ProductPurchase) {
                        ru.rustore.sdk.pay.model.ProductPurchase productPurchase =
                            (ru.rustore.sdk.pay.model.ProductPurchase) purchase;
                        value.put("productId", productPurchase.getProductId().getValue());
                        value.put("productType", productPurchase.getProductType().name());
                    }
                    if (purchase.getPurchaseId() != null) value.put("purchaseId", purchase.getPurchaseId().getValue());
                    if (purchase.getInvoiceId() != null) value.put("invoiceId", purchase.getInvoiceId().getValue());
                    if (purchase.getOrderId() != null) value.put("orderId", purchase.getOrderId().getValue());
                    values.put(value);
                }
                call.resolve(new JSObject().put("purchases", values));
            })
            .addOnFailureListener(error -> call.reject("RUSTORE_PURCHASES_FAILED", asException(error)));
    }

    @PluginMethod
    public void openSubscriptionManagement(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("rustore://profile/subscriptions"));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
            call.resolve(new JSObject().put("opened", true));
        } catch (Exception error) {
            call.reject("RUSTORE_SUBSCRIPTIONS_UNAVAILABLE", error);
        }
    }
}
