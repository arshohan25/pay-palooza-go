

## Auto-link B2B Distributor recipient from agent record

### Problem
Agents currently must manually enter or scan their distributor's phone for B2B transfers. Since every agent is already linked to a distributor via `agents.distributor_id`, the distributor option should auto-resolve — no manual input needed.

### Changes

**`src/pages/AgentB2B.tsx`**

1. **On mount / when `transferType` is "distributor"**: Fetch the current agent's record (`agents` table where `user_id = auth.uid()`), get the `distributor_id`, then fetch the distributor's `user_id` from `distributors` table, then resolve the distributor's phone and name via `resolve_transfer_recipient` or by querying `profiles`.

2. **Auto-fill phone and name**: When distributor is selected, set `phone` and `resolvedName` automatically. Show the distributor info as a read-only card (business name + phone) instead of an editable phone input with QR scanner.

3. **Keep agent-to-agent manual**: When `transferType === "agent"`, keep the current manual phone entry + QR scan flow unchanged.

4. **UI change for distributor mode**: Replace the phone input + QR button with a pre-filled read-only display showing the linked distributor's name and phone. Show a loading state while fetching. Show an error if no distributor is linked.

### Implementation sketch

```tsx
// New state
const [distributorInfo, setDistributorInfo] = useState<{phone: string; name: string; businessName: string} | null>(null);
const [loadingDistributor, setLoadingDistributor] = useState(false);

// Fetch on mount
useEffect(() => {
  const fetchDistributor = async () => {
    setLoadingDistributor(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: agent } = await supabase.from("agents").select("distributor_id").eq("user_id", user.id).single();
    if (agent?.distributor_id) {
      const { data: dist } = await supabase.from("distributors").select("user_id, business_name").eq("id", agent.distributor_id).single();
      if (dist) {
        const { data: profile } = await supabase.from("profiles").select("phone, name").eq("user_id", dist.user_id).single();
        if (profile) {
          setDistributorInfo({ phone: profile.phone, name: profile.name || dist.business_name, businessName: dist.business_name });
        }
      }
    }
    setLoadingDistributor(false);
  };
  fetchDistributor();
}, []);

// When transferType switches to "distributor", auto-fill
useEffect(() => {
  if (transferType === "distributor" && distributorInfo) {
    setPhone(distributorInfo.phone);
    setResolvedName(distributorInfo.name);
  } else if (transferType === "agent") {
    setPhone(""); setResolvedName("");
  }
}, [transferType, distributorInfo]);
```

For the form UI, when `transferType === "distributor"`:
- Show a read-only card with distributor business name + phone instead of the editable input
- Remove QR scan button for distributor mode
- If no distributor linked, show an info message

### Files changed
| File | Change |
|------|--------|
| `AgentB2B.tsx` | Auto-fetch linked distributor, pre-fill phone/name, show read-only for distributor mode |

