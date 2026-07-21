import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

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

// ── Localization ──
// The invoice is fully localized (en/bn) by embedding Noto Sans Bengali on
// demand. The fonts are lazy-fetched from /public/fonts and cached in-module
// so the ~220 KB TTF payload only loads when a user actually generates an
// invoice while the UI is set to Bangla.
type Lang = "en" | "bn";
function getLang(): Lang {
  try {
    const v = localStorage.getItem("mfs_ui_lang");
    return v === "bn" ? "bn" : "en";
  } catch {
    return "en";
  }
}

const STRINGS = {
  en: {
    brand: "EasyPay",
    tagline: "Digital Financial Services",
    city: "Dhaka, Bangladesh",
    invoice: "INVOICE",
    invoiceNo: "Invoice No",
    date: "Date",
    billTo: "BILL TO",
    customer: "Customer",
    paymentMethod: "PAYMENT METHOD",
    pmWallet: "EasyPay Wallet",
    pmCod: "Cash on Delivery",
    pmCard: "Card",
    product: "Product",
    qty: "Qty",
    unitPrice: "Unit Price",
    total: "Total",
    item: "Item",
    subtotal: "Subtotal",
    coupon: "Coupon Discount",
    delivery: "Delivery Fee",
    free: "Free",
    grandTotal: "TOTAL",
    footer1: "This is a computer-generated document and does not require a signature.",
    footer2: "EasyPay Digital Financial Services · Dhaka, Bangladesh",
    generated: "Generated",
    currency: "Tk",
  },
  bn: {
    brand: "EasyPay",
    tagline: "ডিজিটাল ফাইনান্সিয়াল সার্ভিস",
    city: "ঢাকা, বাংলাদেশ",
    invoice: "চালান",
    invoiceNo: "চালান নং",
    date: "তারিখ",
    billTo: "প্রাপক",
    customer: "গ্রাহক",
    paymentMethod: "পেমেন্ট মাধ্যম",
    pmWallet: "EasyPay ওয়ালেট",
    pmCod: "ক্যাশ অন ডেলিভারি",
    pmCard: "কার্ড",
    product: "পণ্য",
    qty: "পরিমাণ",
    unitPrice: "একক দাম",
    total: "মোট",
    item: "পণ্য",
    subtotal: "সাব-টোটাল",
    coupon: "কুপন ছাড়",
    delivery: "ডেলিভারি চার্জ",
    free: "ফ্রি",
    grandTotal: "মোট",
    footer1: "এটি একটি কম্পিউটার-জেনারেটেড ডকুমেন্ট, স্বাক্ষরের প্রয়োজন নেই।",
    footer2: "EasyPay ডিজিটাল ফাইনান্সিয়াল সার্ভিস · ঢাকা, বাংলাদেশ",
    generated: "তৈরি হয়েছে",
    currency: "৳",
  },
} as const;

function fmt(n: number, lang: Lang) {
  // Bengali locale uses Bengali digits; English keeps Latin digits with BD grouping.
  return n.toLocaleString(lang === "bn" ? "bn-BD" : "en-BD");
}

// ── Bengali font (lazy loaded, cached in-module) ──
let bnFontCache: { regular: string; bold: string } | null = null;
let bnFontPromise: Promise<{ regular: string; bold: string } | null> | null = null;

async function fetchAsBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}`);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      // Strip "data:...;base64," prefix — jsPDF's addFileToVFS wants raw base64.
      resolve(dataUrl.split(",")[1] || "");
    };
    reader.readAsDataURL(blob);
  });
}

async function loadBengaliFonts(): Promise<{ regular: string; bold: string } | null> {
  if (bnFontCache) return bnFontCache;
  if (bnFontPromise) return bnFontPromise;
  bnFontPromise = (async () => {
    try {
      const [regular, bold] = await Promise.all([
        fetchAsBase64("/fonts/NotoSansBengali-Regular.ttf"),
        fetchAsBase64("/fonts/NotoSansBengali-Bold.ttf"),
      ]);
      bnFontCache = { regular, bold };
      return bnFontCache;
    } catch (e) {
      console.warn("[Invoice] Bengali font load failed, falling back to English", e);
      return null;
    }
  })();
  return bnFontPromise;
}

/**
 * Register Noto Sans Bengali into the given jsPDF doc and return the font
 * family name to use for setFont(). Returns "helvetica" if fonts couldn't be
 * loaded (falls back to English rendering).
 */
async function ensureFont(doc: jsPDF, lang: Lang): Promise<string> {
  if (lang !== "bn") return "helvetica";
  const fonts = await loadBengaliFonts();
  if (!fonts) return "helvetica";
  doc.addFileToVFS("NotoSansBengali-Regular.ttf", fonts.regular);
  doc.addFileToVFS("NotoSansBengali-Bold.ttf", fonts.bold);
  doc.addFont("NotoSansBengali-Regular.ttf", "NotoBengali", "normal");
  doc.addFont("NotoSansBengali-Bold.ttf", "NotoBengali", "bold");
  return "NotoBengali";
}

async function loadLogoBase64(): Promise<string | null> {
  try {
    const res = await fetch("/icons/easypay-logo.webp");
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

  const lang = getLang();
  const t = STRINGS[lang];
  const family = await ensureFont(doc, lang);
  const setF = (style: "normal" | "bold") => doc.setFont(family, style);

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
  setF("bold");
  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  doc.text(t.brand, ml, logoBottom + 4);
  doc.setFontSize(8);
  setF("normal");
  doc.setTextColor(MID.r, MID.g, MID.b);
  doc.text(t.tagline, ml + doc.getTextWidth(t.brand + " "), logoBottom + 4);
  doc.text(t.city, ml, logoBottom + 8);

  // ── Document Title + Meta (right) ──
  doc.setFontSize(20);
  setF("bold");
  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  doc.text(t.invoice, mr, 16, { align: "right" });

  const invNum = `INV-${order.order_num?.replace("#", "") || "000"}`;
  const invDate = format(new Date(order.created_at), "dd MMM yyyy");

  doc.setFontSize(9);
  setF("normal");
  doc.setTextColor(DARK.r, DARK.g, DARK.b);
  doc.text(`${t.invoiceNo}: ${invNum}`, mr, 22, { align: "right" });
  doc.text(`${t.date}: ${invDate}`, mr, 27, { align: "right" });

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
  setF("normal");
  doc.setTextColor(MID.r, MID.g, MID.b);
  doc.text(t.billTo, ml + 5, y + 5);

  doc.setFontSize(11);
  setF("bold");
  doc.setTextColor(DARK.r, DARK.g, DARK.b);
  doc.text(order.shipping_name || t.customer, ml + 5, y + 11);

  setF("normal");
  doc.setFontSize(9);
  let by = y + 16;
  if (order.shipping_phone) { doc.text(order.shipping_phone, ml + 5, by); by += 4.5; }
  if (order.shipping_address) { doc.text(order.shipping_address, ml + 5, by); by += 4.5; }
  if (order.shipping_city) { doc.text(order.shipping_city, ml + 5, by); }

  // Payment method on right side of bill box
  doc.setFontSize(8);
  doc.setTextColor(MID.r, MID.g, MID.b);
  doc.text(t.paymentMethod, mr - 5, y + 5, { align: "right" });
  doc.setFontSize(9);
  setF("bold");
  doc.setTextColor(DARK.r, DARK.g, DARK.b);
  const pm = order.payment_method === "wallet" ? t.pmWallet : order.payment_method === "cod" ? t.pmCod : t.pmCard;
  doc.text(pm, mr - 5, y + 11, { align: "right" });

  y += billBoxH + 8;

  // ── Items Table ──
  const items = Array.isArray(order.items) ? order.items : [];
  const tableBody = items.map((item) => {
    const qty = item.qty || item.quantity || 1;
    const price = Number(item.price) || 0;
    return [
      { content: item.name || item.product_name || t.item, styles: { fontStyle: "bold" as const } },
      String(qty),
      `${t.currency} ${fmt(price, lang)}`,
      `${t.currency} ${fmt(price * qty, lang)}`,
    ];
  });

  autoTable(doc, {
    startY: y,
    margin: { left: ml, right: 15 },
    head: [[t.product, t.qty, t.unitPrice, t.total]],
    body: tableBody,
    theme: "grid",
    styles: {
      font: family,
    },
    headStyles: {
      font: family,
      fillColor: [BRAND.r, BRAND.g, BRAND.b],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 9,
      cellPadding: 3,
    },
    bodyStyles: {
      font: family,
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
  setF("normal");
  doc.setTextColor(MID.r, MID.g, MID.b);
  doc.text(t.subtotal, lx, sy + 2);
  doc.setTextColor(DARK.r, DARK.g, DARK.b);
  doc.text(`${t.currency} ${fmt(subtotal, lang)}`, vx, sy + 2, { align: "right" });
  sy += 7;

  if (coupon > 0) {
    doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
    doc.text(t.coupon, lx, sy + 2);
    doc.text(`-${t.currency} ${fmt(coupon, lang)}`, vx, sy + 2, { align: "right" });
    sy += 7;
  }

  doc.setTextColor(MID.r, MID.g, MID.b);
  doc.text(t.delivery, lx, sy + 2);
  doc.setTextColor(DARK.r, DARK.g, DARK.b);
  doc.text(delivery > 0 ? `${t.currency} ${fmt(delivery, lang)}` : t.free, vx, sy + 2, { align: "right" });
  sy += 5;

  // Divider inside summary box
  doc.setDrawColor(BRAND.r, BRAND.g, BRAND.b);
  doc.setLineWidth(0.4);
  doc.line(lx, sy + 2, vx, sy + 2);
  sy += 7;

  // Grand total
  doc.setFontSize(13);
  setF("bold");
  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  doc.text(t.grandTotal, lx, sy + 2);
  doc.text(`${t.currency} ${fmt(Number(order.total), lang)}`, vx, sy + 2, { align: "right" });

  // ── Footer ──
  const footerY = ph - 20;
  doc.setDrawColor(230, 230, 230);
  doc.setLineWidth(0.3);
  doc.line(ml, footerY, mr, footerY);

  doc.setFontSize(7);
  setF("normal");
  doc.setTextColor(LIGHT.r, LIGHT.g, LIGHT.b);
  doc.text(t.footer1, pw / 2, footerY + 5, { align: "center" });
  doc.text(t.footer2, pw / 2, footerY + 9, { align: "center" });
  doc.text(`${t.generated}: ${format(new Date(), "dd MMM yyyy, hh:mm a")}`, pw / 2, footerY + 13, { align: "center" });

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
