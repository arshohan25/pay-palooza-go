// Source of truth for merchant approval push & email templates.
// MIRROR: supabase/functions/notify-merchant-approval/index.ts must keep
// the exact same strings/HTML so the admin preview matches what gets sent.

export type MerchantApprovalStatus = "approved" | "rejected";

export interface ApprovalContext {
  businessName: string;
  status: MerchantApprovalStatus;
  reason?: string | null;
  recipientName?: string | null;
}

const escapeHtml = (s: string) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export interface PushPayload {
  title: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  category: "merchant_ops";
}

export function buildPushPayload(ctx: ApprovalContext): PushPayload {
  const isApproved = ctx.status === "approved";
  const biz = (ctx.businessName && ctx.businessName.trim()) || "your business";
  const reason = ctx.reason?.trim();

  const nextStep = isApproved
    ? "Next: add your bank details & list your first product"
    : "Next: review the feedback and resubmit your application";

  const title = isApproved
    ? `🎉 ${biz} is approved on EasyPay`
    : `Action needed for ${biz}`;

  const body = isApproved
    ? `Your vendor account is live. ${nextStep}.`
    : reason
      ? `Reason: ${reason}. ${nextStep}.`
      : `${nextStep} in your Merchant dashboard.`;

  return {
    title,
    body,
    ctaLabel: isApproved ? "Start Selling" : "Review & Resubmit",
    ctaUrl: "/merchant",
    category: "merchant_ops",
  };
}

export interface EmailPayload {
  subject: string;
  html: string;
  preheader: string;
}

export function buildEmailPayload(ctx: ApprovalContext): EmailPayload {
  const isApproved = ctx.status === "approved";
  const biz = (ctx.businessName && ctx.businessName.trim()) || "your business";
  const reason = ctx.reason?.trim() || "";
  const recipient = (ctx.recipientName && ctx.recipientName.trim()) || "Merchant";
  const ctaUrl = "https://pay-palooza-go.lovable.app/merchant";
  const ctaLabel = isApproved ? "Start Selling" : "Review & Resubmit";
  const nextStep = isApproved
    ? "Next: add your bank details & list your first product"
    : "Next: review the feedback and resubmit your application";

  const accent = isApproved ? "#16a34a" : "#dc2626";
  const accentSoft = isApproved ? "#ecfdf5" : "#fef2f2";
  const accentBorder = isApproved ? "#a7f3d0" : "#fecaca";
  const safeBiz = escapeHtml(biz);
  const safeName = escapeHtml(recipient);
  const safeReason = escapeHtml(reason);

  const heading = isApproved
    ? `✅ ${safeBiz} is approved`
    : `❌ ${safeBiz} needs changes`;

  const intro = isApproved
    ? `Great news, ${safeName} — <strong>${safeBiz}</strong> has been approved on EasyPay Shop and is ready to go live.`
    : `Hi ${safeName}, your application for <strong>${safeBiz}</strong> needs a few changes before we can approve it.`;

  const stepsBlock = isApproved
    ? `<div style="background:${accentSoft};border:1px solid ${accentBorder};border-radius:10px;padding:14px 16px;margin:18px 0;">
         <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:${accent};letter-spacing:.3px;text-transform:uppercase;">Next steps</p>
         <ol style="margin:0;padding-left:20px;font-size:14px;color:#334155;line-height:1.6;">
           <li>Add your bank account so we can settle payouts</li>
           <li>List your first products in the Merchant dashboard</li>
           <li>Enable order notifications to never miss a sale</li>
         </ol>
       </div>`
    : `<div style="background:${accentSoft};border:1px solid ${accentBorder};border-radius:10px;padding:14px 16px;margin:18px 0;">
         <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:${accent};letter-spacing:.3px;text-transform:uppercase;">What to do next</p>
         <ol style="margin:0;padding-left:20px;font-size:14px;color:#334155;line-height:1.6;">
           <li>Open the Merchant dashboard</li>
           <li>Review the reviewer's note${safeReason ? "" : " on your application"}</li>
           <li>Update your details and resubmit for review</li>
         </ol>
       </div>`;

  const ctaBlock = `
    <div style="text-align:center;margin:28px 0 8px;">
      <a href="${ctaUrl}" style="background:${accent};color:#ffffff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block;">${ctaLabel} →</a>
      <p style="margin:10px 0 0;color:#64748b;font-size:12px;">${nextStep}</p>
    </div>`;

  const html = `<!doctype html><html><body style="margin:0;background:#f1f5f9;">
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:28px 24px;background:#ffffff;">
      <h2 style="color:${accent};margin:0 0 16px;font-size:20px;">${heading}</h2>
      <p style="font-size:14px;color:#334155;line-height:1.55;margin:0 0 12px;">${intro}</p>
      ${!isApproved && safeReason ? `<p style="background:${accentSoft};border:1px solid ${accentBorder};padding:10px 12px;border-radius:8px;color:#991b1b;font-size:13px;margin:12px 0;"><strong>Reviewer's note:</strong> ${safeReason}</p>` : ""}
      ${stepsBlock}
      ${ctaBlock}
      <hr style="border:none;border-top:1px solid #eee;margin:28px 0 16px;">
      <p style="color:#94a3b8;font-size:12px;margin:0;">EasyPay — Secure Digital Wallet · This is an automated message about <strong>${safeBiz}</strong>.</p>
    </div></body></html>`;

  const subject = isApproved
    ? `🎉 ${biz} is approved on EasyPay — start selling`
    : `Action needed: ${biz} vendor application`;

  const preheader = isApproved
    ? `Your vendor account is live. ${nextStep}.`
    : `We need a few updates before approving ${biz}.`;

  return { subject, html, preheader };
}

export const SAMPLE_BUSINESSES = [
  "Karim Electronics",
  "Dhaka Fashion House",
  "Padma Grocery Mart",
  "Sundarban Handicrafts",
  "Cox's Bazar Seafoods",
];
