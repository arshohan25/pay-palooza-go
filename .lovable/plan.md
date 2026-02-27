

## Plan: Add Pending KYC Count Badge to Admin Nav

**What**: Add a real-time pending KYC count badge next to the "KYC" nav item in the admin dashboard sidebar, matching the existing fraud alerts and support badges.

**Implementation** (single file: `src/pages/AdminDashboard.tsx`):

1. **Fetch pending KYC count** alongside existing stats in `loadData` — add a query: `supabase.from("kyc_verifications").select("id", { count: "exact", head: true }).eq("status", "pending")`
2. **Add `pendingKyc` to the `Stats` interface** and state default
3. **Add badge markup** after the support badge block (~line 345), matching the same pattern:
   ```tsx
   {item.id === "kyc" && stats.pendingKyc > 0 && (
     <span className="ml-auto min-w-[16px] h-4 px-1 bg-orange-500 text-white text-[9px] font-bold rounded-full inline-flex items-center justify-center">
       {stats.pendingKyc}
     </span>
   )}
   ```
4. **Add a KYC stat card** to the overview grid showing pending KYC count

