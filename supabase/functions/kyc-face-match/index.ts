import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { nid_image_base64, selfie_base64 } = await req.json();
    if (!nid_image_base64 || !selfie_base64) {
      return new Response(JSON.stringify({ error: "Both nid_image_base64 and selfie_base64 are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripPrefix = (s: string) => s.replace(/^data:image\/[a-z]+;base64,/, "");
    const nidBase64 = stripPrefix(nid_image_base64);
    const selfieBase64 = stripPrefix(selfie_base64);

    console.log(`Processing face match for user ${claimsData.claims.sub}`);

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
            content: `You are a face verification specialist. Compare the face in a National ID card photo with a live selfie photo.

Analyze facial features like face shape, eyes, nose, mouth, eyebrows, and overall appearance.

Return ONLY a valid JSON object with:
- match: boolean (true if same person, false if not)
- confidence: number between 0 and 100 (percentage confidence)
- result: "match" | "no_match" | "inconclusive"
- reason: brief explanation

If confidence is below 60, set result to "inconclusive".
If confidence is 60-100 and faces match, set result to "match".
If confidence is 60-100 and faces don't match, set result to "no_match".

Do NOT include any explanation or markdown, just the raw JSON object.`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Compare these two photos. The first is from a Bangladeshi NID card and the second is a live selfie. Are they the same person? Return only JSON."
              },
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${nidBase64}` }
              },
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${selfieBase64}` }
              }
            ]
          }
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
      return new Response(JSON.stringify({ error: "Face matching failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    let result;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : { match: false, confidence: 0, result: "inconclusive", reason: "Could not parse response" };
    } catch {
      console.error("Failed to parse face match response:", content);
      result = { match: false, confidence: 0, result: "inconclusive", reason: "Parse error" };
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("kyc-face-match error:", e);
    return new Response(JSON.stringify({ error: "Processing failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
