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
  const x = (canvas.width - size) / 2;
  const y = (canvas.height - size) / 2;

  // Draw clear zone behind logo
  const pad = size * 0.075;
  const bgSize = size + pad * 2;
  const bx = x - pad;
  const by = y - pad;
  const r = 6;
  ctx.beginPath();
  ctx.moveTo(bx + r, by);
  ctx.lineTo(bx + bgSize - r, by);
  ctx.quadraticCurveTo(bx + bgSize, by, bx + bgSize, by + r);
  ctx.lineTo(bx + bgSize, by + bgSize - r);
  ctx.quadraticCurveTo(bx + bgSize, by + bgSize, bx + bgSize - r, by + bgSize);
  ctx.lineTo(bx + r, by + bgSize);
  ctx.quadraticCurveTo(bx, by + bgSize, bx, by + bgSize - r);
  ctx.lineTo(bx, by + r);
  ctx.quadraticCurveTo(bx, by, bx + r, by);
  ctx.closePath();
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  // Draw logo on top
  ctx.drawImage(logo, x, y, size, size);
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
