

## Default transfer type to "distributor" in AgentB2B

### Change

**`src/pages/AgentB2B.tsx`**
- Change the initial `transferType` state from `"agent"` to `"distributor"`

One-line change: `useState<"agent" | "distributor">("agent")` → `useState<"agent" | "distributor">("distributor")`

