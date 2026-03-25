

## Plan: Apply Segmented Control Style to All Remaining Admin Filters

### Scope
19 admin components still use the old `Button variant="default"/"outline"` pattern for filters/tabs. All need to be converted to the brand-colored segmented control style.

### Target Style (same as Activity Monitor)
```text
┌─ bg-muted/50 rounded-lg p-1 flex flex-wrap gap-0.5 ──────┐
│  [Active: bg-primary text