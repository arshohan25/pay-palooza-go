// Server-side validation for vendor shop photos.
// Verifies: authenticated user owns the uploaded object, file MIME/size, and minimum resolution.
// On success, records an audit event (upload / reupload) and updates the vendor application row.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const MAX_BYTES = 8 * 1024 * 1024;        // 8 MB
const MIN_WIDTH = 640;
const MIN_HEIGHT = 480;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

interface Body {
  application_id: string;
  slot: "front" | "inside";
  storage_path: string;              // path inside vendor-kyc bucket
  capture_date?: string | null;      // ISO from EXIF/DateTaken if available
  reason?: string;
}

// Minimal image dimension probe for JPEG / PNG / WEBP without external deps.
function probeDimensions(bytes: Uint8Array, mime: string): { width: number; height: number } | null {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  try {
    if (mime === "image/png") {
      // IHDR at offset 16 for PNG signature 8 bytes + 8 IHDR chunk header
      if (bytes.length < 24) return null;
      return { width: dv.getUint32(16), height: dv.getUint32(20) };
    }
    if (mime === "image/jpeg") {
      let off = 2;
      while (off < bytes.length) {
        if (dv.getUint8(off) !== 0xff) return null;
        const marker = dv.getUint8(off + 1);
        off += 2;
        // SOF0..SOF15 (except DHT=0xC4, DAC=0xCC, DNL=0xDC)
        if (
          (marker >= 0xc0 && marker <= 0xcf) &&
          marker !== 0xc4 && marker !== 0xcc && marker !== 0xc8
        ) {
          const h = dv.getUint16(off + 3);
          const w = dv.getUint16(off + 5);
          return { width: w, height: h };
        }
        const size = dv.getUint16(off);
        off += size;
      }
      return null;
    }
    if (mime === "image/webp") {
      // RIFF....WEBPVP8 
      if (bytes.length < 30) return null;
      const fourCC = String.fromCharCode(...bytes.slice(12, 16));
      if (fourCC === "VP8 ") {
        return { width: dv.getUint16(26, true) & 0x3fff, height: dv.getUint16(28, true) & 0x3fff };
      }
      if (fourCC === "VP8L") {
        const b0 = bytes[21], b1 = bytes[22], b2 = bytes[23], b3 = bytes[24];
        const w = 1 + (((b1 & 0x3f) << 8) | b0);
        const h = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
        return { width: w, height: h };
      }
      if (fourCC === "VP8X") {
        const w = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
        const h = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
        return { width: w, height: h };
      }
    }
  } catch { /* fallthrough */ }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return new Response(JSON.stringify({ error: "Missing auth" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const svc  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient  = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const admin       = createClient(url, svc);

  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "Invalid session" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const uid = userData.user.id;

  let body: Body;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { application_id, slot, storage_path, capture_date, reason } = body ?? {} as Body;
  if (!application_id || !storage_path || (slot !== "front" && slot !== "inside")) {
    return new Response(JSON.stringify({ error: "application_id, slot (front|inside), storage_path required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  // Users must only upload under their own uid prefix
  if (!storage_path.startsWith(`${uid}/`)) {
    return new Response(JSON.stringify({ error: "storage_path must be under your own user folder" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Confirm application ownership
  const { data: app, error: appErr } = await admin
    .from("merchant_vendor_applications")
    .select("id,user_id,status")
    .eq("id", application_id).maybeSingle();
  if (appErr || !app) {
    return new Response(JSON.stringify({ error: "Application not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (app.user_id !== uid) {
    return new Response(JSON.stringify({ error: "Not the applicant" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (app.status === "approved") {
    return new Response(JSON.stringify({ error: "Approved applications cannot be modified" }), {
      status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Download and validate
  const { data: blob, error: dlErr } = await admin.storage.from("vendor-kyc").download(storage_path);
  if (dlErr || !blob) {
    return new Response(JSON.stringify({ error: "File not accessible in storage" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const mime = blob.type || "application/octet-stream";
  if (!ALLOWED.has(mime)) {
    return new Response(JSON.stringify({ error: `Unsupported file type ${mime}. Use JPG, PNG or WEBP.` }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes.byteLength > MAX_BYTES) {
    return new Response(JSON.stringify({ error: `Photo exceeds ${MAX_BYTES / 1024 / 1024}MB` }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const dims = probeDimensions(bytes, mime);
  if (!dims) {
    return new Response(JSON.stringify({ error: "Unable to read image dimensions. Please re-export the photo." }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (dims.width < MIN_WIDTH || dims.height < MIN_HEIGHT) {
    return new Response(JSON.stringify({
      error: `Photo resolution ${dims.width}×${dims.height} is below the required ${MIN_WIDTH}×${MIN_HEIGHT}.`,
    }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const meta = {
    mime,
    bytes: bytes.byteLength,
    width: dims.width,
    height: dims.height,
    uploaded_at: new Date().toISOString(),
    capture_date: capture_date ?? null,
    validated: true,
  };

  const { error: rpcErr } = await admin.rpc("record_vendor_shop_photo_upload", {
    _application_id: application_id,
    _slot: slot,
    _new_path: storage_path,
    _new_meta: meta,
    _reason: reason ?? null,
  });
  if (rpcErr) {
    return new Response(JSON.stringify({ error: rpcErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, meta }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
