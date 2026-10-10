import { useEffect, useRef } from 'react';
import { JOURNEY_VERSION, JourneyClock } from '../lib/journeyTelemetry';
import { recordUserAppEvent } from './sessionService';
import { isTraceForeground } from './appTelemetryClient';

type Payload = Record<string, string | number | boolean>;
type Wait = { id: string; phase: 'chart' | 'reading' | 'video'; clock: JourneyClock };
export function useOnboardingTelemetry(step: string, accountKey: string | number | undefined) {
  const tracker = useRef<{ account: string; id: string; sequence: number; viewId: string;
    step: string; clock: JourneyClock; terminal: boolean; wait: Wait | null } | null>(null);
  const fields = useRef(new Map<string, boolean>());
  const video = useRef<string | null>(null);
  const alive=useRef(false);
  const current = () => alive.current && tracker.current?.account === String(accountKey) ? tracker.current : null;
  const emit = (eventType: string, extra: Payload = {}) => {
    const t = current();
    if (!t) return;
    void recordUserAppEvent({ eventType, section: 'onboarding', source: 'onboarding', eventPayload: {
      journey_version: JOURNEY_VERSION, attempt_id: t.id, view_id: t.viewId,
      step: t.step, sequence: t.sequence++, client_at_ms: Date.now(), ...t.clock.sample(), ...extra,
    }});
  };
  const progress = (state: string) => {
    const t = current();
    if (!t || t.terminal) return;
    emit('onboarding_step_progress', { state });
    if (t.wait) emit('onboarding_wait_progress', { wait_id: t.wait.id, phase: t.wait.phase, ...t.wait.clock.sample() });
  };
  useEffect(() => {
    alive.current=accountKey!=null;
    if (accountKey == null) return;
    const account = String(accountKey);
    let t = tracker.current;
    if (t?.account === account && t.terminal) return;
    if (!t || t.account !== account) {
      t = { account, id: crypto.randomUUID(), sequence: 0, viewId: crypto.randomUUID(), step,
        clock: new JourneyClock(Date.now(), Date.now), terminal: false, wait: null };
      tracker.current = t;
      fields.current.clear();
      t.clock.sample(isTraceForeground());
      emit('onboarding_started'); emit('onboarding_step_view');
      if (step === 'birth') emit('birth_data_started');
    } else if (t.step !== step) {
      emit('onboarding_step_exit', { state: 'transition', next_step: step });
      t.step = step; t.viewId = crypto.randomUUID(); t.clock = new JourneyClock(Date.now(), Date.now);
      t.clock.sample(isTraceForeground()); video.current = null;
      emit('onboarding_step_view');
      if (step === 'birth') emit('birth_data_started');
    }
  }, [step, accountKey]); // Events belong to the stable attempt, not each React render.
  useEffect(() => {
    if (accountKey == null) return;
    const visibility = () => {
      progress(!isTraceForeground() ? 'hidden' : 'visible');
      tracker.current?.clock.sample(isTraceForeground());
      tracker.current?.wait?.clock.sample(isTraceForeground());
    };
    const hide = () => progress('closed');
    const timer = window.setInterval(() => { if (isTraceForeground()) progress('visible'); }, 10_000);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('nebo-app-visibility', visibility);
    window.addEventListener('pagehide', hide);
    return () => {
      alive.current=false;
      window.clearInterval(timer); document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', hide);
      window.removeEventListener('nebo-app-visibility', visibility);
      // Do not enqueue a previous account's cleanup under newly replaced credentials.
    };
  }, [accountKey]);
  const finishWait = (outcome: string) => {
    const t = current();
    if (!t?.wait) return;
    emit('onboarding_wait_finished', { wait_id: t.wait.id, phase: t.wait.phase, outcome, ...t.wait.clock.sample() });
    t.wait = null;
  };
  return {
    event: emit,
    action: (action: string) => emit('onboarding_action', { action }),
    field: (field: string, filled: boolean) => {
      if (!current()) return;
      if (fields.current.get(field) === filled) return;
      fields.current.set(field, filled); emit('birth_field_interaction', { field, filled });
    },
    wait: (phase: Wait['phase']) => {
      const t = current();
      if (!t) return;
      finishWait('ready');
      t.wait = { id: crypto.randomUUID(), phase, clock: new JourneyClock(Date.now(), Date.now) };
      t.wait.clock.sample(isTraceForeground());
      emit('onboarding_wait_started', { wait_id: t.wait.id, phase, elapsed_ms: 0, visible_ms: 0 });
    },
    finishWait,
    finish: (outcome: string) => {
      const t = current();
      if (!t || t.terminal) return;
      finishWait(outcome === 'created' ? 'ready' : 'cancelled');
      emit('onboarding_step_exit', { state: 'transition' });
      emit('onboarding_completed', { outcome }); t.terminal = true;
    },
    video: (state: string) => {
      if (video.current === state) return;
      video.current = state; emit('onboarding_video', { video_state: state });
    },
  };
}
