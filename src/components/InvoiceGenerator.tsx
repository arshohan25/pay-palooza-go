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

function buildDoc(order: InvoiceOrder): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const margin = 15;

  // --- Header ---
  doc.setFillColor(14, 165, 100); // brand green
  doc.rect(0, 0, pw, 38, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE", margin, 18);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("EasyPay", margin, 26);
  doc.text("Digital Financial Services · Bangladesh", margin, 32);

  // Invoice meta (right side)
  const invNum = `INV-${order.order_num?.replace("#", "") || "000"}`;
  const invDate = new Date(order.created_at).toLocaleDateString("en-BD", {
    day: "numeric", month: "short", year: "numeric",
  });
  doc.setFontSize(10);
  doc.text(invNum, pw - margin, 18, { align: "right" });
  doc.text(invDate, pw - margin, 26, { align: "right" });

  // --- Bill To ---
  let y = 48;
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9);
  doc.text("BILL TO", margin, y);
  y += 6;
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(order.shipping_name || "Customer", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  if (order.shipping_phone) { doc.text(order.shipping_phone, margin, y); y += 5; }
  if (order.shipping_address) { doc.text(order.shipping_address, margin, y); y += 5; }
  if (order.shipping_city) { doc.text(order.shipping_city, margin, y); y += 5; }

  // --- Items Table ---
  y += 6;
  const items = Array.isArray(order.items) ? order.items : [];
  const tableBody = items.map((item) => {
    const qty = item.qty || item.quantity || 1;
    const price = Number(item.price) || 0;
    return [
      item.name || item.product_name || "Item",
      String(qty),
      `৳${fmt(price)}`,
      `৳${fmt(price * qty)}`,
    ];
  });

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Product", "Qty", "Unit Price", "Total"]],
    body: tableBody,
    theme: "striped",
    headStyles: { fillColor: [14, 165, 100], textColor: 255, fontStyle: "bold", fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: [30, 30, 30] },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { halign: "center", cellWidth: 18 },
      2: { halign: "right", cellWidth: 30 },
      3: { halign: "right", cellWidth: 30 },
    },
  });

  // --- Summary ---
  const finalY = (doc as any).lastAutoTable?.finalY ?? y + 40;
  let sy = finalY + 10;
  const labelX = pw - margin - 70;
  const valX = pw - margin;

  const subtotal = items.reduce((s, i) => s + (Number(i.price) || 0) * (i.qty || i.quantity || 1), 0);
  const coupon = Number(order.coupon_discount) || 0;
  const delivery = Number(order.delivery_fee) || 0;

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text("Subtotal", labelX, sy);
  doc.setTextColor(30, 30, 30);
  doc.text(`৳${fmt(subtotal)}`, valX, sy, { align: "right" });
  sy += 6;

  if (coupon > 0) {
    doc.setTextColor(14, 165, 100);
    doc.text("Coupon Discount", labelX, sy);
    doc.text(`-৳${fmt(coupon)}`, valX, sy, { align: "right" });
    sy += 6;
  }

  doc.setTextColor(100, 100, 100);
  doc.text("Delivery Fee", labelX, sy);
  doc.setTextColor(30, 30, 30);
  doc.text(delivery > 0 ? `৳${fmt(delivery)}` : "Free", valX, sy, { align: "right" });
  sy += 2;

  doc.setDrawColor(200, 200, 200);
  doc.line(labelX, sy, valX, sy);
  sy += 6;

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(14, 165, 100);
  doc.text("Grand Total", labelX, sy);
  doc.text(`৳${fmt(Number(order.total))}`, valX, sy, { align: "right" });
  sy += 8;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text(
    `Payment: ${order.payment_method === "wallet" ? "EasyPay Wallet" : "Card"}`,
    labelX, sy
  );

  // --- Footer ---
  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setFontSize(8);
  doc.setTextColor(160, 160, 160);
  doc.text("Thank you for shopping with EasyPay!", pw / 2, footerY, { align: "center" });
  doc.text(`Generated: ${new Date().toLocaleString("en-BD")}`, pw / 2, footerY + 4, { align: "center" });

  return doc;
}

export function downloadInvoice(order: InvoiceOrder) {
  const doc = buildDoc(order);
  doc.save(`Invoice-${order.order_num?.replace("#", "") || "order"}.pdf`);
}

export function printInvoice(order: InvoiceOrder) {
  const doc = buildDoc(order);
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
