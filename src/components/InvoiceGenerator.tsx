import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface InvoiceOrder {
  order_num: string;
  created_at: string;
  shipping_name?: string | null;
  shipping_phone?: string | null;
  shipping_address?: string | null;
  shipping_city?: string | null;
  payment_method?: string | null;
  total: number;
  coupon_discount?: number | null;
  delivery_fee?: number | null;
  items: Array<{
    name?: string;
    product_name?: string;
    qty?: number;
    quantity?: number;
    price?: number;
    vendor_name?: string;
  }>;
}

function fmt(n: number) {
  return n.toLocaleString("en-BD");
}

async function loadLogoBase64(): Promise<string | null> {
  try {
    const res = await fetch("/icons/easypay-logo.png");
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// Brand colors
const BRAND = { r: 14, g: 165, b: 100 }; // #0EA564
const GRAY_BG = { r: 248, g: 249, b: 250 }; // #F8F9FA
const DARK = { r: 30, g: 30, b: 30 };
const MID = { r: 120, g: 120, b: 120 };
const LIGHT = { r: 180, g: 180, b: 180 };

async function buildDoc(order: InvoiceOrder): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const ml = 15;
  const mr = pw - 15;

  const logo = await loadLogoBase64();

  // ── Emerald accent strip (top) ──
  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
  doc.rect(0, 0, pw, 5, "F");

  // ── Logo + Company Info (left) ──
  let logoBottom = 22;
  if (logo) {
    try { doc.addImage(logo, "PNG", ml, 10, 12, 12); logoBottom = 24; } catch { /* skip */ }
  }
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  doc.text("EasyPay", ml, logoBottom + 4);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(MID.r, MID.g, MID.b);
  doc.text("Digital Financial Services", ml + doc.getTextWidth("EasyPay "), logoBottom + 4);
  doc.text("Dhaka, Bangladesh", ml, logoBottom + 8);

  // ── Document Title + Meta (right) ──
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  doc.text("INVOICE", mr, 16, { align: "right" });

  const invNum = `INV-${order.order_num?.replace("#", "") || "000"}`;
  const invDate = new Date(order.created_at).toLocaleDateString("en-BD", {
    day: "numeric", month: "short", year: "numeric",
  });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(DARK.r, DARK.g, DARK.b);
  doc.text(`Invoice No: ${invNum}`, mr, 22, { align: "right" });
  doc.text(`Date: ${invDate}`, mr, 27, { align: "right" });

  // ── Green separator ──
  let y = 36;
  doc.setDrawColor(BRAND.r, BRAND.g, BRAND.b);
  doc.setLineWidth(0.6);
  doc.line(ml, y, mr, y);
  y += 6;

  // ── Bill To Block (gray background) ──
  const billBoxH = 28;
  doc.setFillColor(GRAY_BG.r, GRAY_BG.g, GRAY_BG.b);
  doc.roundedRect(ml, y, mr - ml, billBoxH, 2, 2, "F");

  doc.setFontSize(7);
  doc.setTextColor(MID.r, MID.g, MID.b);
  doc.text("BILL TO", ml + 5, y + 5);

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(DARK.r, DARK.g, DARK.b);
  doc.text(order.shipping_name || "Customer", ml + 5, y + 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  let by = y + 16;
  if (order.shipping_phone) { doc.text(order.shipping_phone, ml + 5, by); by += 4.5; }
  if (order.shipping_address) { doc.text(order.shipping_address, ml + 5, by); by += 4.5; }
  if (order.shipping_city) { doc.text(order.shipping_city, ml + 5, by); }

  // Payment method on right side of bill box
  doc.setFontSize(8);
  doc.setTextColor(MID.r, MID.g, MID.b);
  doc.text("PAYMENT METHOD", mr - 5, y + 5, { align: "right" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(DARK.r, DARK.g, DARK.b);
  doc.text(order.payment_method === "wallet" ? "EasyPay Wallet" : order.payment_method === "cod" ? "Cash on Delivery" : "Card", mr - 5, y + 11, { align: "right" });

  y += billBoxH + 8;

  // ── Items Table ──
  const items = Array.isArray(order.items) ? order.items : [];
  const tableBody = items.map((item) => {
    const qty = item.qty || item.quantity || 1;
    const price = Number(item.price) || 0;
    return [
      { content: item.name || item.product_name || "Item", styles: { fontStyle: "bold" as const } },
      String(qty),
      `Tk ${fmt(price)}`,
      `Tk ${fmt(price * qty)}`,
    ];
  });

  autoTable(doc, {
    startY: y,
    margin: { left: ml, right: 15 },
    head: [["Product", "Qty", "Unit Price", "Total"]],
    body: tableBody,
    theme: "grid",
    headStyles: {
      fillColor: [BRAND.r, BRAND.g, BRAND.b],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 9,
      cellPadding: 3,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [DARK.r, DARK.g, DARK.b],
      cellPadding: 3,
      lineColor: [230, 230, 230],
      lineWidth: 0.3,
    },
    alternateRowStyles: {
      fillColor: [GRAY_BG.r, GRAY_BG.g, GRAY_BG.b],
    },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { halign: "center", cellWidth: 18 },
      2: { halign: "right", cellWidth: 30 },
      3: { halign: "right", cellWidth: 30 },
    },
  });

  // ── Summary Section ──
  const finalY = (doc as any).lastAutoTable?.finalY ?? y + 40;
  let sy = finalY + 10;
  const summaryW = 75;
  const summaryX = mr - summaryW;

  const subtotal = items.reduce((s, i) => s + (Number(i.price) || 0) * (i.qty || i.quantity || 1), 0);
  const coupon = Number(order.coupon_discount) || 0;
  const delivery = Number(order.delivery_fee) || 0;

  // Summary box with border
  const summaryLines = 3 + (coupon > 0 ? 1 : 0);
  const summaryBoxH = summaryLines * 7 + 16;
  doc.setDrawColor(230, 230, 230);
  doc.setLineWidth(0.3);
  doc.roundedRect(summaryX, sy - 4, summaryW, summaryBoxH, 1.5, 1.5, "S");

  const lx = summaryX + 5;
  const vx = mr - 5;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(MID.r, MID.g, MID.b);
  doc.text("Subtotal", lx, sy + 2);
  doc.setTextColor(DARK.r, DARK.g, DARK.b);
  doc.text(`Tk ${fmt(subtotal)}`, vx, sy + 2, { align: "right" });
  sy += 7;

  if (coupon > 0) {
    doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
    doc.text("Coupon Discount", lx, sy + 2);
    doc.text(`-Tk ${fmt(coupon)}`, vx, sy + 2, { align: "right" });
    sy += 7;
  }

  doc.setTextColor(MID.r, MID.g, MID.b);
  doc.text("Delivery Fee", lx, sy + 2);
  doc.setTextColor(DARK.r, DARK.g, DARK.b);
  doc.text(delivery > 0 ? `Tk ${fmt(delivery)}` : "Free", vx, sy + 2, { align: "right" });
  sy += 5;

  // Divider inside summary box
  doc.setDrawColor(BRAND.r, BRAND.g, BRAND.b);
  doc.setLineWidth(0.4);
  doc.line(lx, sy + 2, vx, sy + 2);
  sy += 7;

  // Grand total
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  doc.text("TOTAL", lx, sy + 2);
  doc.text(`Tk ${fmt(Number(order.total))}`, vx, sy + 2, { align: "right" });

  // ── Footer ──
  const footerY = ph - 20;
  doc.setDrawColor(230, 230, 230);
  doc.setLineWidth(0.3);
  doc.line(ml, footerY, mr, footerY);

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(LIGHT.r, LIGHT.g, LIGHT.b);
  doc.text("This is a computer-generated document and does not require a signature.", pw / 2, footerY + 5, { align: "center" });
  doc.text("EasyPay Digital Financial Services · Dhaka, Bangladesh", pw / 2, footerY + 9, { align: "center" });
  doc.text(`Generated: ${new Date().toLocaleString("en-BD")}`, pw / 2, footerY + 13, { align: "center" });

  return doc;
}

export async function downloadInvoice(order: InvoiceOrder) {
  const doc = await buildDoc(order);
  doc.save(`Invoice-${order.order_num?.replace("#", "") || "order"}.pdf`);
}

export async function printInvoice(order: InvoiceOrder) {
  const doc = await buildDoc(order);
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement("iframe");
  iframe.style.display = "none";
  iframe.src = url;
  document.body.appendChild(iframe);
  iframe.onload = () => {
    iframe.contentWindow?.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
      URL.revokeObjectURL(url);
    }, 1000);
  };
}
