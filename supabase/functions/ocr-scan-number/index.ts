import "https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image } = await req.json();

    if (!image || typeof image !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing image data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use Gemini 2.5 Flash for fast OCR
    const apiKey = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "OCR service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Strip data URL prefix if present
    const base64Data = image.includes(",") ? image.split(",")[1] : image;
    const mimeType = image.startsWith("data:") 
      ? image.split(";")[0].split(":")[1] 
      : "image/jpeg";

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `You are a phone number extractor. Look at this image and find any phone numbers written, printed, or displayed in it. Focus on Bangladesh mobile numbers (11 digits starting with 01). Also look for merchant codes starting with MRC.

Return ONLY a JSON object with this exact format, no markdown:
{"numbers": ["01XXXXXXXXX"], "merchant_codes": ["MRC-XXXX-XXXX"]}

Rules:
- Extract all visible phone numbers, even if handwritten or partially visible
- Normalize to 11-digit format (remove +880, spaces, dashes)
- If no numbers found, return {"numbers": [], "merchant_codes": []}
- Only include valid-looking Bangladesh mobile numbers (01X followed by 8 digits)
- Include any MRC-prefixed merchant codes found`
                },
                {
                  inlineData: {
                    mimeType,
                    data: base64Data,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 256,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini API error:", errText);
      return new Response(
        JSON.stringify({ error: "OCR processing failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const geminiData = await geminiRes.json();
    const rawText =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Parse the JSON response from Gemini
    let numbers: string[] = [];
    let merchantCodes: string[] = [];

    try {
      // Clean potential markdown wrapping
      const cleaned = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned);
      numbers = (parsed.numbers || []).filter(
        (n: string) => /^01[3-9]\d{8}$/.test(n)
      );
      merchantCodes = (parsed.merchant_codes || []).filter(
        (c: string) => /^MRC/i.test(c)
      );
    } catch {
      // Fallback: regex extract from raw text
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
