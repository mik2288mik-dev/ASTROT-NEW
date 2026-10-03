import fs from 'fs';
import {
  DISABLED_ANDROID_UPDATE_POLICY, createAndroidUpdateGate, getAndroidUpdatePolicy, parseAndroidUpdatePolicy, requiresAndroidUpdate,
} from '../lib/androidUpdatePolicy';
import handler from '../pages/api/app/update-policy';
import type { NextApiRequest, NextApiResponse } from 'next';

const oldEnv = { code: process.env.ANDROID_MIN_VERSION_CODE, name: process.env.ANDROID_UPDATE_VERSION_NAME };
afterEach(() => {
  if (oldEnv.code === undefined) delete process.env.ANDROID_MIN_VERSION_CODE;
  else process.env.ANDROID_MIN_VERSION_CODE = oldEnv.code;
  if (oldEnv.name === undefined) delete process.env.ANDROID_UPDATE_VERSION_NAME;
  else process.env.ANDROID_UPDATE_VERSION_NAME = oldEnv.name;
});
it('keeps existing 1.0.4/vc7 and 1.0.5/vc8 usable by default', () => {
  delete process.env.ANDROID_MIN_VERSION_CODE;
  expect(getAndroidUpdatePolicy()).toEqual(DISABLED_ANDROID_UPDATE_POLICY);
  for (const code of [7, 8]) expect(requiresAndroidUpdate(getAndroidUpdatePolicy(), code)).toBe(false);
});
it.each(['-1', 'NaN', '8.5', '2147483648'])('disables invalid server minimum %s', (code) => {
  process.env.ANDROID_MIN_VERSION_CODE = code;
  expect(getAndroidUpdatePolicy()).toEqual(DISABLED_ANDROID_UPDATE_POLICY);
});
it('compares Android build numbers, allowing the minimum itself and newer builds', () => {
  process.env.ANDROID_MIN_VERSION_CODE = '9';
  process.env.ANDROID_UPDATE_VERSION_NAME = '1.0.6';
  const policy = getAndroidUpdatePolicy();
  expect(policy).toEqual({ minVersionCode: 9, versionName: '1.0.6' });
  for (const code of [7, 8]) expect(requiresAndroidUpdate(policy, code)).toBe(true);
  for (const code of [9, 10, undefined, 0, '8']) expect(requiresAndroidUpdate(policy, code)).toBe(false);
});
it('rejects malformed remote policy and ignores unsafe display copy', () => {
  expect(parseAndroidUpdatePolicy({ minVersionCode: '9' })).toBeNull();
  expect(parseAndroidUpdatePolicy({ minVersionCode: 9, versionName: '<script>' })).toEqual({ minVersionCode: 9, versionName: null });
});
it('serves the policy without authentication and without HTTP caching', () => {
  const res = { setHeader: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn() };
  handler({ method: 'GET' } as NextApiRequest, res as unknown as NextApiResponse);
  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  handler({ method: 'POST' } as NextApiRequest, res as unknown as NextApiResponse);
  expect(res.status).toHaveBeenLastCalledWith(405);
});
it('keeps only home after Cancel and reopens the prompt on every other section', () => {
  const gate = createAndroidUpdateGate();
  gate.applyPolicy({ minVersionCode: 9, versionName: '1.0.6' }, 8);
  expect(gate.getState()).toMatchObject({ required: true, promptOpen: true });
  gate.dismiss();
  expect(gate.getState()).toMatchObject({ required: true, promptOpen: false });
  expect(gate.allowNavigation('dashboard')).toBe(true);
  expect(gate.getState().promptOpen).toBe(false);
  for (const section of ['chart', 'personality', 'horoscope', 'synastry', 'services', 'encyclopedia', 'matrix', 'settings', 'admin', 'charts', 'menu', 'paywall']) {
    expect(gate.allowNavigation(section)).toBe(false);
    expect(gate.getState().promptOpen).toBe(true);
    gate.dismiss();
  }
  gate.applyPolicy({ minVersionCode: 9, versionName: '1.0.6' }, 8);
  expect(gate.getState().promptOpen).toBe(false);
  gate.applyPolicy(DISABLED_ANDROID_UPDATE_POLICY, 8);
  expect(gate.allowNavigation('chart')).toBe(true);
  expect(gate.getState()).toMatchObject({ required: false, promptOpen: false });
  gate.applyPolicy({ minVersionCode: 9, versionName: '1.0.6' }, 9);
  expect(gate.allowNavigation('horoscope')).toBe(true);
});
it('guards all screen setters and overlays, including direct deep-link navigation', () => {
  const app = fs.readFileSync('App.tsx', 'utf8');
  expect(app).toContain('if (androidUpdate.allowNavigation(nextView)) setViewState(nextView)');
  expect(app).toContain("if (!sheet || androidUpdate.allowNavigation('menu'))");
  expect(app).toContain("if (nextContext && !androidUpdate.allowNavigation('paywall')) return");
  expect(app).toContain("if (view !== 'onboarding') setViewState('dashboard')");
  expect(app).toContain('navigationHistoryRef.current = []');
  const native = fs.readFileSync('android/app/src/rustore/java/ru/tvoygoroskop/app/rustore/RuStoreUpdateBridge.java', 'utf8');
  expect(native).toContain('@CapacitorPlugin(name = "RuStoreUpdate")');
  expect(native).toContain('AppUpdateType.FLEXIBLE');
  expect(native).not.toContain('AppUpdateType.SILENT');
  const activity = fs.readFileSync('android/app/src/main/java/ru/tvoygoroskop/app/MainActivity.java', 'utf8');
  expect(activity.indexOf('if (isRuStoreBuild()) registerRuStoreUpdatePlugin()')).toBeLessThan(activity.indexOf('super.onCreate(savedInstanceState)'));
  expect(activity).not.toContain('startRuStoreUpdateCheck');
});
