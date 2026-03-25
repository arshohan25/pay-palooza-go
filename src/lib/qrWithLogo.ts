// QR code generator with centered logo overlay
import QRCode from "qrcode";

const LOGO_PATH = "/icons/easypay-logo.webp";

let cachedLogo: HTMLImageElement | null = null;

function loadLogo(): Promise<HTMLImageElement> {
  if (cachedLogo) return Promise.resolve(cachedLogo);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { cachedLogo = img; resolve(img); };
    img.onerror = reject;
    img.src = LOGO_PATH;
  });
}

export async function renderQrWithLogo(
  canvas: HTMLCanvasElement,
  data: string,
  size: number = 200,
) {
  await QRCode.toCanvas(canvas, data, {
    width: size,
    margin: 2,
    errorCorrectionLevel: "H",
    color: { dark: "#000000", light: "#ffffff" },
  });

  try {
    const logo = await loadLogo();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const logoSize = size * 0.22;
    const x = (canvas.width - logoSize) / 2;
    const y = (canvas.height - logoSize) / 2;
    const r = logoSize * 0.18;

    // White rounded background
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + logoSize, y, x + logoSize, y + logoSize, r);
    ctx.arcTo(x + logoSize, y + logoSize, x, y + logoSize, r);
    ctx.arcTo(x, y + logoSize, x, y, r);
    ctx.arcTo(x, y, x + logoSize, y, r);
    ctx.closePath();
    ctx.fill();

    // Draw logo
    const pad = logoSize * 0.1;
    ctx.drawImage(logo, x + pad, y + pad, logoSize - pad * 2, logoSize - pad * 2);
  } catch {
    // Logo failed to load — QR still works fine
  }
}
