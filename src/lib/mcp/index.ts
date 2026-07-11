import { auth, defineMcp } from "@lovable.dev/mcp-js";
import createPaymentRequest from "./tools/create_payment_request";
import getPaymentStatus from "./tools/get_payment_status";
import listPaymentRequests from "./tools/list_payment_requests";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "easypay-mcp",
  title: "EasyPay Payments",
  version: "0.1.0",
  instructions:
    "Tools for the EasyPay wallet: create shareable payment requests (links), check payment status by short code, and list your recent payment requests with totals. All actions run as the signed-in EasyPay user.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [createPaymentRequest, getPaymentStatus, listPaymentRequests],
});
