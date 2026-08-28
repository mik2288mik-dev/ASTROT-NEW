import { registerPlugin } from '@capacitor/core';
import { isNativeAppRuntime } from '../services/nativeRuntime';

type DiagnosticLevel = 'INFO' | 'WARN' | 'ERROR';
type NativeDiagnosticsResult = {
  text?: string;
  sdk?: number;
  manufacturer?: string;
  model?: string;
};
type NativeDiagnosticsPlugin = {
  getLogs(): Promise<NativeDiagnosticsResult>;
  mark(options: { event: string }): Promise<void>;
  clearLogs(): Promise<void>;
};

const NativeDiagnostics = registerPlugin<NativeDiagnosticsPlugin>('NativeDiagnostics');
const STORAGE_KEY = 'nebo.runtime.diagnostics.v1';
const MAX_ENTRIES = 200;
const MAX_DETAIL_CHARS = 1200;
const STARTUP_STALL_MS = 10_000;

let installed = false;
let overlay: HTMLDivElement | null = null;
let originalFetch: typeof window.fetch | null = null;
let originalConsoleError: typeof console.error | null = null;
let originalConsoleWarn: typeof console.warn | null = null;

type Entry = {
  ts: string;
  level: DiagnosticLevel;
  event: string;
  detail?: string;
};

function isNative(): boolean {
  return typeof window !== 'undefined' && isNativeAppRuntime();
}

function redact(value: unknown): string {
  let text: string;
  try {
    text = typeof value === 'string' ? value : JSON.stringify(value);
  } catch {
    text = String(value);
  }
  return text
    .replace(/(authorization|token|secret|password|code|initData|access_token|refresh_token)=([^&\s]+)/gi, '$1=[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi, 'Bearer [REDACTED]')
    .slice(0, MAX_DETAIL_CHARS);
}

function readEntries(): Entry[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.slice(-MAX_ENTRIES) : [];
  } catch {
    return [];
  }
}

function persist(entry: Entry): void {
  if (typeof window === 'undefined') return;
  try {
    const entries = [...readEntries(), entry].slice(-MAX_ENTRIES);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Diagnostics must never become a startup dependency.
  }
}

export function diagnosticLog(level: DiagnosticLevel, event: string, detail?: unknown): void {
  const entry: Entry = {
    ts: new Date().toISOString(),
    level,
    event,
    ...(detail === undefined ? {} : { detail: redact(detail) }),
  };
  persist(entry);
  if (isNative()) {
    void NativeDiagnostics.mark({ event: `${level} ${event}${entry.detail ? ` ${entry.detail}` : ''}` })
      .catch(() => undefined);
  }
}

function errorDetail(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}\n${error.stack || ''}`;
  return redact(error);
}

async function collectText(): Promise<string> {
  const js = readEntries()
    .map((entry) => `${entry.ts} [${entry.level}] ${entry.event}${entry.detail ? ` ${entry.detail}` : ''}`)
    .join('\n');

  let native = '';
  let device = '';
  if (isNative()) {
    try {
      const result = await NativeDiagnostics.getLogs();
      native = result.text || '';
      device = `Android SDK ${result.sdk ?? '?'}; ${result.manufacturer || '?'} ${result.model || '?'}`;
    } catch (error) {
      native = `NativeDiagnostics unavailable: ${errorDetail(error)}`;
    }
  }

  return [
    '=== NEBO DIAGNOSTICS ===',
    `time=${new Date().toISOString()}`,
    `url=${typeof window !== 'undefined' ? window.location.href.replace(/([?&](?:token|code|initData)=[^&]+)/gi, '$1=[REDACTED]') : ''}`,
    `device=${device}`,
    `userAgent=${typeof navigator !== 'undefined' ? navigator.userAgent : ''}`,
    '',
    '--- NATIVE ---',
    native || '(no native entries)',
    '',
    '--- WEB / JS ---',
    js || '(no js entries)',
  ].join('\n');
}

function copyFallback(text: string): void {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

async function copyDiagnostics(): Promise<void> {
  const text = await collectText();
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    copyFallback(text);
  }
}

async function renderOverlay(reason: string): Promise<void> {
  if (typeof document === 'undefined' || overlay) return;
  const text = await collectText();
  overlay = document.createElement('div');
  overlay.id = 'nebo-runtime-diagnostics';
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '2147483647',
    background: '#fff',
    color: '#191622',
    padding: '16px',
    overflow: 'auto',
    fontFamily: 'monospace',
    fontSize: '11px',
    lineHeight: '1.4',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  });

  const controls = document.createElement('div');
  controls.style.cssText = 'position:sticky;top:0;background:#fff;padding:0 0 12px 0;display:flex;gap:8px;align-items:center;z-index:2';
  const title = document.createElement('strong');
  title.textContent = `NEBO diagnostics: ${reason}`;
  title.style.flex = '1';
  const copy = document.createElement('button');
  copy.textContent = 'КОПИРОВАТЬ ЛОГ';
  copy.onclick = () => void copyDiagnostics();
  const close = document.createElement('button');
  close.textContent = 'ЗАКРЫТЬ';
  close.onclick = () => {
    overlay?.remove();
    overlay = null;
  };
  controls.append(title, copy, close);

  const pre = document.createElement('div');
  pre.textContent = text;
  overlay.append(controls, pre);
  document.body.appendChild(overlay);
}

function installFetchTracing(): void {
  if (typeof window === 'undefined' || originalFetch) return;
  originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const started = Date.now();
    const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const rawUrl = input instanceof Request ? input.url : String(input);
    const safeUrl = rawUrl.replace(/([?&](?:token|code|initData|access_token|refresh_token)=)[^&]+/gi, '$1[REDACTED]');
    diagnosticLog('INFO', 'fetch_start', `${method} ${safeUrl}`);
    try {
      const response = await originalFetch!(input, init);
      diagnosticLog(response.ok ? 'INFO' : 'WARN', 'fetch_end', `${method} ${safeUrl} status=${response.status} ms=${Date.now() - started}`);
      return response;
    } catch (error) {
      diagnosticLog('ERROR', 'fetch_failed', `${method} ${safeUrl} ms=${Date.now() - started} ${errorDetail(error)}`);
      throw error;
    }
  };
}

function installConsoleTracing(): void {
  if (originalConsoleError || originalConsoleWarn) return;
  originalConsoleError = console.error.bind(console);
  originalConsoleWarn = console.warn.bind(console);
  console.error = (...args: unknown[]) => {
    diagnosticLog('ERROR', 'console_error', args.map(redact).join(' '));
    originalConsoleError!(...args);
  };
  console.warn = (...args: unknown[]) => {
    diagnosticLog('WARN', 'console_warn', args.map(redact).join(' '));
    originalConsoleWarn!(...args);
  };
}

function installStartupStallDetector(): void {
  window.setTimeout(() => {
    if (!isNative()) return;
    const loading = document.querySelector('[role="status"]');
    if (!loading) return;
    diagnosticLog('ERROR', 'startup_stall', `loading screen still visible after ${STARTUP_STALL_MS}ms`);
    void renderOverlay('startup stalled');
  }, STARTUP_STALL_MS);
}

export function installRuntimeDiagnostics(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  diagnosticLog('INFO', 'runtime_diagnostics_install', `native=${isNative()}`);

  window.addEventListener('error', (event) => {
    diagnosticLog('ERROR', 'window_error', `${event.message} ${event.filename || ''}:${event.lineno || 0}:${event.colno || 0} ${errorDetail(event.error)}`);
    if (isNative()) void renderOverlay('JavaScript error');
  });

  window.addEventListener('unhandledrejection', (event) => {
    diagnosticLog('ERROR', 'unhandled_rejection', errorDetail(event.reason));
    if (isNative()) void renderOverlay('unhandled promise rejection');
  });

  document.addEventListener('DOMContentLoaded', () => diagnosticLog('INFO', 'dom_content_loaded'));
  window.addEventListener('load', () => diagnosticLog('INFO', 'window_load'));
  document.addEventListener('visibilitychange', () => diagnosticLog('INFO', 'visibility_change', document.visibilityState));

  installConsoleTracing();
  installFetchTracing();
  installStartupStallDetector();

  (window as typeof window & { __NEBO_DIAGNOSTICS__?: unknown }).__NEBO_DIAGNOSTICS__ = {
    show: () => renderOverlay('manual'),
    copy: copyDiagnostics,
    clear: async () => {
      try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
      if (isNative()) await NativeDiagnostics.clearLogs().catch(() => undefined);
    },
    text: collectText,
    log: diagnosticLog,
  };
}
