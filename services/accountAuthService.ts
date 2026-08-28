import {
  nativeIdentityAuth,
  type NativeIdentityProvider as Provider,
  type NativeProviderLaunch,
} from './nativeIdentityAuthBridge';
import { apiFetch, persistNativeSessionResponse } from './apiClient';
import { isNativeAndroidRuntime, isNativeAppRuntime } from './nativeRuntime';
import {
  getRawTelegramInitData,
  setAuthSessionMode,
} from './authSessionIntent';
import type { UserProfile } from '../types';
import {
  canUseAccountAuthProvider,
  resolveDistributionChannel,
} from '../lib/distributionChannel';
import {
  createDiagnosticTraceId,
  diagnosticErrorCode,
  diagnosticHttpStatus,
  diagnosticTraceHeaders,
  formatDiagnosticFields,
  type DiagnosticEventName,
  type DiagnosticFields,
} from '../lib/diagnosticTrace';
import {
  diagnosticLog,
  showRuntimeDiagnosticsForFailure,
} from '../lib/runtimeDiagnostics';

export type LinkableProvider = 'vk' | 'yandex' | 'google' | 'email' | 'telegram';
export type AccountAuthCapabilities = {
  vk: boolean;
  yandex: boolean;
  google: boolean;
  email: boolean;
  emailPassword: boolean;
  emailDelivery: boolean;
};
export type LinkedIdentity = {
  provider: LinkableProvider;
  email?: string | null;
  displayName?: string | null;
  verifiedAt?: string;
  lastUsedAt?: string | null;
};

type AuthPurpose = 'login' | 'link';

type AccountSessionPayload = {
  profile?: UserProfile;
  sessionVersion?: number;
  token?: string;
  accessToken?: string;
  refreshToken?: string;
  accessExpiresAt?: number;
  refreshExpiresAt?: number;
  absoluteExpiresAt?: number;
};

type NativeProviderStart = {
  challengeId: string;
  provider: Provider;
  expiresInSeconds?: number;
  config: {
    webClientId?: string;
    clientId?: string;
    nonce?: string;
    state?: string;
    codeChallenge?: string;
    codeChallengeMethod?: string;
    redirectUri?: string;
  };
};

let providerRequest: Promise<UserProfile> | null = null;
const AUTH_CAPABILITIES_TIMEOUT_MS = 8_000;
const NATIVE_PROVIDER_START_TIMEOUT_MS = 10_000;
const NATIVE_PROVIDER_COMPLETE_TIMEOUT_MS = 20_000;

type AuthRequestDiagnostic = {
  event: Extract<DiagnosticEventName, 'auth_provider' | 'auth_email'>;
  traceId: string;
  stage: string;
  provider?: Provider;
  operation?: string;
};

function logAuthDiagnostic(
  level: 'INFO' | 'WARN' | 'ERROR',
  event: DiagnosticEventName,
  fields: DiagnosticFields,
): void {
  diagnosticLog(level, event, formatDiagnosticFields({ side: 'client', ...fields }));
}

function usesNativeAndroidProviderAuth(): boolean {
  return isNativeAndroidRuntime();
}

function isGoogleAvailableInCurrentChannel(): boolean {
  try {
    return canUseAccountAuthProvider('google', resolveDistributionChannel());
  } catch {
    // Yandex and VK are compiled into the Android build and do not need the
    // channel to render. Google remains hidden until a valid channel exists.
    return false;
  }
}

function canUseProviderInCurrentChannel(provider: Provider): boolean {
  return provider !== 'google' || isGoogleAvailableInCurrentChannel();
}

/**
 * Android Yandex/VK SDKs and their client IDs are compiled into the APK. Their
 * availability is therefore local build configuration, not a network
 * discovery problem. The server still validates both the challenge and the
 * resulting provider credential when the user taps a button.
 */
export function getLocalAccountAuthCapabilities(): AccountAuthCapabilities | null {
  if (!usesNativeAndroidProviderAuth()) return null;
  return {
    vk: true,
    yandex: true,
    google: isGoogleAvailableInCurrentChannel(),
    email: false,
    emailPassword: false,
    emailDelivery: false,
  };
}

async function authError(response: Response, fallback: string): Promise<Error> {
  const payload = await response.json().catch(() => ({})) as {
    code?: string;
    error?: string;
    message?: string;
  };
  const error = new Error(payload.message || payload.code || payload.error || fallback);
  (error as Error & { code?: string; status?: number }).code =
    payload.code || payload.error || fallback;
  (error as Error & { code?: string; status?: number }).status = response.status;
  return error;
}

async function acceptAccountSession(
  payload: AccountSessionPayload,
  fallback: string,
  diagnostic?: AuthRequestDiagnostic,
): Promise<UserProfile> {
  if (!payload.profile) throw new Error(fallback);
  if (isNativeAppRuntime()) {
    if (!(payload.token || payload.accessToken)) throw new Error('NATIVE_SESSION_TOKEN_MISSING');
    const startedAt = Date.now();
    logAuthDiagnostic('INFO', diagnostic?.event || 'auth_provider', {
      traceId: diagnostic?.traceId,
      stage: 'session_persist',
      status: 'start',
      provider: diagnostic?.provider,
      operation: diagnostic?.operation,
    });
    try {
      await persistNativeSessionResponse(payload);
      logAuthDiagnostic('INFO', diagnostic?.event || 'auth_provider', {
        traceId: diagnostic?.traceId,
        stage: 'session_persist',
        status: 'ok',
        durationMs: Date.now() - startedAt,
        provider: diagnostic?.provider,
        operation: diagnostic?.operation,
      });
    } catch (error) {
      logAuthDiagnostic('ERROR', diagnostic?.event || 'auth_provider', {
        traceId: diagnostic?.traceId,
        stage: 'session_persist',
        status: 'error',
        durationMs: Date.now() - startedAt,
        errorCode: diagnosticErrorCode(error, 'NATIVE_SESSION_PERSIST_FAILED'),
        provider: diagnostic?.provider,
        operation: diagnostic?.operation,
      });
      throw error;
    }
  }
  setAuthSessionMode('account');
  return payload.profile;
}

async function postAuthJson<T extends Record<string, unknown>>(
  path: string,
  body: Record<string, unknown>,
  fallback: string,
  timeoutMs?: number,
  diagnostic?: AuthRequestDiagnostic,
): Promise<T> {
  const startedAt = Date.now();
  if (diagnostic) {
    logAuthDiagnostic('INFO', diagnostic.event, {
      traceId: diagnostic.traceId,
      stage: diagnostic.stage,
      status: 'start',
      provider: diagnostic.provider,
      operation: diagnostic.operation,
    });
  }
  let response: Response;
  try {
    response = await apiFetch(path, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(diagnostic ? diagnosticTraceHeaders(diagnostic.traceId) : {}),
      },
      body: JSON.stringify(body),
    }, timeoutMs);
  } catch (error) {
    if (diagnostic) {
      logAuthDiagnostic('ERROR', diagnostic.event, {
        traceId: diagnostic.traceId,
        stage: diagnostic.stage,
        status: 'error',
        durationMs: Date.now() - startedAt,
        errorCode: diagnosticErrorCode(error, fallback),
        httpStatus: diagnosticHttpStatus(error),
        provider: diagnostic.provider,
        operation: diagnostic.operation,
      });
    }
    throw error;
  }
  if (!response.ok) {
    const error = await authError(response, fallback);
    if (diagnostic) {
      logAuthDiagnostic('ERROR', diagnostic.event, {
        traceId: diagnostic.traceId,
        stage: diagnostic.stage,
        status: 'error',
        durationMs: Date.now() - startedAt,
        httpStatus: response.status,
        errorCode: diagnosticErrorCode(error, fallback),
        provider: diagnostic.provider,
        operation: diagnostic.operation,
      });
    }
    throw error;
  }
  if (diagnostic) {
    logAuthDiagnostic('INFO', diagnostic.event, {
      traceId: diagnostic.traceId,
      stage: diagnostic.stage,
      status: 'ok',
      durationMs: Date.now() - startedAt,
      httpStatus: response.status,
      provider: diagnostic.provider,
      operation: diagnostic.operation,
    });
  }
  try {
    return await response.json() as T;
  } catch (error) {
    if (diagnostic) {
      logAuthDiagnostic('ERROR', diagnostic.event, {
        traceId: diagnostic.traceId,
        stage: 'response_parse',
        status: 'error',
        durationMs: Date.now() - startedAt,
        httpStatus: response.status,
        errorCode: 'AUTH_RESPONSE_INVALID',
        provider: diagnostic.provider,
        operation: diagnostic.operation,
      });
    }
    throw error;
  }
}

function providerLaunchOptions(start: NativeProviderStart, traceId: string): NativeProviderLaunch {
  const clientId = start.provider === 'google'
    ? start.config.webClientId
    : start.config.clientId;
  if (!clientId) throw new Error('AUTH_PROVIDER_NOT_CONFIGURED');
  return {
    provider: start.provider,
    clientId,
    traceId,
    nonce: start.config.nonce,
    state: start.config.state,
    codeChallenge: start.config.codeChallenge,
    codeChallengeMethod: start.config.codeChallengeMethod,
    redirectUri: start.config.redirectUri,
  };
}

export async function loginWithTelegram(): Promise<UserProfile> {
  const initData = getRawTelegramInitData();
  if (!initData) {
    const error = new Error('Открой приложение из чата с ботом Telegram и попробуй снова.');
    (error as Error & { code?: string }).code = 'TELEGRAM_CONTEXT_REQUIRED';
    throw error;
  }

  const response = await apiFetch('/api/auth/telegram/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData, native: isNativeAppRuntime(), sessionVersion: 2 }),
  });
  if (!response.ok) throw await authError(response, 'TELEGRAM_LOGIN_FAILED');

  const payload = await response.json() as AccountSessionPayload;
  if (!payload.profile) throw new Error('TELEGRAM_LOGIN_FAILED');
  if (payload.token || payload.accessToken) await persistNativeSessionResponse(payload);
  setAuthSessionMode('telegram');
  return payload.profile;
}

export async function linkCurrentTelegramIdentity(): Promise<UserProfile> {
  const initData = getRawTelegramInitData();
  if (!initData) {
    const error = new Error('Открой приложение из чата с ботом Telegram и попробуй снова.');
    (error as Error & { code?: string }).code = 'TELEGRAM_CONTEXT_REQUIRED';
    throw error;
  }
  const response = await apiFetch('/api/auth/telegram/link', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData, sessionVersion: 2 }),
  });
  if (!response.ok) throw await authError(response, 'TELEGRAM_LINK_FAILED');
  const payload = await response.json() as AccountSessionPayload;
  if (!payload.profile) throw new Error('TELEGRAM_LINK_FAILED');
  if (payload.token || payload.accessToken) await persistNativeSessionResponse(payload);
  setAuthSessionMode('telegram');
  return payload.profile;
}

export async function getLinkedIdentities(): Promise<{
  userId: string;
  isGuest: boolean;
  identities: LinkedIdentity[];
}> {
  const response = await apiFetch('/api/auth/identities');
  if (!response.ok) throw new Error('IDENTITIES_LOAD_FAILED');
  return response.json();
}

export async function getAccountAuthCapabilities(): Promise<AccountAuthCapabilities> {
  const traceId = createDiagnosticTraceId('auth-capabilities');
  const startedAt = Date.now();
  const localCapabilities = getLocalAccountAuthCapabilities();
  const runtime = usesNativeAndroidProviderAuth() ? 'native' : 'browser';
  let channel: ReturnType<typeof resolveDistributionChannel> | undefined;
  logAuthDiagnostic('INFO', 'auth_capabilities', {
    traceId,
    stage: 'capability_check',
    status: 'start',
    runtime,
  });
  try {
    channel = resolveDistributionChannel();
    const response = await apiFetch(
      `/api/auth/capabilities?runtime=${runtime}&channel=${channel}`,
      { headers: diagnosticTraceHeaders(traceId) },
      AUTH_CAPABILITIES_TIMEOUT_MS,
    );
    if (!response.ok) throw await authError(response, 'AUTH_CAPABILITIES_UNAVAILABLE');
    const payload = await response.json().catch(() => ({}));
    const emailDelivery = payload?.emailDelivery === true || payload?.email === true;
    const emailPassword = payload?.emailPassword === true;
    const capabilities = {
      // Native provider buttons describe SDKs compiled into this APK. They must
      // remain visible even when discovery is stale; provider/start is the
      // authoritative server-side readiness check after the user taps one.
      vk: localCapabilities ? localCapabilities.vk : payload?.vk === true,
      yandex: localCapabilities ? localCapabilities.yandex : payload?.yandex === true,
      google: canUseAccountAuthProvider('google', channel)
        && (localCapabilities ? localCapabilities.google && payload?.google === true : payload?.google === true),
      email: emailDelivery,
      emailPassword,
      emailDelivery,
    };
    logAuthDiagnostic('INFO', 'auth_capabilities', {
      traceId,
      stage: 'capability_check',
      status: 'ok',
      durationMs: Date.now() - startedAt,
      httpStatus: response.status,
      runtime,
      channel,
    });
    return capabilities;
  } catch (error) {
    logAuthDiagnostic('ERROR', 'auth_capabilities', {
      traceId,
      stage: 'capability_check',
      status: 'error',
      durationMs: Date.now() - startedAt,
      httpStatus: diagnosticHttpStatus(error),
      errorCode: diagnosticErrorCode(error, 'AUTH_CAPABILITIES_UNAVAILABLE'),
      runtime,
      channel,
    });
    throw error;
  }
}
export async function beginExternalAuth(
  provider: Provider,
  purpose: AuthPurpose,
): Promise<void> {
  const response = await apiFetch(`/api/auth/oauth/${provider}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ purpose, native: false }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.authorizationUrl) {
    throw new Error(payload.message || payload.error || 'OAUTH_START_FAILED');
  }
  if (purpose === 'login') setAuthSessionMode('account');
  if (isNativeAppRuntime()) window.open(payload.authorizationUrl, '_system', 'noopener,noreferrer');
  else window.location.assign(payload.authorizationUrl);
}

export async function authenticateWithProvider(
  provider: Provider,
  purpose: AuthPurpose = 'login',
): Promise<UserProfile | null> {
  if (!canUseProviderInCurrentChannel(provider)) {
    const error = new Error('AUTH_PROVIDER_NOT_AVAILABLE_IN_CHANNEL');
    (error as Error & { code?: string }).code = 'AUTH_PROVIDER_NOT_AVAILABLE_IN_CHANNEL';
    throw error;
  }
  if (!usesNativeAndroidProviderAuth()) {
    await beginExternalAuth(provider, purpose);
    return null;
  }
  if (providerRequest) return providerRequest;

  const traceId = createDiagnosticTraceId(`auth-${provider}`);
  const startedAt = Date.now();
  const diagnostic: AuthRequestDiagnostic = {
    event: 'auth_provider',
    traceId,
    stage: 'challenge_request',
    provider,
    operation: purpose,
  };
  logAuthDiagnostic('INFO', 'auth_provider', {
    traceId,
    stage: 'flow',
    status: 'start',
    provider,
    operation: purpose,
  });
  providerRequest = (async () => {
    const start = await postAuthJson<NativeProviderStart>(
      `/api/auth/provider/${provider}/start`,
      { purpose },
      'PROVIDER_AUTH_START_FAILED',
      NATIVE_PROVIDER_START_TIMEOUT_MS,
      diagnostic,
    );
    logAuthDiagnostic('INFO', 'auth_provider', {
      traceId,
      stage: 'challenge_received',
      status: 'ok',
      durationMs: Date.now() - startedAt,
      provider,
      operation: purpose,
    });
    logAuthDiagnostic('INFO', 'auth_provider', {
      traceId,
      stage: 'sdk_launch',
      status: 'start',
      provider,
      operation: purpose,
    });
    const credential = await nativeIdentityAuth.signIn(providerLaunchOptions(start, traceId));
    logAuthDiagnostic('INFO', 'auth_provider', {
      traceId,
      stage: 'credential_received',
      status: 'ok',
      durationMs: Date.now() - startedAt,
      provider,
      operation: purpose,
    });
    const payload = await postAuthJson<AccountSessionPayload>(
      `/api/auth/provider/${provider}/complete`,
      { challengeId: start.challengeId, ...credential, native: true, sessionVersion: 2 },
      'PROVIDER_AUTH_COMPLETE_FAILED',
      NATIVE_PROVIDER_COMPLETE_TIMEOUT_MS,
      { ...diagnostic, stage: 'server_complete' },
    );
    const profile = await acceptAccountSession(payload, 'PROVIDER_AUTH_COMPLETE_FAILED', diagnostic);
    logAuthDiagnostic('INFO', 'auth_provider', {
      traceId,
      stage: 'finished',
      status: 'ok',
      durationMs: Date.now() - startedAt,
      provider,
      operation: purpose,
    });
    return profile;
  })().catch((error) => {
    const code = diagnosticErrorCode(error, 'PROVIDER_AUTH_FAILED');
    logAuthDiagnostic(code === 'AUTH_CANCELLED' ? 'WARN' : 'ERROR', 'auth_provider', {
      traceId,
      stage: 'finished',
      status: code === 'AUTH_CANCELLED'
        ? 'cancelled'
        : (code === 'AUTH_TIMEOUT' ? 'timeout' : 'error'),
      durationMs: Date.now() - startedAt,
      httpStatus: diagnosticHttpStatus(error),
      errorCode: code,
      provider,
      operation: purpose,
    });
    showRuntimeDiagnosticsForFailure('provider authentication failed', error, {
      includeClientErrors: true,
    });
    throw error;
  }).finally(() => {
    providerRequest = null;
  });

  return providerRequest;
}

export async function clearNativeProviderCredentialState(): Promise<void> {
  if (!usesNativeAndroidProviderAuth()) return;
  await nativeIdentityAuth.clearCredentialState({}).catch(() => undefined);
}

export async function registerEmailPassword(input: {
  email: string;
  password: string;
  passwordConfirmation: string;
  purpose?: AuthPurpose;
}): Promise<{ challengeId: string }> {
  const traceId = createDiagnosticTraceId('auth-email-register');
  const startedAt = Date.now();
  const diagnostic: AuthRequestDiagnostic = {
    event: 'auth_email', traceId, stage: 'server_request', operation: 'register',
  };
  try {
    const result = await postAuthJson<{ challengeId: string }>(
      '/api/auth/password/register',
      {
        email: input.email,
        password: input.password,
        passwordConfirmation: input.passwordConfirmation,
        purpose: input.purpose || 'login',
      },
      'EMAIL_REGISTRATION_FAILED',
      undefined,
      diagnostic,
    );
    logAuthDiagnostic('INFO', 'auth_email', {
      traceId, stage: 'finished', status: 'ok', durationMs: Date.now() - startedAt, operation: 'register',
    });
    return result;
  } catch (error) {
    logAuthDiagnostic('ERROR', 'auth_email', {
      traceId,
      stage: 'finished',
      status: 'error',
      durationMs: Date.now() - startedAt,
      httpStatus: diagnosticHttpStatus(error),
      errorCode: diagnosticErrorCode(error, 'EMAIL_REGISTRATION_FAILED'),
      operation: 'register',
    });
    showRuntimeDiagnosticsForFailure('email registration failed', error);
    throw error;
  }
}

export async function verifyEmailPasswordRegistration(
  challengeId: string,
  code: string,
): Promise<UserProfile> {
  const traceId = createDiagnosticTraceId('auth-email-verify');
  const startedAt = Date.now();
  const diagnostic: AuthRequestDiagnostic = {
    event: 'auth_email', traceId, stage: 'server_request', operation: 'verify',
  };
  try {
    const payload = await postAuthJson<AccountSessionPayload>(
      '/api/auth/password/register-verify',
      { challengeId, code, native: isNativeAppRuntime(), sessionVersion: 2 },
      'EMAIL_VERIFICATION_FAILED',
      undefined,
      diagnostic,
    );
    const profile = await acceptAccountSession(payload, 'EMAIL_VERIFICATION_FAILED', diagnostic);
    logAuthDiagnostic('INFO', 'auth_email', {
      traceId, stage: 'finished', status: 'ok', durationMs: Date.now() - startedAt, operation: 'verify',
    });
    return profile;
  } catch (error) {
    logAuthDiagnostic('ERROR', 'auth_email', {
      traceId,
      stage: 'finished',
      status: 'error',
      durationMs: Date.now() - startedAt,
      httpStatus: diagnosticHttpStatus(error),
      errorCode: diagnosticErrorCode(error, 'EMAIL_VERIFICATION_FAILED'),
      operation: 'verify',
    });
    showRuntimeDiagnosticsForFailure('email verification failed', error);
    throw error;
  }
}

export async function loginWithEmailPassword(email: string, password: string): Promise<UserProfile> {
  const traceId = createDiagnosticTraceId('auth-email-login');
  const startedAt = Date.now();
  const diagnostic: AuthRequestDiagnostic = {
    event: 'auth_email', traceId, stage: 'server_request', operation: 'login',
  };
  try {
    const payload = await postAuthJson<AccountSessionPayload>(
      '/api/auth/password/login',
      { email, password, native: isNativeAppRuntime(), sessionVersion: 2 },
      'EMAIL_PASSWORD_LOGIN_FAILED',
      undefined,
      diagnostic,
    );
    const profile = await acceptAccountSession(payload, 'EMAIL_PASSWORD_LOGIN_FAILED', diagnostic);
    logAuthDiagnostic('INFO', 'auth_email', {
      traceId, stage: 'finished', status: 'ok', durationMs: Date.now() - startedAt, operation: 'login',
    });
    return profile;
  } catch (error) {
    logAuthDiagnostic('ERROR', 'auth_email', {
      traceId,
      stage: 'finished',
      status: 'error',
      durationMs: Date.now() - startedAt,
      httpStatus: diagnosticHttpStatus(error),
      errorCode: diagnosticErrorCode(error, 'EMAIL_PASSWORD_LOGIN_FAILED'),
      operation: 'login',
    });
    showRuntimeDiagnosticsForFailure('email authentication failed', error);
    throw error;
  }
}

export async function requestPasswordReset(email: string): Promise<{ challengeId: string }> {
  const traceId = createDiagnosticTraceId('auth-email-reset-request');
  const startedAt = Date.now();
  const diagnostic: AuthRequestDiagnostic = {
    event: 'auth_email', traceId, stage: 'server_request', operation: 'reset_request',
  };
  try {
    const result = await postAuthJson<{ challengeId: string }>(
      '/api/auth/password/reset-request',
      { email },
      'PASSWORD_RESET_REQUEST_FAILED',
      undefined,
      diagnostic,
    );
    logAuthDiagnostic('INFO', 'auth_email', {
      traceId, stage: 'finished', status: 'ok', durationMs: Date.now() - startedAt, operation: 'reset_request',
    });
    return result;
  } catch (error) {
    logAuthDiagnostic('ERROR', 'auth_email', {
      traceId,
      stage: 'finished',
      status: 'error',
      durationMs: Date.now() - startedAt,
      httpStatus: diagnosticHttpStatus(error),
      errorCode: diagnosticErrorCode(error, 'PASSWORD_RESET_REQUEST_FAILED'),
      operation: 'reset_request',
    });
    showRuntimeDiagnosticsForFailure('password reset request failed', error);
    throw error;
  }
}

export async function completePasswordReset(input: {
  challengeId: string;
  code: string;
  password: string;
  passwordConfirmation: string;
}): Promise<UserProfile> {
  const traceId = createDiagnosticTraceId('auth-email-reset-complete');
  const startedAt = Date.now();
  const diagnostic: AuthRequestDiagnostic = {
    event: 'auth_email', traceId, stage: 'server_request', operation: 'reset_complete',
  };
  try {
    const payload = await postAuthJson<AccountSessionPayload>(
      '/api/auth/password/reset-complete',
      { ...input, native: isNativeAppRuntime(), sessionVersion: 2 },
      'PASSWORD_RESET_FAILED',
      undefined,
      diagnostic,
    );
    const profile = await acceptAccountSession(payload, 'PASSWORD_RESET_FAILED', diagnostic);
    logAuthDiagnostic('INFO', 'auth_email', {
      traceId, stage: 'finished', status: 'ok', durationMs: Date.now() - startedAt, operation: 'reset_complete',
    });
    return profile;
  } catch (error) {
    logAuthDiagnostic('ERROR', 'auth_email', {
      traceId,
      stage: 'finished',
      status: 'error',
      durationMs: Date.now() - startedAt,
      httpStatus: diagnosticHttpStatus(error),
      errorCode: diagnosticErrorCode(error, 'PASSWORD_RESET_FAILED'),
      operation: 'reset_complete',
    });
    showRuntimeDiagnosticsForFailure('password reset failed', error);
    throw error;
  }
}
