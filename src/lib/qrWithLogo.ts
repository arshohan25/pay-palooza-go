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

  // Premium clear zone behind logo
  const pad = size * 0.1;
  const bgSize = size + pad * 2;
  const bx = x - pad;
  const by = y - pad;
  const r = bgSize * 0.18;

  // Soft outer shadow
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.12)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 1;

  // Rounded rect path helper
  const roundRect = (rx: number, ry: number, rw: number, rh: number, rr: number) => {
    ctx.beginPath();
    ctx.moveTo(rx + rr, ry);
    ctx.lineTo(rx + rw - rr, ry);
    ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + rr);
    ctx.lineTo(rx + rw, ry + rh - rr);
    ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - rr, ry + rh);
    ctx.lineTo(rx + rr, ry + rh);
    ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - rr);
    ctx.lineTo(rx, ry + rr);
    ctx.quadraticCurveTo(rx, ry, rx + rr, ry);
    ctx.closePath();
  };

  // Fill white background with shadow
  roundRect(bx, by, bgSize, bgSize, r);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.restore();

  // Subtle border ring
  roundRect(bx, by, bgSize, bgSize, r);
  ctx.strokeStyle = "rgba(0,0,0,0.06)";
  ctx.lineWidth = 1;
  ctx.stroke();

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
