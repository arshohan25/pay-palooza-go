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
  const size = canvas.width * LOGO_RATIO;
  const padding = size * 0.18;
  const totalSize = size + padding * 2;
  const x = (canvas.width - totalSize) / 2;
  const y = (canvas.height - totalSize) / 2;
  const radius = totalSize * 0.22;

  // White rounded-rect background
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + totalSize - radius, y);
  ctx.quadraticCurveTo(x + totalSize, y, x + totalSize, y + radius);
  ctx.lineTo(x + totalSize, y + totalSize - radius);
  ctx.quadraticCurveTo(x + totalSize, y + totalSize, x + totalSize - radius, y + totalSize);
  ctx.lineTo(x + radius, y + totalSize);
  ctx.quadraticCurveTo(x, y + totalSize, x, y + totalSize - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();

  // Draw logo
  ctx.drawImage(logo, x + padding, y + padding, size, size);
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
