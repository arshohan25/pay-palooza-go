import "https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Require a valid user JWT — prevents anonymous AI credit abuse
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  try {
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims, error: cErr } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (cErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { image } = await req.json();

    if (!image || typeof image !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing image data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OCR service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Ensure proper data URL format
    const dataUrl = image.startsWith("data:")
      ? image
      : `data:image/jpeg;base64,${image}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a phone number and merchant code extractor. Extract any visible phone numbers and merchant codes from the image. Focus on Bangladesh mobile numbers (11 digits starting with 01) and merchant codes starting with MRC.

Return ONLY a JSON object with this exact format, no markdown:
{"numbers": ["01XXXXXXXXX"], "merchant_codes": ["MRC-XXXX-XXXX"]}

Rules:
- Extract all visible phone numbers even if handwritten, printed, or on a screen
- Normalize to 11-digit format (remove +880, country code, spaces, dashes)
- If no numbers found, return {"numbers": [], "merchant_codes": []}
- Only include valid Bangladesh mobile numbers (01 followed by 3-9 then 8 digits)
- Include any MRC-prefixed merchant codes found`,
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract phone numbers and merchant codes from this image." },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 256,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Lovable AI error:", errText);
      return new Response(
        JSON.stringify({ error: "OCR processing failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const rawText = data?.choices?.[0]?.message?.content || "";

    let numbers: string[] = [];
    let merchantCodes: string[] = [];

    try {
      const cleaned = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned);
      numbers = (parsed.numbers || []).filter(
        (n: string) => /^01[3-9]\d{8}$/.test(n)
      );
      merchantCodes = (parsed.merchant_codes || []).filter(
        (c: string) => /^MRC/i.test(c)
      );
    } catch {
      // Fallback: regex extract
      const phoneMatches = rawText.match(/01[3-9]\d{8}/g) || [];
      numbers = [...new Set(phoneMatches)];
      const mrcMatches = rawText.match(/MRC-?\w{4}-?\w{4}/gi) || [];
      merchantCodes = [...new Set(mrcMatches)];
    }

    return new Response(
      JSON.stringify({ numbers, merchant_codes: merchantCodes }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("OCR error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
