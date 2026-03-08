/**
 * Notification sound utility using Web Audio API.
 * Generates synthesized chime sounds without external audio files.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

function playTone(frequency: number, startTime: number, duration: number, gain: number, ctx: AudioContext) {
  const osc = ctx.createOscillator();
  const vol = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(frequency, startTime);
  vol.gain.setValueAtTime(gain, startTime);
  vol.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.connect(vol);
  vol.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

/** Ascending 2-note chime for incoming chat messages */
export function playChatNotification() {
  const ctx = getAudioContext();
  if (!ctx) return;
  // Resume context if suspended (autoplay policy)
  if (ctx.state === "suspended") ctx.resume();
  const now = ctx.currentTime;
  playTone(523.25, now, 0.15, 0.12, ctx);        // C5
  playTone(659.25, now + 0.12, 0.2, 0.10, ctx);  // E5
}

/** Short single ping for chat request */
export function playChatRequestSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume();
  const now = ctx.currentTime;
  playTone(440, now, 0.1, 0.1, ctx);              // A4
  playTone(554.37, now + 0.1, 0.12, 0.08, ctx);   // C#5
  playTone(659.25, now + 0.2, 0.18, 0.07, ctx);   // E5
}

