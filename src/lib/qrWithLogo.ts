const LOGO_SRC = "/icons/easypay-logo.png";
const LOGO_RATIO = 0.24; // logo takes ~24% of QR width

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
 * Draw the EasyPay logo in the center of an existing QR canvas
 * with a professional circular clear zone, subtle border ring, and drop shadow.
 */
export async function drawLogoOnCanvas(
  canvas: HTMLCanvasElement,
  logoSrc: string = LOGO_SRC
): Promise<void> {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const logo = await loadImage(logoSrc);
  const logoSize = canvas.width * LOGO_RATIO;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  // Outer radius includes padding around the logo
  const outerRadius = (logoSize / 2) * 1.35;
  const innerRadius = (logoSize / 2) * 1.22;

  // 1. Clear zone — pure white circle to mask QR modules
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, outerRadius, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.restore();

  // 2. Subtle outer ring (light gray stroke)
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, outerRadius - 0.5, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(0,0,0,0.08)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  // 3. Inner white circle with very subtle inset shadow effect
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2);
  ctx.fillStyle = "#fafafa";
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.06)";
  ctx.lineWidth = 0.5;
  ctx.stroke();
  ctx.restore();

  // 4. Clip logo to a circle and draw
  const logoDrawSize = logoSize * 0.92;
  const lx = cx - logoDrawSize / 2;
  const ly = cy - logoDrawSize / 2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, logoDrawSize / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(logo, lx, ly, logoDrawSize, logoDrawSize);
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
