const LOGO_SRC = "/icons/easypay-logo.png";
const LOGO_RATIO = 0.22; // logo takes ~22% of QR width

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Draw the EasyPay logo in the center of an existing QR canvas.
 * Call this AFTER QRCode.toCanvas().
 */
export async function drawLogoOnCanvas(
  canvas: HTMLCanvasElement,
  logoSrc: string = LOGO_SRC
): Promise<void> {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const logo = await loadImage(logoSrc);
  const size = Math.round(canvas.width * LOGO_RATIO);
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  // Clear zone: circle behind logo
  const clearRadius = size * 0.62;

  // White circle with soft shadow
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.10)";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, clearRadius, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.restore();

  // Subtle border
  ctx.beginPath();
  ctx.arc(cx, cy, clearRadius, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(0,0,0,0.05)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Clip logo to circle for clean edges
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.52, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  // Draw logo centered, maintaining aspect ratio
  const logoAspect = logo.naturalWidth / logo.naturalHeight;
  let drawW = size;
  let drawH = size;
  if (logoAspect > 1) {
    drawH = size / logoAspect;
  } else {
    drawW = size * logoAspect;
  }
  const drawX = cx - drawW / 2;
  const drawY = cy - drawH / 2;
  ctx.drawImage(logo, drawX, drawY, drawW, drawH);
  ctx.restore();
}

/**
 * Generate a QR data URL with the EasyPay logo overlaid in the center.
 * Use instead of QRCode.toDataURL().
 */
export async function qrToDataUrlWithLogo(
  data: string,
  options: Record<string, any> = {},
  logoSrc: string = LOGO_SRC
): Promise<string> {
  const QRCode = (await import("qrcode")).default;
  const canvas = document.createElement("canvas");

  await QRCode.toCanvas(canvas, data, {
    ...options,
    errorCorrectionLevel: "H",
  });

  await drawLogoOnCanvas(canvas, logoSrc);
  return canvas.toDataURL("image/png");
}
