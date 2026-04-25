Deno.test("probe env", () => {
  const keys = ["SUPABASE_SERVICE_ROLE_KEY", "SERVICE_ROLE_KEY", "SUPABASE_URL", "VITE_SUPABASE_URL"];
  for (const k of keys) {
    console.log(k, Deno.env.get(k) ? "SET" : "missing");
  }
});
