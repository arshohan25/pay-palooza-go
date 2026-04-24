# Add Risk Score Calculation Tooltip

## Summary
Add a detailed "How this score was calculated" tooltip next to the Risk Score in the User Intelligence Center that shows the exact factors and points contributing to the score.

## Changes Required

### 1. Import Additions
- Add `HelpCircle` icon from lucide-react
- Import `Tooltip`, `TooltipContent`, `TooltipProvider`, `TooltipTrigger` from @/components/ui/tooltip
- Rename `Tooltip` import from recharts to `RechartsTooltip` to avoid naming conflict

### 2. Risk Score Component Enhancement
Modify the Risk Score MetricCard to include:
- A help icon button next to the score value
- A rich tooltip content showing:
  - Header: "Risk Score Breakdown"
  - List of all contributing factors with their point values
  - Visual indicator (colored dot) for each factor type
  - Total score and final risk label
  - Brief explanation of the scoring methodology

### 3. Tooltip Content Structure
The tooltip should display:
- **Base Score**: 12 points (starting value)
- **Account Age**: +10 if < 14 days
- **Profile Status**: +30 if suspended/deactivated
- **KYC Status**: +18 if rejected, +8 if no KYC
- **Devices**: +12 if > 2 devices
- **Fraud Alerts**: +12 per alert (max 28)
- **High-Value Transfers**: +5 per transfer ≥৳50,000 (max 20)
- **Final Score**: Capped at 100
- **Risk Label**: Based on score thresholds

### 4. UI/UX Considerations
- Tooltip should be positioned to the right (side="right")
- Use a card-like appearance within the tooltip
- Color-code risk factors (amber for warnings, red for critical)
- Include a brief footer explaining that scores are recalculated in real-time

## Files to Modify
- `src/components/admin/AdminCommandIntelligence.tsx`

## Testing
- Verify tooltip appears on hover/click of help icon
- Confirm all risk factors are displayed with correct point values
- Check that the tooltip is responsive and doesn't overflow on smaller screens
- Validate that the risk score calculation matches the displayed breakdown