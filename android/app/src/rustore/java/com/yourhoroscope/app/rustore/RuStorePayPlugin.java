package com.yourhoroscope.app.rustore;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.List;

import ru.rustore.sdk.core.util.RuStoreUtils;
import ru.rustore.sdk.pay.RuStorePayClient;
import ru.rustore.sdk.pay.model.AppUserId;
import ru.rustore.sdk.pay.model.PreferredPurchaseType;
import ru.rustore.sdk.pay.model.ProductId;
import ru.rustore.sdk.pay.model.ProductPurchaseParams;
import ru.rustore.sdk.pay.model.PurchaseAvailabilityResult;
import ru.rustore.sdk.pay.model.SdkTheme;

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

    @PluginMethod
    public void getAvailability(PluginCall call) {
        if (!RuStoreUtils.INSTANCE.isRuStoreInstalled(getContext())) {
            JSObject result = new JSObject();
            result.put("available", false);
            result.put("reason", "RUSTORE_NOT_INSTALLED");
            call.resolve(result);
            return;
        }
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
                JSObject payload = new JSObject();
                payload.put("productId", productId);
                payload.put("productType", result.getProductType().name());
                if (result.getPurchaseId() != null) payload.put("purchaseId", result.getPurchaseId().getValue());
                if (result.getInvoiceId() != null) payload.put("invoiceId", result.getInvoiceId().getValue());
                if (!orderId.isEmpty()) payload.put("orderId", orderId);
                call.resolve(payload);
            })
            .addOnFailureListener(error -> {
                String code = error.getClass().getSimpleName().contains("Cancelled")
                    ? "RUSTORE_PURCHASE_CANCELLED"
                    : "RUSTORE_PURCHASE_FAILED";
                call.reject(code, asException(error));
            });
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
                        value.put("productId", ((ru.rustore.sdk.pay.model.SubscriptionPurchase) purchase).getProductId().getValue());
                    } else if (purchase instanceof ru.rustore.sdk.pay.model.ProductPurchase) {
                        value.put("productId", ((ru.rustore.sdk.pay.model.ProductPurchase) purchase).getProductId().getValue());
                    }
                    if (purchase.getPurchaseId() != null) value.put("purchaseId", purchase.getPurchaseId().getValue());
                    if (purchase.getInvoiceId() != null) value.put("invoiceId", purchase.getInvoiceId().getValue());
                    values.put(value);
                }
                call.resolve(new JSObject().put("purchases", values));
            })
            .addOnFailureListener(error -> call.reject("RUSTORE_PURCHASES_FAILED", asException(error)));
    }
}
