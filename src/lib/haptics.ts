/**
 * Haptic feedback utility using navigator.vibrate
 * Gracefully no-ops on unsupported platforms (iOS Safari, desktop).
 */

const vibrate = (pattern: number | number[]) => {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
};

export const haptics = {
  /** Single short tick — PIN digit entry */
  light: () => vibrate(10),

  /** Medium pulse — step transition (next/back) */
  medium: () => vibrate(25),

  /** Double bump — success confirmation */
  success: () => vibrate([30, 60, 80]),

  /** Error shake */
  error: () => vibrate([20, 30, 20]),

  /** Gentle notification pulse — realtime updates */
  notify: () => vibrate([15, 40, 15]),
};
