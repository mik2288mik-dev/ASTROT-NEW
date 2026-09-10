import fs from 'fs';
import path from 'path';
import {
  createDiagnosticTraceId,
  diagnosticErrorCode,
  formatDiagnosticFields,
  normalizeDiagnosticTraceId,
} from '../lib/diagnosticTrace';
import { redactRuntimeDiagnosticValue } from '../lib/runtimeDiagnostics';

describe('runtime diagnostics privacy and correlation', () => {
  it('redacts credentials, email, OTP and OAuth fields while preserving errorCode', () => {
    const detail = redactRuntimeDiagnosticValue({
      email: 'person@example.com',
      password: 'password-secret',
      code: '123456',
      accessToken: 'provider-access-token',
      refresh_token: 'provider-refresh-token',
      challengeId: 'challenge-secret',
      state: 'oauth-state-secret',
      nonce: 'oauth-nonce-secret',
      codeChallenge: 'pkce-secret',
      deviceId: 'provider-device-secret',
      errorCode: 'AUTH_FAILED',
    });

    for (const secret of [
      'person@example.com',
      'password-secret',
      '123456',
      'provider-access-token',
      'provider-refresh-token',
      'challenge-secret',
      'oauth-state-secret',
      'oauth-nonce-secret',
      'pkce-secret',
      'provider-device-secret',
    ]) expect(detail).not.toContain(secret);
    expect(detail).toContain('AUTH_FAILED');
  });

  it('redacts query credentials and authorization headers', () => {
    const detail = redactRuntimeDiagnosticValue(
      'https://example.test/callback?code=oauth-secret&state=state-secret '
      + 'Authorization=Bearer session-secret person@example.com',
    );
    expect(detail).not.toContain('oauth-secret');
    expect(detail).not.toContain('state-secret');
    expect(detail).not.toContain('session-secret');
    expect(detail).not.toContain('person@example.com');
  });

  it('fully redacts quoted and structured secrets containing spaces', () => {
    const detail = redactRuntimeDiagnosticValue({
      password: 'two words secret',
      token: { value: 'nested-provider-secret' },
      nested: { email: 'nested@example.com', errorCode: 'AUTH_NETWORK' },
    });
    const textDetail = redactRuntimeDiagnosticValue(
      '{"password":"two words secret","token":{"value":"nested-provider-secret"}}',
    );

    for (const secret of ['two words secret', 'nested-provider-secret', 'nested@example.com']) {
      expect(detail).not.toContain(secret);
      expect(textDetail).not.toContain(secret);
    }
    expect(detail).toContain('AUTH_NETWORK');
  });

  it('creates validated trace ids and formats only stable diagnostic fields', () => {
    const traceId = createDiagnosticTraceId('auth-provider');
    expect(normalizeDiagnosticTraceId(traceId)).toBe(traceId);
    expect(normalizeDiagnosticTraceId('bad trace id')).toBeNull();
    expect(formatDiagnosticFields({
      traceId,
      side: 'client',
      stage: 'server_complete',
      status: 'error',
      durationMs: 123.8,
      httpStatus: 502,
      errorCode: 'PROVIDER_AUTH_COMPLETE_FAILED',
      provider: 'yandex',
    })).toContain('durationMs=124');
    expect(diagnosticErrorCode({ code: 'AUTH_TIMEOUT' })).toBe('AUTH_TIMEOUT');
  });

  it('times only the dedicated startup loader while it stays visible', () => {
    const runtimeSource = fs.readFileSync(path.join(__dirname, '..', 'lib', 'runtimeDiagnostics.ts'), 'utf8');
    const loadingSource = fs.readFileSync(path.join(__dirname, '..', 'components', 'ui', 'Loading.tsx'), 'utf8');
    const detectorStart = runtimeSource.indexOf('function installStartupStallDetector');
    const detectorEnd = runtimeSource.indexOf('export function installRuntimeDiagnostics', detectorStart);
    const detector = runtimeSource.slice(detectorStart, detectorEnd);

    expect(loadingSource).toContain('data-nebo-startup-loading="true"');
    expect(detector).toContain('STARTUP_LOADING_SELECTOR');
    expect(detector).toContain('new MutationObserver(sync)');
    expect(detector).toContain("document.visibilityState === 'visible'");
    expect(detector).not.toContain("document.querySelector('[role=\"status\"]')");
    expect(detector).toContain("if (canAutoOpenRuntimeDiagnostics()) {");
  });

  it('never auto-opens raw diagnostics in store builds', () => {
    const runtimeSource = fs.readFileSync(path.join(__dirname, '..', 'lib', 'runtimeDiagnostics.ts'), 'utf8');

    expect(runtimeSource).toMatch(
      /function canAutoOpenRuntimeDiagnostics\(\)[\s\S]*NEXT_PUBLIC_DISTRIBUTION_CHANNEL === 'development'/,
    );
    expect(runtimeSource).toContain("if (canAutoOpenRuntimeDiagnostics()) void renderOverlay('JavaScript error')");
    expect(runtimeSource).toContain("if (canAutoOpenRuntimeDiagnostics()) void renderOverlay('unhandled promise rejection')");
    expect(runtimeSource).not.toMatch(/if \(isNative\(\)\) void renderOverlay/);
    expect(runtimeSource).toContain("show: () => renderOverlay('manual')");
  });
});
