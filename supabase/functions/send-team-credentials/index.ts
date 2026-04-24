const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, displayName, username, password, loginUrl, role, department } = await req.json();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!username || !password) {
      return new Response(
        JSON.stringify({ error: "Username and password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Email service is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "EasyPay <EasyPay@smartshop.bd>",
        to: [email],
        subject: "Your EasyPay Team Account",
        html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 20px;">
          <h2 style="color: #333; margin-bottom: 4px;">Welcome to EasyPay, ${displayName || "Team Member"}!</h2>
          <p style="color: #666; font-size: 14px; margin-bottom: 24px;">Your team account has been created. Here are your login credentials.</p>
          
          <div style="background: #f8f9fa; border-radius: 12px; padding: 24px; margin-bottom: 24px; border: 1px solid #e9ecef;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #888; font-size: 13px; width: 100px;">Username</td>
                <td style="padding: 8px 0; font-weight: 600; font-family: monospace; font-size: 15px; color: #333;">${username}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #888; font-size: 13px;">Password</td>
                <td style="padding: 8px 0; font-weight: 600; font-family: monospace; font-size: 15px; color: #333;">${password}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #888; font-size: 13px;">Role</td>
                <td style="padding: 8px 0; color: #333; font-size: 14px;">${role || "—"}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #888; font-size: 13px;">Department</td>
                <td style="padding: 8px 0; color: #333; font-size: 14px;">${department || "—"}</td>
              </tr>
            </table>
          </div>

          <div style="text-align: center; margin-bottom: 24px;">
            <a href="${loginUrl || "#"}" style="display: inline-block; background: #111; color: #fff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
              Login to EasyPay
            </a>
          </div>

          <div style="background: #fff8e1; border-radius: 8px; padding: 12px 16px; border: 1px solid #ffe082;">
            <p style="margin: 0; color: #f57f17; font-size: 13px; font-weight: 500;">⚠️ Please change your password after your first login for security.</p>
          </div>

          <p style="color: #aaa; font-size: 11px; margin-top: 24px; text-align: center;">This is an automated message from EasyPay. Do not share these credentials with anyone.</p>
        </div>
      `,
      }),
    });

    if (!emailResponse.ok) {
      const emailError = await emailResponse.text();
      console.error("Resend error:", emailError);
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: emailError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: `Credentials sent to ${email}` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-team-credentials error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
