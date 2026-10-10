import { APP_TRACE_VERSION, sanitizeTraceEvent, TRACE_SCREENS, type AppTraceEvent, type TraceType } from '../lib/appTelemetry';

type Transport = (body: unknown, keepalive: boolean, signal: AbortSignal) => Promise<Response>;
const STORAGE = 'nebo_app_trace_visit_v1';
let send: Transport | null = null;
let screen = 'startup';
let queue: AppTraceEvent[] = [];
let token: string | null = null;
let sequence = 0;
let generation = 0;
let inFlight = false;
let controller: AbortController | null = null;
let account: string | null = null;
let lastAt = 0;
let foreground = true;
export function setTraceForeground(active:boolean) { foreground=active; }
export function isTraceForeground() { return foreground && (typeof document==='undefined' || !document.hidden); }

function persist() {
  try { window.sessionStorage.setItem(STORAGE, JSON.stringify({ token, sequence, queue, account, lastAt })); } catch { /* memory queue remains usable */ }
}
export function traceScreen(next: string) { screen = next; } // Admin routes deliberately disable app collection.
export function currentTraceScreen() { return screen; }
export function hasTraceIdentity() { return account!=null; }
export function traceGeneration() { return generation; }
export function captureAppTrace(type: TraceType, payload: AppTraceEvent['payload'] = {}, explicitScreen = screen) {
  if (!send || !TRACE_SCREENS.includes(explicitScreen)) return;
  const e = sanitizeTraceEvent({ id: crypto.randomUUID(), sequence: sequence++, at: Date.now(), type, screen: explicitScreen, payload });
  if (!e) return;
  lastAt = Date.now(); queue.push(e); queue = queue.slice(-1000); persist();
}
export function bindTraceAccount(next: string | number | null | undefined) {
  const value = next == null ? null : String(next);
  const previous = account;
  if (account && value !== account) {
    // A prior account's queued events must never be delivered with a new account's credentials.
    generation++; controller?.abort(); inFlight = false; token = null; queue = []; sequence = 0;
    account = value; captureAppTrace('visit_started');
  } else account = value;
  if (value && value !== previous) captureAppTrace('identity_ready');
  persist(); void flushAppTrace();
  return Boolean(previous && value !== previous);
}
export function startAppTrace(transport: Transport) {
  send = transport;
  token = null; account = null; sequence = 0; queue = []; lastAt = 0;
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(STORAGE) || 'null');
    if (saved && Date.now() - saved.lastAt < 30 * 60_000) {
      token = typeof saved.token === 'string' ? saved.token : null;
      account = typeof saved.account === 'string' ? saved.account : null;
      sequence = Number.isSafeInteger(saved.sequence) ? saved.sequence : 0;
      queue = Array.isArray(saved.queue) ? saved.queue.map((e: unknown) => sanitizeTraceEvent(e)).filter(Boolean).slice(-1000) : [];
      lastAt = saved.lastAt;
    }
  } catch { /* unavailable storage starts a fresh visit */ }
  if (!token && !queue.length) captureAppTrace('visit_started');
}
export async function flushAppTrace(keepalive = false) {
  if (!send || inFlight || (!queue.length && token)) return;
  const expected = generation;
  const batch = queue.slice(0, keepalive ? 20 : 100);
  const currentController = new AbortController(); controller = currentController; inFlight = true;
  try {
    const response = await send({ version: APP_TRACE_VERSION, token, events: batch }, keepalive, currentController.signal);
    if (expected !== generation) return;
    if (response.status === 409 || response.status === 410) {
      // Expired or differently bound visit. Old queued observations cannot be reassigned.
      token = null; queue = []; sequence = 0; captureAppTrace('visit_started'); return;
    }
    if (!response.ok) return;
    const data = await response.json();
    if (expected !== generation) return;
    token = typeof data.token === 'string' ? data.token : token;
    const delivered = new Set(batch.map(e => e.id)); queue = queue.filter(e => !delivered.has(e.id)); persist();
  } catch { /* retry unchanged event IDs on the next flush or online event */ }
  finally { if (expected === generation) { inFlight = false; controller = null; } }
}
export function stopAppTrace() { generation++; controller?.abort(); send = null; inFlight = false; persist(); }
