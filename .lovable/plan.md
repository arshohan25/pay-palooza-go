

## Plan: Add More Session Timeout Options

### What Changes
Expand the session timeout dropdown in **Admin Dashboard → System Settings → App Config** from 5 options to 10 options.

### Current Options
15 min, 30 min, 1 hour, 2 hours, 4 hours

### New Options (added)
- **5 minutes** — for testing
- **10 minutes**
- **45 minutes**
- **3 hours**
- **6 hours**
- **8 hours** (full workday)

### Full List After Change
5 min → 10 min → 15 min → 30 min → 45 min → 1 hour → 2 hours → 3 hours → 4 hours → 6 hours → 8 hours

### File Modified
- `src/components/admin/AdminSystemSettings.tsx` — update SelectItem list (lines 163-167)

