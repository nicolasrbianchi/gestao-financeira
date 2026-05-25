export function haptic(ms = 10) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(ms);
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

