import { defaultDesignPreference, sanitizeDesignPreference, type DesignPatch, type DesignPreference } from './contract';
export type DesignMutation = Omit<DesignPatch, 'expectedRevision'>;
export type DesignSnapshot = { ready: boolean; eligible: boolean; preference: DesignPreference; saving: boolean; error: string | null; forceClassic: boolean };
export type DesignResponse = { status: number; data?: { eligible?: boolean; preference?: unknown; code?: string } };
export type DesignTransport = (method: 'GET' | 'PATCH', body?: DesignPatch) => Promise<DesignResponse>;
export const EMPTY_DESIGN_SNAPSHOT: DesignSnapshot = { ready: false, eligible: false, preference: defaultDesignPreference(), saving: false, error: null, forceClassic: false };
/** Per-account external store. Writes are serialized; disposed accounts ignore all late replies. */
export class DesignPreferenceStore {
  private state: DesignSnapshot = { ...EMPTY_DESIGN_SNAPSHOT, preference: defaultDesignPreference() };
  private listeners = new Set<() => void>();
  private hydration: Promise<void> | null = null;
  private queue: Promise<void> = Promise.resolve();
  private disposed = false;
  private writes = 0;
  private generation = 0;
  private escapeGeneration = 0;
  constructor(private transport: DesignTransport, private persistEscape?: (value: boolean) => void, initialEscape = false) { this.state.forceClassic = initialEscape; }
  subscribe = (fn: () => void): (() => void) => { this.listeners.add(fn); return () => this.listeners.delete(fn); };
  getSnapshot = (): DesignSnapshot => this.state;
  getServerSnapshot = (): DesignSnapshot => EMPTY_DESIGN_SNAPSHOT;
  private publish(patch: Partial<DesignSnapshot>) {
    if (this.disposed) return;
    this.state = { ...this.state, ...patch }; this.listeners.forEach(fn => fn());
  }
  private accept(response: DesignResponse): boolean {
    if (response.status === 401 || response.status === 403 || response.data?.eligible === false) {
      this.publish({ ready: true, eligible: false, preference: defaultDesignPreference(), saving: false, error: null }); return false;
    }
    if (response.status !== 200 || response.data?.eligible !== true || !response.data.preference) throw new Error('DESIGN_SERVICE_UNAVAILABLE');
    this.publish({ ready: true, eligible: true, preference: sanitizeDesignPreference(response.data.preference), error: null }); return true;
  }
  hydrate = (): Promise<void> => {
    if (this.hydration) return this.hydration;
    const generation = this.generation;
    this.hydration = this.queue.then(async () => {
      const response = await this.transport('GET');
      if (this.disposed || generation !== this.generation) return;
      this.accept(response);
    }).catch(() => { this.publish({ ready: true, eligible: false, error: 'Не удалось проверить доступ к новому дизайну.' }); }).finally(() => { this.hydration = null; });
    return this.hydration;
  };
  update = (mutation: DesignMutation): Promise<boolean> => {
    if (!this.state.ready || !this.state.eligible || this.disposed) return Promise.resolve(false);
    this.writes += 1; this.publish({ saving: true, error: null });
    const generation = this.generation;
    const escapeGeneration = this.escapeGeneration;
    const work = this.queue.then(async () => {
      if (this.disposed || generation !== this.generation || !this.state.eligible) return false;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const response = await this.transport('PATCH', { ...mutation, expectedRevision: this.state.preference.revision });
        if (this.disposed || generation !== this.generation) return false;
        if (response.status === 409 && attempt === 0) {
          const fresh = await this.transport('GET');
          if (this.disposed || generation !== this.generation || !this.accept(fresh)) return false;
          continue;
        }
        if (!this.accept(response)) return false;
        if (mutation.design === 'nebo-v2' && escapeGeneration === this.escapeGeneration) { this.persistEscape?.(false); this.publish({ forceClassic: false }); }
        return true;
      }
      throw new Error('DESIGN_CONFLICT');
    }).catch(() => { this.publish({ error: 'Изменение не сохранено. Проверь соединение и повтори.' }); return false; }).finally(() => {
      this.writes = Math.max(0, this.writes - 1); this.publish({ saving: this.writes > 0 });
    });
    this.queue = work.then(() => {});
    return work;
  };
  escapeToClassic = () => {
    this.escapeGeneration += 1;
    this.persistEscape?.(true); this.publish({ forceClassic: true });
    if (this.state.eligible) void this.update({ design: 'classic' });
  };
  dispose() { this.disposed = true; this.generation += 1; this.listeners.clear(); }
}
