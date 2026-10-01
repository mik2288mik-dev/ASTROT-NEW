export type AndroidUpdatePolicy = {
  minVersionCode: number;
  versionName: string | null;
};

export const DISABLED_ANDROID_UPDATE_POLICY: AndroidUpdatePolicy = { minVersionCode: 0, versionName: null };

export function parseAndroidUpdatePolicy(value: unknown): AndroidUpdatePolicy | null {
  if (!value || typeof value !== 'object') return null;
  const policy = value as Record<string, unknown>;
  if (!Number.isSafeInteger(policy.minVersionCode) || Number(policy.minVersionCode) < 0
    || Number(policy.minVersionCode) > 2147483647) return null;
  const versionName = typeof policy.versionName === 'string' && /^\d+(?:\.\d+){1,3}$/.test(policy.versionName)
    ? policy.versionName : null;
  return { minVersionCode: Number(policy.minVersionCode), versionName };
}

export function getAndroidUpdatePolicy(): AndroidUpdatePolicy {
  return parseAndroidUpdatePolicy({
    minVersionCode: Number(process.env.ANDROID_MIN_VERSION_CODE || 0),
    versionName: process.env.ANDROID_UPDATE_VERSION_NAME,
  }) || DISABLED_ANDROID_UPDATE_POLICY;
}

export function requiresAndroidUpdate(policy: AndroidUpdatePolicy, installedVersionCode: unknown): boolean {
  return Number.isSafeInteger(installedVersionCode) && Number(installedVersionCode) > 0
    && policy.minVersionCode > Number(installedVersionCode);
}

export function createAndroidUpdateGate() {
  let state: { policy: AndroidUpdatePolicy | null; required: boolean; promptOpen: boolean } = {
    policy: null, required: false, promptOpen: false,
  };
  return {
    getState: () => state,
    applyPolicy(policy: AndroidUpdatePolicy, installedVersionCode: unknown) {
      const required = requiresAndroidUpdate(policy, installedVersionCode);
      state = {
        policy: required ? policy : null,
        required,
        promptOpen: required && (!state.required || state.promptOpen),
      };
    },
    allowNavigation(destination: string) {
      if (!state.required || destination === 'dashboard' || destination === 'onboarding') return true;
      state = { ...state, promptOpen: true };
      return false;
    },
    dismiss() { state = { ...state, promptOpen: false }; },
  };
}
