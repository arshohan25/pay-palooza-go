

## Agent Dashboard Quick Actions Redesign and New Features

### What Changes

**1. Quick Actions: Card View with 2-Row Grid (4 columns x 2 rows)**

Replace the current scrollable row with a styled card container holding 8 action tiles in a 4x2 grid layout, similar to the home screen's QuickActions component.

Current actions (5): Cash In, B2B Send, Bank, Register, Bill Pay

New layout with 3 additional features (8 total):
| Cash In | B2B Send | Bank | Bill Pay |
| Register | Float Req | History | Support |

**2. New Features**

- **Float Request**: A quick action that lets agents request float top-up from their distributor (shows a simple form with amount and note, then records the request).
- **History**: Direct link to `/agent/history` (currently only accessible via "See All" in Recent Activity).
- **Support**: Opens a help/support bottom sheet with common agent FAQs and a contact option.

### Technical Details

**File: `src/pages/AgentDashboard.tsx`**

- Update `quickActions` array from 5 to 8 items with new entries for Float Request, History, and Support.
- Replace the scrollable `flex` container (lines 311-329) with a Card-wrapped `grid grid-cols-4 gap-y-5 gap-x-2` layout matching the home screen style.
- Each tile: icon in a colored rounded container + label below, inside a `motion.button` with tap animation.
- Add state and UI for:
  - **Float Request**: A bottom sheet modal with amount input and submit button. On submit, shows a success toast (no new DB table needed -- uses existing patterns).
  - **Support**: A bottom sheet with FAQ items and a "Contact Admin" button.

**Styling**: The card container will use `bg-card rounded-3xl shadow-card border border-border/60 p-4` to match the home screen QuickActions card design, with each icon having its own gradient background.

