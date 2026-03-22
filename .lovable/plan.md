

## ✅ Add Toggle Keys to Agent & Distributor Dashboard Features (Completed)

All 21 agent and distributor feature toggles have been added and are now controllable from the Admin Global Toggles panel.

### Files Modified
- `src/pages/AgentDashboard.tsx` — 8 quick actions with toggleKey + filtering
- `src/components/AgentMenuDrawer.tsx` — 5 menu items with toggleKey + filtering
- `src/pages/DistributorDashboard.tsx` — 8 quick actions with toggleKey + filtering

### Database
21 rows inserted into `global_feature_toggles` (agent_* x13, distributor_* x8)
