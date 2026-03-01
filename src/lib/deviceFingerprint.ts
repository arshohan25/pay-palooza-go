/**
 * Client-side device fingerprinting for one-account-per-device enforcement.
 * Uses canvas rendering, screen properties, timezone, and platform info
 * to generate a deterministic hash without external libraries.
 */

const FP_KEY = "mfs_device_fp";

async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "no-canvas";

    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial'";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("EasyPay FP 🏦", 2, 15);
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.fillText("EasyPay FP 🏦", 4, 17);

    return canvas.toDataURL();
  } catch {
    return "canvas-error";
  }
}

function getDeviceProperties(): string {
  const props = [
    screen.width,
    screen.height,
    screen.colorDepth,
    window.devicePixelRatio,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.language,
    navigator.platform,
    navigator.hardwareConcurrency,
    navigator.maxTouchPoints,
  ];
  return props.join("|");
}

export async function getDeviceFingerprint(): Promise<string> {
  // Check cache first
  const cached = localStorage.getItem(FP_KEY);
  if (cached) return cached;

  const canvasFp = getCanvasFingerprint();
  const deviceProps = getDeviceProperties();
  const raw = `${canvasFp}::${deviceProps}`;
  const hash = await hashString(raw);

  localStorage.setItem(FP_KEY, hash);
  return hash;
}
