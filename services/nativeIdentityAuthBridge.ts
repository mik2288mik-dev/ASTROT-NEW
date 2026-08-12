import { registerPlugin } from '@capacitor/core';

export type NativeIdentityProvider = 'vk' | 'yandex' | 'google';

export type NativeProviderLaunch = {
  challengeId: string;
  provider: NativeIdentityProvider;
  clientId: string;
  nonce?: string;
  state?: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  redirectUri?: string;
};

export type NativeProviderCredential = {
  idToken?: string;
  accessToken?: string;
  code?: string;
  deviceId?: string;
  state?: string;
};

interface NativeIdentityAuthBridge {
  signIn(options: NativeProviderLaunch): Promise<NativeProviderCredential>;
  clearCredentialState(options?: { provider?: NativeIdentityProvider }): Promise<void>;
  getSessionToken(): Promise<{ token?: string | null }>;
  setSessionToken(options: { token: string }): Promise<void>;
  clearSessionToken(): Promise<void>;
}

export const nativeIdentityAuth = registerPlugin<NativeIdentityAuthBridge>('NativeIdentityAuth');
