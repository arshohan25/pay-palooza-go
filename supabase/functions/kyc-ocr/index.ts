import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FRONT_PROMPT = `You are a Bangladeshi National ID (NID) card data extractor. Extract the following fields from the FRONT side of the NID card image:
- full_name: The full name in English (if Bengali, transliterate to English)
- full_name_bn: The full name in Bengali/Bangla script
- nid_number: The NID number (usually 10, 13, or 17 digits)
- date_of_birth: Date of birth in DD/MM/YYYY format
- father_name: Father's name
- mother_name: Mother's name

Return ONLY a valid JSON object with these fields. If a field is not visible or readable, set it to an empty string "".
Do NOT include any explanation or markdown, just the raw JSON object.`;

const BACK_PROMPT = `You are a Bangladeshi National ID (NID) card data extractor. This is the BACK side of a Bangladeshi NID card.

The back side of a Bangladeshi NID typically contains the holder's ADDRESS information in Bengali/Bangla script.

Extract the following fields:
- address: The FULL address written on the back of the NID card. Include all parts (village/road, post office, upazila/thana, district). Transliterate Bengali text to English if needed, but also provide the original Bengali.
- address_bn: The full address in original Bengali/Bangla script exactly as written on the card.
- blood_group: Blood group if visible (e.g., A+, B+, O+, AB+, etc.)

IMPORTANT: The address is the most critical field. Look carefully at ALL text on the back of the card. The address is usually the largest block of text.

Return ONLY a valid JSON object with these fields. If a field is not visible or readable, set it to an empty string "".
Do NOT include any explanation or markdown, just the raw JSON object.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { image_base64, side } = await req.json();
    if (!image_base64) {
      return new Response(JSON.stringify({ error: "image_base64 is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Strip data URL prefix if present
    const base64Data = image_base64.replace(/^data:image\/[a-z]+;base64,/, "");

    const isBack = side === "back";
    const systemPrompt = isBack ? BACK_PROMPT : FRONT_PROMPT;
    const userText = isBack
      ? "Extract the ADDRESS and other information from this BACK side of a Bangladeshi NID card. Return only JSON."
      : "Extract all information from this Bangladeshi NID card image. Return only JSON.";

    console.log(`Processing NID ${isBack ? "BACK" : "FRONT"} side OCR`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userText },
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${base64Data}` },
              },
            ],
          },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI usage limit reached. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI processing failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    console.log("Raw AI response:", content);

    // Parse the JSON from the response
    let extracted;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      extracted = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch {
      console.error("Failed to parse OCR response:", content);
      extracted = isBack
        ? { address: "", address_bn: "", blood_group: "" }
        : { full_name: "", full_name_bn: "", nid_number: "", date_of_birth: "", father_name: "", mother_name: "", address: "" };
    }

    console.log("Extracted data:", JSON.stringify(extracted));

    return new Response(JSON.stringify({ success: true, data: extracted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("kyc-ocr error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
