type ImpactStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';

let lastHapticAt = 0;

function canPulse(minIntervalMs: number) {
  const now = Date.now();
  if (now - lastHapticAt < minIntervalMs) return false;
  lastHapticAt = now;
  return true;
}

function getTelegramHaptics() {
  try {
    return (window as any)?.Telegram?.WebApp?.HapticFeedback;
  } catch {
    return null;
  }
}

function fallbackVibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    /* Native haptics are optional */
  }
}

export function lumiaSelectionHaptic(minIntervalMs = 70) {
  if (!canPulse(minIntervalMs)) return;

  try {
    const haptics = getTelegramHaptics();
    if (haptics?.selectionChanged) {
      haptics.selectionChanged();
    } else {
      fallbackVibrate(6);
    }
  } catch {
    fallbackVibrate(6);
  }
}

export function lumiaImpactHaptic(style: ImpactStyle = 'light', minIntervalMs = 90) {
  if (!canPulse(minIntervalMs)) return;

  try {
    const haptics = getTelegramHaptics();
    if (haptics?.impactOccurred) {
      if (style === 'soft') {
        try {
          haptics.impactOccurred('soft');
        } catch {
          haptics.impactOccurred('light');
        }
      } else {
        haptics.impactOccurred(style);
      }
    } else {
      fallbackVibrate(style === 'medium' ? [8, 18, 8] : 8);
    }
  } catch {
    fallbackVibrate(style === 'medium' ? [8, 18, 8] : 8);
  }
}
