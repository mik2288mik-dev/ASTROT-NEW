package ru.tvoygoroskop.app.auth;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import androidx.annotation.Nullable;

import java.security.GeneralSecurityException;
import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Stores one opaque app-session value (legacy bearer or a versioned token bundle);
 * key material never leaves AndroidKeyStore.
 * https://developer.android.com/privacy-and-security/keystore
 */
final class SecureSessionStore {
    private static final String ANDROID_KEY_STORE = "AndroidKeyStore";
    private static final String KEY_ALIAS = "tvoygoroskop.native_session.v1";
    private static final String CIPHER_TRANSFORMATION = "AES/GCM/NoPadding";
    private static final String PREFERENCES_NAME = "native_identity_auth_session";
    private static final String CIPHERTEXT_KEY = "ciphertext";
    private static final String IV_KEY = "iv";

    private final SharedPreferences preferences;

    SecureSessionStore(Context context) {
        preferences = context.getApplicationContext().getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE);
    }

    @Nullable
    synchronized String read() throws GeneralSecurityException {
        String encodedCiphertext = preferences.getString(CIPHERTEXT_KEY, null);
        String encodedIv = preferences.getString(IV_KEY, null);
        if (isBlank(encodedCiphertext) || isBlank(encodedIv)) {
            if (encodedCiphertext != null || encodedIv != null) clear();
            return null;
        }

        byte[] ciphertext = Base64.decode(encodedCiphertext, Base64.NO_WRAP);
        byte[] iv = Base64.decode(encodedIv, Base64.NO_WRAP);
        Cipher cipher = Cipher.getInstance(CIPHER_TRANSFORMATION);
        cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), new GCMParameterSpec(128, iv));
        return new String(cipher.doFinal(ciphertext), java.nio.charset.StandardCharsets.UTF_8);
    }

    synchronized void write(String token) throws GeneralSecurityException {
        Cipher cipher = Cipher.getInstance(CIPHER_TRANSFORMATION);
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey());
        byte[] ciphertext = cipher.doFinal(token.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        boolean stored = preferences.edit()
            .putString(CIPHERTEXT_KEY, Base64.encodeToString(ciphertext, Base64.NO_WRAP))
            .putString(IV_KEY, Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP))
            .commit();
        if (!stored) throw new GeneralSecurityException("Unable to persist the encrypted app session");
    }

    synchronized void clear() {
        preferences.edit().remove(CIPHERTEXT_KEY).remove(IV_KEY).commit();
    }

    private SecretKey getOrCreateKey() throws GeneralSecurityException {
        KeyStore keyStore = KeyStore.getInstance(ANDROID_KEY_STORE);
        try {
            keyStore.load(null);
        } catch (java.io.IOException error) {
            throw new GeneralSecurityException("Unable to open AndroidKeyStore", error);
        }
        java.security.Key existing = keyStore.getKey(KEY_ALIAS, null);
        if (existing instanceof SecretKey) return (SecretKey) existing;

        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEY_STORE);
        generator.init(
            new KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .setRandomizedEncryptionRequired(true)
                .build()
        );
        return generator.generateKey();
    }

    private boolean isBlank(@Nullable String value) {
        return value == null || value.trim().isEmpty();
    }
}
