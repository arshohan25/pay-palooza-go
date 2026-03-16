

## Suggested Admin Panel Additions

After reviewing the full navigation structure (9 groups, 70+ modules) and all existing components, here are the most impactful missing features:

### 1. Scheduled Reports & Email Digests
**Problem**: Admins must manually check the dashboard for updates. No automated reporting exists.
**Solution**: A "Scheduled Reports" module under Reports that lets admins configure daily/weekly email digests with key metrics (transaction volume, new users, pending KYC, open complaints).
- New table `scheduled_reports` (frequency, recipients, report_type, last_sent_at)
- Edge function to compile and send via email
- **Effort**: Medium

### 2. Blacklist / Watchlist Manager
**Problem**: Risk Control exists but there's no dedicated phone/IP/device blacklist with auto-block rules.
**Solution**: A "Blacklist" module under System for managing blocked phones, IPs, and device fingerprints with auto-reject on registration/login.
- New table `blacklist_entries` (type, value, reason, blocked_by, expires_at)
- Integrate with auth flow to reject blacklisted entries
- **Effort**: Medium

### 3. Agent Performance Leaderboard
**Problem**: Agent Hub tracks agents but lacks performance ranking and gamification.
**Solution**: Add a "Leaderboard" sub-tab inside Agent Hub showing top agents by transaction volume, commission earned, and customer ratings.
- Computed from existing `transactions` and `commission_logs` data
- No new tables needed
- **Effort**: Low

### 4. User Feedback / App Ratings
**Problem**: Support tickets capture complaints but there's no proactive feedback collection.
**Solution**: A "Feedback" module under Marketing for viewing in-app ratings and NPS scores.
- New table `user_feedback` (user_id, rating, comment, screen, created_at)
- Frontend widget for users to submit feedback
- **Effort**: Medium

### 5. Changelog / Release Notes Manager
**Problem**: Platform Announcements cover urgent notices but there's no versioned changelog for feature updates.
**Solution**: A "Changelog" module under Marketing for publishing versioned release notes visible to users.
- New table `changelog_entries` (version, title, body, published_at)
- User-facing changelog page
- **Effort**: Low

---

### Recommendation

I'd suggest starting with **items 1-3** as they have the highest operational impact. Which of these would you like me to implement?

