import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface ReceiptTxn {
  id: string;
  short_id?: string | null;
  type: string;
  typeLabel?: string;
  amount: number;
  fee?: number | null;
  commission?: number | null;
  status?: string | null;
  party_name?: string | null;
  party_phone?: string | null;
  description?: string | null;
  balance_after?: number | null;
  created_at: string;
  isCredit?: boolean;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(Math.abs(Number(n) || 0));

export function generateTxnReceiptPdf(tx: ReceiptTxn, opts?: { appName?: string }): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  const rawStatus = (tx.status || "completed").toLowerCase();
  const isCompleted = rawStatus === "completed" || rawStatus === "success";
  const isPending = rawStatus === "pending" || rawStatus === "processing";
  const isFailed = !isCompleted && !isPending;

  // Header bar — color reflects status
  const header: [number, number, number] = isCompleted
    ? [233, 30, 140]
    : isPending
      ? [217, 119, 6]
      : [190, 30, 45];
  doc.setFillColor(header[0], header[1], header[2]);
  doc.rect(0, 0, pageW, 70, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(opts?.appName || "EasyPay", 40, 34);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  const heading = isCompleted
    ? "Transaction Receipt"
    : isPending
      ? "Pending Transaction Advice"
      : "Failed Transaction Advice";
  doc.text(heading, 40, 54);

  // Amount hero
  const isCredit = !!tx.isCredit;
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  const amountPrefix = isCompleted ? (isCredit ? "+" : "-") : "";
  doc.text(`${amountPrefix} BDT ${fmt(tx.amount)}`.trim(), 40, 120);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(header[0], header[1], header[2]);
  doc.text(`Status: ${rawStatus.toUpperCase()}`, 40, 140);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(new Date(tx.created_at).toLocaleString("en-BD"), 40, 156);
  if (isPending) {
    doc.text("Funds are not yet settled. This advice is for reference only.", 40, 170);
  } else if (isFailed) {
    doc.text("This transaction did not complete. No funds were moved.", 40, 170);
  }

  // Details table
  const rows: [string, string][] = [
    ["Reference ID", tx.short_id || tx.id],
    ["Type", tx.typeLabel || tx.type],
    ...(tx.party_name ? [["Name", tx.party_name] as [string, string]] : []),
    ...(tx.party_phone ? [[isCredit ? "Sender Number" : "Receiver Number", tx.party_phone] as [string, string]] : []),
    ["Amount", `BDT ${fmt(tx.amount)}`],
    ...(Number(tx.fee) > 0 ? [["Fee / Charge", `BDT ${fmt(tx.fee!)}`] as [string, string]] : []),
    ...(Number(tx.commission) > 0 ? [["Commission", `BDT ${fmt(tx.commission!)}`] as [string, string]] : []),
    ...(tx.balance_after != null ? [["Balance After", `BDT ${fmt(tx.balance_after)}`] as [string, string]] : []),
    ...(tx.description ? [["Description", tx.description] as [string, string]] : []),
    ["Date & Time", new Date(tx.created_at).toLocaleString("en-BD")],
  ];

  autoTable(doc, {
    startY: 180,
    head: [["Field", "Value"]],
    body: rows,
    theme: "grid",
    headStyles: { fillColor: [244, 244, 246], textColor: [60, 60, 60], fontStyle: "bold" },
    bodyStyles: { textColor: [40, 40, 40], fontSize: 10 },
    columnStyles: { 0: { cellWidth: 160, fontStyle: "bold" }, 1: { cellWidth: "auto" } },
    margin: { left: 40, right: 40 },
  });

  // Totals card
  const finalY = (doc as any).lastAutoTable?.finalY ?? 200;
  const base = Math.abs(Number(tx.amount) || 0);
  const feeN = Number(tx.fee) || 0;
  const commN = Number(tx.commission) || 0;
  const total = isCredit ? Math.max(0, base - feeN) + commN : base + feeN;

  doc.setDrawColor(230, 230, 230);
  doc.setFillColor(250, 250, 252);
  doc.roundedRect(40, finalY + 20, pageW - 80, 60, 8, 8, "FD");
  doc.setTextColor(80, 80, 80);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(isCredit ? "Net Credited" : "Total Deducted", 56, finalY + 46);
  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(`BDT ${fmt(total)}`, pageW - 56, finalY + 50, { align: "right" });

  // Footer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(140, 140, 140);
  doc.text(
    "This is a system-generated receipt and does not require a signature.",
    pageW / 2,
    doc.internal.pageSize.getHeight() - 30,
    { align: "center" },
  );

  return doc;
}

export function downloadTxnReceiptPdf(tx: ReceiptTxn, opts?: { appName?: string }) {
  const doc = generateTxnReceiptPdf(tx, opts);
  const ref = (tx.short_id || tx.id).toString().slice(0, 20);
  doc.save(`receipt-${ref}.pdf`);
}
